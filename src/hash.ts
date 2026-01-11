/**
 * 文件哈希 API 适配模块
 * 提供统一的文件哈希接口，兼容 Deno 和 Bun
 */

import { readFile } from "./file.ts";

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
