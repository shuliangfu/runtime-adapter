/**
 * 文件哈希 API 适配模块
 * 提供统一的文件哈希接口，兼容 Deno 和 Bun
 */

import { IS_BUN, IS_DENO } from "./detect.ts";
import { readFile, readFileSync } from "./file.ts";
import type { CryptoModule, RequireFunction } from "./types.ts";
// 静态导入 Node.js 模块（仅在 Bun 环境下使用）
import * as nodeCrypto from "node:crypto";

/**
 * 哈希算法类型
 */
export type HashAlgorithm = "SHA-256" | "SHA-512" | "SHA-1" | "MD5";

/**
 * 计算文件哈希值
 * @param path 文件路径
 * @param algorithm 哈希算法（默认：SHA-256）
 * @returns 文件的十六进制哈希值
 *
 * @example
 * ```typescript
 * import { hashFile } from "@dreamer/runtime-adapter";
 *
 * // 计算文件的 SHA-256 哈希
 * const hash = await hashFile("./file.txt");
 * console.log("文件哈希:", hash);
 *
 * // 使用不同的算法
 * const sha512 = await hashFile("./file.txt", "SHA-512");
 * ```
 */
export async function hashFile(
  path: string,
  algorithm: HashAlgorithm = "SHA-256",
): Promise<string> {
  // 读取文件内容
  const data = await readFile(path);

  // 使用 Web Crypto API 计算哈希
  // 创建一个新的 ArrayBuffer 来确保类型正确
  const buffer = new Uint8Array(data).buffer;
  const hashBuffer = await crypto.subtle.digest(algorithm, buffer);

  // 转换为十六进制字符串
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 计算数据的哈希值
 * @param data 数据（Uint8Array 或字符串）
 * @param algorithm 哈希算法（默认：SHA-256）
 * @returns 数据的十六进制哈希值
 *
 * @example
 * ```typescript
 * import { hash } from "@dreamer/runtime-adapter";
 *
 * // 计算字符串的哈希
 * const hash = await hash("Hello, World!");
 * console.log("哈希值:", hash);
 *
 * // 计算二进制数据的哈希
 * const data = new Uint8Array([1, 2, 3, 4, 5]);
 * const dataHash = await hash(data);
 * ```
 */
export async function hash(
  data: Uint8Array | string,
  algorithm: HashAlgorithm = "SHA-256",
): Promise<string> {
  // 如果是字符串，转换为 Uint8Array
  const bytes = typeof data === "string"
    ? new TextEncoder().encode(data)
    : data;

  // 使用 Web Crypto API 计算哈希
  // 创建一个新的 ArrayBuffer 来确保类型正确
  const buffer = new Uint8Array(bytes).buffer;
  const hashBuffer = await crypto.subtle.digest(algorithm, buffer);

  // 转换为十六进制字符串
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ==================== 同步哈希 API ====================
// 注意：这些同步 API 主要用于需要同步操作的场景
// 在可能的情况下，优先使用异步 API

/**
 * 同步计算数据的哈希值
 * @param data 数据（Uint8Array 或字符串）
 * @param algorithm 哈希算法（默认：SHA-256）
 * @returns 数据的十六进制哈希值
 * @throws 如果运行时不支持同步哈希计算，抛出错误
 *
 * @example
 * ```typescript
 * import { hashSync } from "@dreamer/runtime-adapter";
 * // Deno: 需要预先导入 node:crypto（在模块顶层）
 * // import "node:crypto";
 * const hash = hashSync("Hello, World!");
 * console.log("哈希值:", hash);
 * ```
 */
export function hashSync(
  data: Uint8Array | string,
  algorithm: HashAlgorithm = "SHA-256",
): string {
  // 如果是字符串，转换为 Uint8Array
  const bytes = typeof data === "string"
    ? new TextEncoder().encode(data)
    : data;

  // 将 HashAlgorithm 映射到 Node.js 的算法名称
  const nodeAlgorithm = algorithm === "MD5"
    ? "md5"
    : algorithm === "SHA-1"
    ? "sha1"
    : algorithm === "SHA-256"
    ? "sha256"
    : algorithm === "SHA-512"
    ? "sha512"
    : "sha256";

  // 获取 Node.js 兼容的 crypto 模块
  let crypto: CryptoModule | null = null;

  if (IS_DENO) {
    // Deno 中需要通过 globalThis.require 获取
    const requireFn =
      (globalThis as unknown as { require?: RequireFunction }).require;
    if (requireFn) {
      const cryptoModule = requireFn("node:crypto");
      if (
        cryptoModule &&
        typeof (cryptoModule as CryptoModule).createHash === "function"
      ) {
        crypto = cryptoModule as CryptoModule;
      }
    }
  } else if (IS_BUN) {
    // Bun 支持 Node.js 兼容的 crypto 模块
    crypto = nodeCrypto as unknown as CryptoModule;
  }

  if (!crypto || typeof crypto.createHash !== "function") {
    throw new Error(
      "同步哈希计算需要 node:crypto 模块。请使用异步的 hash() 方法，或确保运行时支持 Node.js 兼容模式",
    );
  }

  // 使用 crypto 模块计算哈希
  const hash = crypto.createHash(
    nodeAlgorithm as "sha256" | "sha512" | "sha1" | "md5",
  );
  hash.update(bytes);
  return hash.digest("hex");
}

/**
 * 同步计算文件哈希值
 * @param path 文件路径
 * @param algorithm 哈希算法（默认：SHA-256）
 * @returns 文件的十六进制哈希值
 * @throws 如果文件不存在或无法读取，或运行时不支持同步哈希计算，抛出错误
 *
 * @example
 * ```typescript
 * import { hashFileSync } from "@dreamer/runtime-adapter";
 * // Deno: 需要预先导入 node:crypto（在模块顶层）
 * // import "node:crypto";
 * try {
 *   const hash = hashFileSync("./file.txt");
 *   console.log("文件哈希:", hash);
 * } catch {
 *   console.log("文件读取失败");
 * }
 * ```
 */
export function hashFileSync(
  path: string,
  algorithm: HashAlgorithm = "SHA-256",
): string {
  // 使用同步读取文件
  const data = readFileSync(path);

  // 使用同步哈希计算
  return hashSync(data, algorithm);
}
