/**
 * 文件哈希 API 适配模块
 * 统一使用 node:crypto，Deno 与 Bun 均兼容
 */

import { readFile, readFileSync } from "./file.ts";
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
  const data = await readFile(path);
  return hash(data, algorithm);
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
export function hash(
  data: Uint8Array | string,
  algorithm: HashAlgorithm = "SHA-256",
): Promise<string> {
  return Promise.resolve(hashSync(data, algorithm));
}

// ==================== 同步哈希 API ====================
// 注意：这些同步 API 主要用于需要同步操作的场景
// 在可能的情况下，优先使用异步 API

/**
 * 同步计算数据的哈希值（内部使用 node:crypto，Deno/Bun 均兼容）
 * @param data 数据（Uint8Array 或字符串）
 * @param algorithm 哈希算法（默认：SHA-256）
 * @returns 数据的十六进制哈希值
 *
 * @example
 * ```typescript
 * import { hashSync } from "@dreamer/runtime-adapter";
 * const hash = hashSync("Hello, World!");
 * console.log("哈希值:", hash);
 * ```
 */
/** 将 HashAlgorithm 映射为 node:crypto 的算法名 */
function toNodeAlgorithm(
  algorithm: HashAlgorithm,
): "md5" | "sha1" | "sha256" | "sha512" {
  switch (algorithm) {
    case "MD5":
      return "md5";
    case "SHA-1":
      return "sha1";
    case "SHA-256":
      return "sha256";
    case "SHA-512":
      return "sha512";
    default:
      return "sha256";
  }
}

export function hashSync(
  data: Uint8Array | string,
  algorithm: HashAlgorithm = "SHA-256",
): string {
  const bytes = typeof data === "string"
    ? new TextEncoder().encode(data)
    : data;
  const nodeAlgorithm = toNodeAlgorithm(algorithm);
  const h = nodeCrypto.createHash(nodeAlgorithm);
  h.update(bytes);
  return h.digest("hex");
}

/**
 * 同步计算文件哈希值（内部使用 node:crypto，Deno/Bun 均兼容）
 * @param path 文件路径
 * @param algorithm 哈希算法（默认：SHA-256）
 * @returns 文件的十六进制哈希值
 * @throws 如果文件不存在或无法读取则抛出错误
 *
 * @example
 * ```typescript
 * import { hashFileSync } from "@dreamer/runtime-adapter";
 * const hash = hashFileSync("./file.txt");
 * console.log("文件哈希:", hash);
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
