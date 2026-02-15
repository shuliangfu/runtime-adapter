/**
 * 路径操作 API 适配模块
 * 统一使用 node:path，兼容 Deno（Node 兼容层）与 Bun。
 * Windows 兼容：所有返回路径的 API 统一转为正斜杠，便于跨平台断言与字符串比较。
 */

import {
  basename as nodeBasename,
  dirname as nodeDirname,
  extname as nodeExtname,
  isAbsolute as nodeIsAbsolute,
  join as nodeJoin,
  normalize as nodeNormalize,
  relative as nodeRelative,
  resolve as nodeResolve,
} from "node:path";
import { pathToFileURL as nodePathToFileURL } from "node:url";

/** 将路径中的反斜杠统一为正斜杠（Windows 兼容，便于跨平台一致） */
function toForwardSlash(path: string): string {
  return path.replace(/\\/g, "/");
}

/**
 * 拼接路径
 * @param paths 路径片段
 * @returns 拼接后的路径
 *
 * @example
 * ```typescript
 * import { join } from "@dreamer/runtime-adapter";
 * const path = join("dir", "subdir", "file.txt");
 * // => "dir/subdir/file.txt"
 * ```
 */
export function join(...paths: string[]): string {
  return toForwardSlash(nodeJoin(...paths));
}

/**
 * 获取路径的目录名
 * @param path 路径
 * @returns 目录名
 *
 * @example
 * ```typescript
 * import { dirname } from "@dreamer/runtime-adapter";
 * const dir = dirname("/path/to/file.txt");
 * // => "/path/to"
 * ```
 */
export function dirname(path: string): string {
  return toForwardSlash(nodeDirname(path));
}

/**
 * 获取路径的文件名
 * @param path 路径
 * @param ext 可选的文件扩展名（如果提供，会从结果中移除）
 * @returns 文件名
 *
 * @example
 * ```typescript
 * import { basename } from "@dreamer/runtime-adapter";
 * const name = basename("/path/to/file.txt");
 * // => "file.txt"
 * const nameWithoutExt = basename("/path/to/file.txt", ".txt");
 * // => "file"
 * ```
 */
export function basename(path: string, ext?: string): string {
  return toForwardSlash(nodeBasename(path, ext));
}

/**
 * 获取路径的扩展名
 * @param path 路径
 * @returns 扩展名（包含点号，如 ".txt"）
 *
 * @example
 * ```typescript
 * import { extname } from "@dreamer/runtime-adapter";
 * const ext = extname("/path/to/file.txt");
 * // => ".txt"
 * ```
 */
export function extname(path: string): string {
  return toForwardSlash(nodeExtname(path));
}

/**
 * 解析路径为绝对路径
 * @param paths 路径片段
 * @returns 绝对路径
 *
 * @example
 * ```typescript
 * import { resolve } from "@dreamer/runtime-adapter";
 * const absPath = resolve("dir", "file.txt");
 * // => "/current/working/dir/dir/file.txt"
 * ```
 */
export function resolve(...paths: string[]): string {
  return toForwardSlash(nodeResolve(...paths));
}

/**
 * 计算从 from 到 to 的相对路径
 * @param from 起始路径
 * @param to 目标路径
 * @returns 相对路径
 *
 * @example
 * ```typescript
 * import { relative } from "@dreamer/runtime-adapter";
 * const rel = relative("/path/to/from", "/path/to/to/file.txt");
 * // => "../to/file.txt"
 * ```
 */
export function relative(from: string, to: string): string {
  // 非 Windows 上 node 不识别盘符，relative("C:/a", "D:/b") 会得到 "../../../D:/b"；
  // 为了一致地「跨盘符即返回目标路径」，这里先判断再交给 nodeRelative。
  const fromNorm = toForwardSlash(from);
  const toNorm = toForwardSlash(to);
  const winAbs = /^([A-Za-z]):\//;
  const fromDrive = fromNorm.match(winAbs)?.[1]?.toLowerCase();
  const toDrive = toNorm.match(winAbs)?.[1]?.toLowerCase();
  if (fromDrive && toDrive && fromDrive !== toDrive) {
    return toNorm;
  }
  const result = toForwardSlash(nodeRelative(from, to));
  return result === "" ? "." : result;
}

/**
 * 规范化路径
 * 处理 `.` 和 `..` 路径段，规范化多个斜杠
 * @param path 路径
 * @returns 规范化后的路径
 *
 * @example
 * ```typescript
 * import { normalize } from "@dreamer/runtime-adapter";
 * const path = normalize("/path/to/../from/./file.txt");
 * // => "/path/from/file.txt"
 * ```
 */
export function normalize(path: string): string {
  return toForwardSlash(nodeNormalize(path));
}

/**
 * 判断是否为绝对路径
 * @param path 路径
 * @returns 是否为绝对路径
 *
 * @example
 * ```typescript
 * import { isAbsolute } from "@dreamer/runtime-adapter";
 * isAbsolute("/path/to/file"); // => true
 * isAbsolute("C:/path/to/file"); // => true (Windows)
 * isAbsolute("./file"); // => false
 * ```
 */
export function isAbsolute(path: string): boolean {
  const normalized = toForwardSlash(path);
  return nodeIsAbsolute(normalized) || /^[A-Za-z]:\//.test(normalized);
}

/**
 * 判断是否为相对路径
 * @param path 路径
 * @returns 是否为相对路径
 *
 * @example
 * ```typescript
 * import { isRelative } from "@dreamer/runtime-adapter";
 * isRelative("./file"); // => true
 * isRelative("../file"); // => true
 * isRelative("/path/to/file"); // => false
 * ```
 */
export function isRelative(path: string): boolean {
  return !isAbsolute(path);
}

/**
 * 将文件系统路径转为 file:// URL
 *
 * 用于动态 import() 时正确编码路径中的特殊字符（空格、#、? 等），
 * 确保 Deno 和 Bun 在 Windows 等平台下正确解析。
 *
 * @param path 文件系统路径（绝对或相对）
 * @returns file:// URL 字符串（.href 格式）
 *
 * @example
 * ```typescript
 * import { pathToFileUrl } from "@dreamer/runtime-adapter";
 * const url = pathToFileUrl("/home/user/config.ts");
 * // => "file:///home/user/config.ts"
 * const mod = await import(url);
 * ```
 */
export function pathToFileUrl(path: string): string {
  return nodePathToFileURL(path).href;
}
