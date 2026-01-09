/**
 * 路径操作 API 适配模块
 * 提供统一的路径操作接口，兼容 Deno 和 Bun
 */

import { IS_BUN, IS_DENO } from "./detect.ts";

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
  if (paths.length === 0) return ".";

  // 过滤空字符串（空字符串被视为当前目录，在 join 中通常被忽略）
  const filteredPaths = paths.filter((p) => p !== "");

  if (filteredPaths.length === 0) return ".";
  if (filteredPaths.length === 1) {
    // 单个路径也需要规范化多个斜杠
    return filteredPaths[0].replace(/\/+/g, "/");
  }

  // 处理第一个路径（可能包含协议或绝对路径）
  let result = filteredPaths[0].replace(/\/+$/, ""); // 移除末尾斜杠

  // 拼接后续路径
  for (let i = 1; i < filteredPaths.length; i++) {
    const path = filteredPaths[i].replace(/^\/+/, ""); // 移除开头斜杠
    if (path) {
      result += `/${path}`;
    }
  }

  // 规范化路径（合并多个斜杠）
  return result.replace(/\/+/g, "/");
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
  // 处理根目录的特殊情况
  if (path === "/" || path === "") {
    return path === "/" ? "/" : ".";
  }

  const normalized = path.replace(/\/+$/, ""); // 移除末尾斜杠
  // 如果移除斜杠后变成空字符串，说明是根目录
  if (normalized === "") {
    return "/";
  }

  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash === -1) return ".";
  if (lastSlash === 0) return "/";
  return normalized.substring(0, lastSlash);
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
  const normalized = path.replace(/\/+$/, ""); // 移除末尾斜杠
  const lastSlash = normalized.lastIndexOf("/");
  let name = lastSlash === -1
    ? normalized
    : normalized.substring(lastSlash + 1);

  if (ext && name.endsWith(ext)) {
    name = name.substring(0, name.length - ext.length);
  }

  return name;
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
  const name = basename(path);
  const lastDot = name.lastIndexOf(".");
  if (lastDot === -1 || lastDot === 0) return "";
  return name.substring(lastDot);
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
  // 获取当前工作目录
  let base = ".";
  if (IS_DENO) {
    try {
      base = (globalThis as any).Deno.cwd();
    } catch {
      base = ".";
    }
  } else if (IS_BUN) {
    base = (globalThis as any).process?.cwd() || ".";
  }

  // 如果第一个路径是绝对路径，直接使用
  if (paths.length > 0 && paths[0].startsWith("/")) {
    return join(...paths);
  }

  return join(base, ...paths);
}
