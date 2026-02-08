/**
 * 路径操作 API 适配模块
 * 提供统一的路径操作接口，兼容 Deno 和 Bun
 */

import { pathToFileURL as nodePathToFileURL } from "node:url";
import { IS_BUN } from "./detect.ts";
import { getDeno, getProcess } from "./utils.ts";

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
    // 单个路径也需要规范化：Windows 反斜杠转正斜杠，合并多个斜杠
    return filteredPaths[0].replace(/\\/g, "/").replace(/\/+/g, "/");
  }

  // 处理第一个路径（可能包含协议或绝对路径）
  // Windows 兼容：先将反斜杠转为正斜杠
  let result = filteredPaths[0].replace(/\\/g, "/").replace(/\/+$/, ""); // 移除末尾斜杠

  // 拼接后续路径
  for (let i = 1; i < filteredPaths.length; i++) {
    const path = filteredPaths[i].replace(/\\/g, "/").replace(/^\/+/, ""); // 移除开头斜杠
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

  // Windows 兼容：先将反斜杠转为正斜杠
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, ""); // 移除末尾斜杠
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
  // Windows 兼容：先将反斜杠转为正斜杠
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, ""); // 移除末尾斜杠
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
  const deno = getDeno();
  if (deno) {
    try {
      base = deno.cwd();
    } catch {
      base = ".";
    }
  } else if (IS_BUN) {
    const process = getProcess();
    base = process?.cwd() || ".";
  }

  // 如果第一个路径是绝对路径，直接使用
  // Unix 绝对路径：以 / 开头
  if (paths.length > 0 && paths[0].startsWith("/")) {
    return join(...paths);
  }

  // Windows 绝对路径：如 C:\path 或 C:/path
  if (paths.length > 0 && /^[A-Za-z]:[\\/]/.test(paths[0])) {
    return join(...paths);
  }

  return join(base, ...paths);
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
  // 规范化路径（Windows 兼容：反斜杠转正斜杠，移除末尾斜杠，处理多个斜杠）
  const normalize = (path: string): string[] => {
    return path.replace(/\\/g, "/").replace(/\/+$/, "").replace(/\/+/g, "/")
      .split("/").filter(Boolean);
  };

  const fromParts = normalize(from);
  const toParts = normalize(to);

  // Windows 跨盘符：C:\a\b 与 D:\x\y 无法用相对路径表示，返回 to 的规范化路径
  const fromDrive = fromParts[0];
  const toDrive = toParts[0];
  if (
    fromDrive &&
    toDrive &&
    /^[A-Za-z]:$/.test(fromDrive) &&
    /^[A-Za-z]:$/.test(toDrive) &&
    fromDrive.toUpperCase() !== toDrive.toUpperCase()
  ) {
    return join(...toParts);
  }

  // 找到共同的前缀
  let commonLength = 0;
  const minLength = Math.min(fromParts.length, toParts.length);
  while (
    commonLength < minLength &&
    fromParts[commonLength] === toParts[commonLength]
  ) {
    commonLength++;
  }

  // 计算需要向上多少级
  const upLevels = fromParts.length - commonLength;

  // 构建相对路径
  const relativeParts: string[] = [];

  // 添加向上级别的路径（..）
  for (let i = 0; i < upLevels; i++) {
    relativeParts.push("..");
  }

  // 添加目标路径的剩余部分
  relativeParts.push(...toParts.slice(commonLength));

  // 如果没有相对路径，返回 "."
  if (relativeParts.length === 0) {
    return ".";
  }

  return join(...relativeParts);
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
  if (path === "" || path === ".") {
    return ".";
  }

  // 处理 Windows 路径分隔符（转换为 Unix 风格）
  let normalized = path.replace(/\\/g, "/");

  // 判断是否为绝对路径
  const isAbs = normalized.startsWith("/");
  const isWindowsAbs = /^[A-Za-z]:/.test(normalized);

  // 移除开头的斜杠（稍后恢复）
  if (isAbs) {
    normalized = normalized.substring(1);
  }

  // 处理 Windows 绝对路径（如 C:/path/to/file）
  let windowsDrive = "";
  if (isWindowsAbs) {
    const match = normalized.match(/^([A-Za-z]:)(.*)$/);
    if (match) {
      windowsDrive = match[1];
      normalized = match[2];
    }
  }

  // 分割路径段
  const parts = normalized.split("/").filter((part) => part !== "");

  // 处理 . 和 ..
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === ".") {
      // 忽略当前目录
      continue;
    } else if (part === "..") {
      // 向上级目录
      if (resolved.length > 0 && resolved[resolved.length - 1] !== "..") {
        resolved.pop();
      } else if (!isAbs && !isWindowsAbs) {
        // 相对路径中保留 ..
        resolved.push("..");
      }
    } else {
      resolved.push(part);
    }
  }

  // 重新组合路径
  let result = resolved.join("/");

  // 恢复绝对路径前缀
  if (isAbs) {
    result = "/" + result;
  } else if (isWindowsAbs) {
    result = windowsDrive + (result ? "/" + result : "");
  }

  // 处理根目录和空路径
  if (result === "") {
    return isAbs || isWindowsAbs
      ? (isWindowsAbs ? windowsDrive + "/" : "/")
      : ".";
  }

  // 规范化多个斜杠
  result = result.replace(/\/+/g, "/");

  return result;
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
  // Unix 绝对路径
  if (path.startsWith("/")) {
    return true;
  }

  // Windows 绝对路径（如 C:\path 或 C:/path）
  if (/^[A-Za-z]:[\\/]/.test(path)) {
    return true;
  }

  return false;
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
