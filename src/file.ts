/**
 * 文件系统 API 适配模块
 * 提供统一的文件系统操作接口，兼容 Deno 和 Bun
 */

import { IS_BUN } from "./detect.ts";
import { dirname, join, resolve } from "./path.ts";
import { getBuffer, getBun, getDeno, getProcess } from "./utils.ts";
// 静态导入 Node.js 模块（仅在 Bun 环境下使用）
import * as nodeCrypto from "node:crypto";
import * as nodeFs from "node:fs";
import * as nodeFsPromises from "node:fs/promises";
import * as nodeOs from "node:os";

/**
 * 文件打开选项
 */
export interface FileOpenOptions {
  read?: boolean;
  write?: boolean;
  append?: boolean;
  truncate?: boolean;
  create?: boolean;
  createNew?: boolean;
}

/**
 * 文件信息
 */
export interface FileInfo {
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
  size: number;
  mtime: Date | null;
  atime: Date | null;
  birthtime: Date | null;
  mode: number | null;
  dev: number | null;
  ino: number | null;
  nlink: number | null;
  uid: number | null;
  gid: number | null;
  rdev: number | null;
  blksize: number | null;
  blocks: number | null;
}

/**
 * 文件监控事件类型
 */
export type FileEventType = "create" | "modify" | "remove";

/**
 * 文件监控事件
 */
export interface FileEvent {
  kind: FileEventType;
  paths: string[];
}

/**
 * 文件监控器接口
 */
export interface FileWatcher {
  close(): void;
  [Symbol.asyncIterator](): AsyncIterableIterator<FileEvent>;
}

/**
 * 读取文件内容
 * @param path 文件路径
 * @returns 文件内容（Uint8Array）
 */
export async function readFile(path: string): Promise<Uint8Array> {
  const deno = getDeno();
  if (deno) {
    return await deno.readFile(path);
  }

  const bun = getBun();
  if (bun) {
    const file = bun.file(path);
    const arrayBuffer = await file.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 读取文本文件内容
 * @param path 文件路径
 * @param _encoding 编码格式（默认：utf-8，Bun 自动处理）
 * @returns 文件内容（字符串）
 */
export async function readTextFile(
  path: string,
  _encoding = "utf-8",
): Promise<string> {
  const deno = getDeno();
  if (deno) {
    return await deno.readTextFile(path, { encoding: _encoding });
  }

  const bun = getBun();
  if (bun) {
    const file = bun.file(path);
    return await file.text();
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 写入文件内容
 * @param path 文件路径
 * @param data 文件内容
 * @param options 写入选项
 */
export async function writeFile(
  path: string,
  data: Uint8Array,
  options?: { create?: boolean; mode?: number },
): Promise<void> {
  const deno = getDeno();
  if (deno) {
    await deno.writeFile(path, data, options);
    return;
  }

  const bun = getBun();
  if (bun) {
    // Bun 使用原生高性能 API
    await bun.write(path, data);
    // 验证文件确实写入成功（处理文件系统同步延迟）
    // 优化：减少重试次数，提高性能
    let retries = 5; // 从 10 次减少到 5 次
    while (retries > 0) {
      try {
        const file = bun.file(path);
        const exists = await file.exists();
        if (exists) {
          // 验证文件大小匹配（确保数据完整写入）
          const arrayBuffer = await file.arrayBuffer();
          if (arrayBuffer.byteLength === data.byteLength) {
            return;
          }
        }
      } catch {
        // 文件可能还没同步，继续等待
      }
      retries--;
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
    return;
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 写入文本文件内容
 * @param path 文件路径
 * @param data 文本内容
 * @param options 写入选项
 */
export async function writeTextFile(
  path: string,
  data: string,
  options?: { create?: boolean; mode?: number },
): Promise<void> {
  const deno = getDeno();
  if (deno) {
    await deno.writeTextFile(path, data, options);
    return;
  }

  const bun = getBun();
  if (bun) {
    // Bun 使用原生高性能 API
    await bun.write(path, data);
    // 验证文件确实写入成功（处理文件系统同步延迟）
    // 优化：减少重试次数，提高性能
    let retries = 5; // 从 10 次减少到 5 次
    while (retries > 0) {
      try {
        const file = bun.file(path);
        const exists = await file.exists();
        if (exists) {
          // 验证文件内容匹配（确保数据完整写入）
          const text = await file.text();
          if (text === data) {
            return;
          }
        }
      } catch {
        // 文件可能还没同步，继续等待
      }
      retries--;
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
    return;
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 打开文件
 * @param path 文件路径
 * @param options 打开选项
 * @returns 文件句柄
 */
export async function open(
  path: string,
  options?: FileOpenOptions,
): Promise<
  {
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;
    close(): void;
  }
> {
  const deno = getDeno();
  if (deno) {
    const file = await deno.open(path, options);
    return {
      readable: file.readable,
      writable: file.writable,
      close: () => file.close(),
    };
  }

  const bun = getBun();
  if (bun) {
    // Bun 使用不同的方式打开文件
    const file = bun.file(path);
    return {
      readable: file.stream(),
      writable: new WritableStream({
        async write(chunk) {
          // Bun 需要追加写入
          const existing = await file.arrayBuffer().catch(() =>
            new ArrayBuffer(0)
          );
          const combined = new Uint8Array(existing.byteLength + chunk.length);
          combined.set(new Uint8Array(existing), 0);
          combined.set(chunk, existing.byteLength);
          // Bun 使用原生高性能 API
          await bun.write(path, combined);
        },
        close() {
          // Bun 文件写入完成
        },
      }),
      close: () => {
        // Bun 不需要显式关闭
      },
    };
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 创建文件
 * @param path 文件路径
 * @returns 文件句柄
 */
export async function create(
  path: string,
): Promise<
  {
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;
    close(): void;
  }
> {
  return await open(path, { create: true, write: true, truncate: true });
}

/**
 * 创建目录
 * @param path 目录路径
 * @param options 创建选项
 */
export async function mkdir(
  path: string,
  options?: { recursive?: boolean; mode?: number },
): Promise<void> {
  const deno = getDeno();
  if (deno) {
    await deno.mkdir(path, options);
    return;
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的 fs API
    try {
      await nodeFsPromises.mkdir(path, {
        recursive: options?.recursive,
        mode: options?.mode,
      });
    } catch (error: unknown) {
      // 如果目录已存在且 recursive 为 true，忽略错误
      // Bun 在某些情况下会抛出 EINVAL 错误，即使 recursive: true
      const err = error as { code?: string };
      if (err?.code === "EEXIST" || err?.code === "EINVAL") {
        // 检查目录是否真的存在
        try {
          const info = await nodeFsPromises.stat(path);
          if (info.isDirectory()) {
            // 目录已存在，这是正常的
            return;
          }
        } catch {
          // stat 失败，说明目录不存在，重新抛出原始错误
        }
      }
      // 其他错误继续抛出
      throw error;
    }
    return;
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 确保目录存在（如果不存在则创建，如果已存在则不做任何操作）
 * 类似于 mkdir -p 命令
 * @param path 目录路径
 * @param options 创建选项（mode 用于设置目录权限）
 * @throws 如果目录创建失败，抛出错误
 *
 * @example
 * ```typescript
 * import { ensureDir } from "@dreamer/runtime-adapter";
 * await ensureDir("./path/to/dir");
 * ```
 */
export async function ensureDir(
  path: string,
  options?: { mode?: number },
): Promise<void> {
  // ensureDir 就是 mkdir 的 recursive: true 的封装
  await mkdir(path, { recursive: true, mode: options?.mode });
}

/**
 * 删除文件或目录
 * @param path 路径
 * @param options 删除选项
 */
export async function remove(
  path: string,
  options?: { recursive?: boolean },
): Promise<void> {
  const deno = getDeno();
  if (deno) {
    await deno.remove(path, options);
    return;
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的 fs API
    try {
      const stats = await nodeFsPromises.stat(path);
      if (stats.isDirectory()) {
        await nodeFsPromises.rm(path, { recursive: options?.recursive });
      } else {
        await nodeFsPromises.unlink(path);
      }
    } catch (error) {
      if ((error as { code?: string }).code !== "ENOENT") {
        throw error;
      }
    }
    return;
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 获取文件信息
 * @param path 文件路径
 * @returns 文件信息
 */
export async function stat(path: string): Promise<FileInfo> {
  const deno = getDeno();
  if (deno) {
    const info = await deno.stat(path);
    return {
      isFile: info.isFile,
      isDirectory: info.isDirectory,
      isSymlink: info.isSymlink,
      size: info.size,
      mtime: info.mtime,
      atime: info.atime,
      birthtime: info.birthtime,
      mode: info.mode ?? null,
      dev: info.dev ?? null,
      ino: info.ino ?? null,
      nlink: info.nlink ?? null,
      uid: info.uid ?? null,
      gid: info.gid ?? null,
      rdev: info.rdev ?? null,
      blksize: info.blksize ?? null,
      blocks: info.blocks ?? null,
    };
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的 fs API
    const info = await nodeFsPromises.stat(path);
    return {
      isFile: info.isFile(),
      isDirectory: info.isDirectory(),
      isSymlink: info.isSymbolicLink(),
      size: info.size,
      mtime: info.mtime,
      atime: info.atime,
      birthtime: info.birthtime,
      mode: info.mode,
      dev: info.dev,
      ino: info.ino,
      nlink: info.nlink,
      uid: info.uid,
      gid: info.gid,
      rdev: info.rdev,
      blksize: info.blksize,
      blocks: info.blocks,
    };
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 文件监控选项
 */
export interface WatchFsOptions {
  /** 是否递归监控子目录（默认：false） */
  recursive?: boolean;
  /** 是否只监听文件，排除目录（默认：false） */
  filesOnly?: boolean;
  /** 排除的路径（支持字符串或正则表达式，匹配路径中包含这些字符串或匹配正则的路径将被排除） */
  exclude?: (string | RegExp)[];
}

/**
 * 检查路径是否应该被排除
 * @param path 要检查的路径
 * @param exclude 排除规则数组
 * @returns 如果路径应该被排除，返回 true
 */
function shouldExcludePath(
  path: string,
  exclude?: (string | RegExp)[],
): boolean {
  if (!exclude || exclude.length === 0) {
    return false;
  }

  for (const rule of exclude) {
    if (typeof rule === "string") {
      // 字符串匹配：检查路径中是否包含该字符串
      if (path.includes(rule)) {
        return true;
      }
    } else if (rule instanceof RegExp) {
      // 正则表达式匹配
      if (rule.test(path)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 监控文件系统变化
 * @param paths 要监控的路径（可以是文件或目录）
 * @param options 监控选项
 * @returns 文件监控器
 */
export function watchFs(
  paths: string | string[],
  options?: WatchFsOptions,
): FileWatcher {
  const deno = getDeno();
  if (deno) {
    const pathArray = Array.isArray(paths) ? paths : [paths];
    const watcher = deno.watchFs(pathArray, {
      recursive: options?.recursive ?? false,
    });
    const filesOnly = options?.filesOnly ?? false;

    // 转换 Deno 的事件类型为统一格式
    return {
      close() {
        watcher.close();
      },
      async *[Symbol.asyncIterator](): AsyncIterableIterator<FileEvent> {
        for await (const event of watcher) {
          const filteredPaths: string[] = [];

          for (const path of event.paths) {
            // 检查是否应该排除该路径
            if (shouldExcludePath(path, options?.exclude)) {
              continue;
            }

            // 如果设置了只监听文件，过滤掉目录事件
            if (filesOnly) {
              try {
                const info = await deno.stat(path);
                // 只包含文件，排除目录
                if (info.isFile) {
                  filteredPaths.push(path);
                }
              } catch {
                // 如果 stat 失败（可能是文件被删除），根据事件类型决定
                // 对于 remove 事件，保留路径（可能是文件被删除）
                if (event.kind === "remove") {
                  filteredPaths.push(path);
                }
                // 对于 create/modify 事件，如果 stat 失败，可能是目录，跳过
              }
            } else {
              filteredPaths.push(path);
            }
          }

          // 如果过滤后没有路径，跳过该事件
          if (filteredPaths.length === 0) {
            continue;
          }

          yield {
            kind: event.kind === "create"
              ? "create"
              : event.kind === "modify"
              ? "modify"
              : "remove",
            paths: filteredPaths,
          };
        }
      },
    };
  }

  if (IS_BUN) {
    // Bun 环境下的文件监控使用 Node.js 的 fs.watch API
    const pathArray = Array.isArray(paths) ? paths : [paths];

    // 存储所有 watcher 实例，用于关闭
    const watchers: Array<{ close: () => void }> = [];
    // 事件队列
    const eventQueue: FileEvent[] = [];
    // 事件解析器队列
    const resolvers: Array<(event: FileEvent) => void> = [];
    // 是否已关闭
    let closed = false;
    // 初始化 Promise，确保 watchers 正确初始化
    let initPromise: Promise<void> | null = null;

    // 初始化函数
    const initWatchers = (): Promise<void> => {
      if (initPromise) {
        return initPromise;
      }

      initPromise = (async () => {
        // 为每个路径创建 watcher
        for (const path of pathArray) {
          const resolvedPath = resolve(path);
          let lastEventType: string | null = null;
          let lastEventTime = 0;
          const debounceTime = 100; // 防抖时间（毫秒）

          // 检查路径是否存在，以确定初始状态
          let pathExists = false;
          try {
            const info = await nodeFsPromises.stat(resolvedPath);
            pathExists = info.isFile() || info.isDirectory();
          } catch {
            pathExists = false;
          }

          // 路径不存在时不调用 fs.watch，避免 Node/Bun 上抛出 ENOENT
          if (!pathExists) {
            watchers.push({ close: () => {} });
            continue;
          }

          const watcher = nodeFs.watch(
            resolvedPath,
            { recursive: options?.recursive ?? false },
            async (eventType, filename) => {
              if (closed) return;

              const now = Date.now();
              const fullPath = filename
                ? resolve(resolvedPath, filename)
                : resolvedPath;

              // 防抖处理：相同事件在短时间内只触发一次
              if (
                lastEventType === eventType &&
                now - lastEventTime < debounceTime
              ) {
                return;
              }

              lastEventType = eventType;
              lastEventTime = now;

              // 确定事件类型
              let kind: FileEventType;
              let isFile = false;
              try {
                const currentExists = await nodeFsPromises.stat(fullPath).then(
                  () => true,
                  () => false,
                );

                if (currentExists) {
                  // 检查是文件还是目录
                  const info = await nodeFsPromises.stat(fullPath);
                  isFile = Boolean(info.isFile);
                }

                if (eventType === "rename") {
                  // rename 事件可能是创建或删除
                  if (currentExists && !pathExists) {
                    kind = "create";
                  } else if (!currentExists && pathExists) {
                    kind = "remove";
                  } else {
                    // 可能是文件被重命名，当作 modify 处理
                    kind = "modify";
                  }
                  pathExists = currentExists;
                } else {
                  // change 事件是修改
                  kind = "modify";
                }
              } catch {
                // 如果无法确定，使用默认类型
                kind = eventType === "rename" ? "remove" : "modify";
                // 对于 remove 事件，无法 stat，假设是文件（保留事件）
                if (kind === "remove") {
                  isFile = true;
                }
              }

              // 检查是否应该排除该路径
              if (shouldExcludePath(fullPath, options?.exclude)) {
                return;
              }

              // 如果设置了只监听文件，且当前路径是目录，跳过该事件
              if (options?.filesOnly && !isFile && kind !== "remove") {
                return;
              }

              const fileEvent: FileEvent = {
                kind,
                paths: [fullPath],
              };

              // 如果有等待的解析器，立即解析
              if (resolvers.length > 0) {
                const resolver = resolvers.shift()!;
                resolver(fileEvent);
              } else {
                // 否则加入队列
                eventQueue.push(fileEvent);
              }
            },
          );

          watchers.push(watcher);

          // 处理 watcher 错误
          watcher.on("error", () => {
            // 错误事件也作为事件处理
            const errorEvent: FileEvent = {
              kind: "modify",
              paths: [resolvedPath],
            };
            if (resolvers.length > 0) {
              const resolver = resolvers.shift()!;
              resolver(errorEvent);
            } else {
              eventQueue.push(errorEvent);
            }
          });
        }
      })();

      return initPromise;
    };

    // 立即开始初始化（不等待）
    initWatchers();

    return {
      close() {
        if (closed) return;
        closed = true;
        // 关闭所有 watcher
        for (const watcher of watchers) {
          watcher.close();
        }
        // 解析所有等待的解析器（使用空事件）
        while (resolvers.length > 0) {
          const resolver = resolvers.shift()!;
          resolver({
            kind: "modify",
            paths: [],
          });
        }
      },
      async *[Symbol.asyncIterator](): AsyncIterableIterator<FileEvent> {
        // 确保 watchers 已初始化
        await initWatchers();

        while (!closed) {
          // 如果队列中有事件，直接返回
          if (eventQueue.length > 0) {
            yield eventQueue.shift()!;
            continue;
          }

          // 否则等待新事件
          const event = await new Promise<FileEvent>((resolve) => {
            resolvers.push(resolve);
          });

          // 如果已关闭，停止迭代
          if (closed) {
            break;
          }

          yield event;
        }
      },
    };
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 目录项信息
 */
export interface DirEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
}

/**
 * 读取目录内容
 * @param path 目录路径
 * @returns 目录项数组
 */
export async function readdir(path: string): Promise<DirEntry[]> {
  const deno = getDeno();
  if (deno) {
    const entries: DirEntry[] = [];
    for await (const entry of deno.readDir(path)) {
      entries.push({
        name: entry.name,
        isFile: entry.isFile,
        isDirectory: entry.isDirectory,
        isSymlink: entry.isSymlink,
      });
    }
    return entries;
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的 fs API
    try {
      // 先验证目录存在
      const dirInfo = await nodeFsPromises.stat(path);
      if (!dirInfo.isDirectory()) {
        throw new Error(`路径 ${path} 不是目录`);
      }

      const entries = await nodeFsPromises.readdir(path, {
        withFileTypes: true,
      });
      return entries.map((entry) => ({
        name: entry.name,
        isFile: entry.isFile(),
        isDirectory: entry.isDirectory(),
        isSymlink: entry.isSymbolicLink(),
      }));
    } catch (error: unknown) {
      const nodeError = error as { code?: string };
      if (nodeError?.code === "ENOENT") {
        throw new Error(`目录不存在: ${path}`);
      }
      throw error;
    }
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 复制文件
 * @param src 源文件路径
 * @param dest 目标文件路径
 */
export async function copyFile(
  src: string,
  dest: string,
): Promise<void> {
  const deno = getDeno();
  if (deno) {
    await deno.copyFile(src, dest);
    return;
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的 fs API
    await nodeFsPromises.copyFile(src, dest);
    return;
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 重命名或移动文件/目录
 * @param oldPath 旧路径
 * @param newPath 新路径
 */
export async function rename(
  oldPath: string,
  newPath: string,
): Promise<void> {
  const deno = getDeno();
  if (deno) {
    await deno.rename(oldPath, newPath);
    return;
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的 fs API
    try {
      // 确保目标目录存在
      const destDir = dirname(newPath);
      try {
        await nodeFsPromises.mkdir(destDir, { recursive: true });
      } catch (error: unknown) {
        // 如果目录已存在，忽略错误
        const nodeError = error as { code?: string };
        if (nodeError?.code !== "EEXIST" && nodeError?.code !== "EINVAL") {
          throw error;
        }
        // 验证目录确实存在
        try {
          const dirInfo = await nodeFsPromises.stat(destDir);
          if (!dirInfo.isDirectory()) {
            throw new Error(`路径 ${destDir} 不是目录`);
          }
        } catch {
          // 如果 stat 失败，重新抛出原始错误
          throw error;
        }
      }

      // 验证源文件/目录存在（重试机制，处理文件系统同步延迟）
      let retries = 50;
      let sourceExists = false;
      while (retries > 0 && !sourceExists) {
        try {
          const sourceInfo = await nodeFsPromises.stat(oldPath);
          // 验证确实是文件或目录（FileInfo 接口使用 isFile 和 isDirectory 布尔属性）
          const isFile = Boolean(sourceInfo.isFile);
          const isDirectory = Boolean(sourceInfo.isDirectory);
          if (isFile || isDirectory) {
            sourceExists = true;
          } else {
            throw new Error(`源路径存在但不是文件或目录: ${oldPath}`);
          }
        } catch (error: unknown) {
          const nodeError = error as { code?: string };
          if (nodeError?.code === "ENOENT") {
            retries--;
            if (retries > 0) {
              // 等待文件系统同步（增加等待时间）
              await new Promise((resolve) => setTimeout(resolve, 50));
            } else {
              throw new Error(`源路径不存在: ${oldPath}`);
            }
          } else {
            throw error;
          }
        }
      }

      // 执行重命名
      await nodeFsPromises.rename(oldPath, newPath);
    } catch (error: unknown) {
      // 提供更详细的错误信息
      const nodeError = error as { code?: string };
      if (nodeError?.code === "ENOENT") {
        throw new Error(
          `重命名失败: 源路径不存在 "${oldPath}" 或目标目录不存在 "${
            dirname(newPath)
          }"`,
        );
      }
      throw error;
    }
    return;
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 创建符号链接
 * @param target 目标路径
 * @param path 符号链接路径
 * @param type 符号链接类型（仅 Windows 需要）
 */
export async function symlink(
  target: string,
  path: string,
  type?: "file" | "dir",
): Promise<void> {
  const deno = getDeno();
  if (deno) {
    // Deno.symlink 的签名：symlink(target, path, options?)
    // options 可以是 { type: "file" | "dir" } 或直接是 type 字符串
    if (type) {
      await deno.symlink(target, path, { type });
    } else {
      await deno.symlink(target, path);
    }
    return;
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的 fs API
    await nodeFsPromises.symlink(target, path, type);
    return;
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 获取真实路径（解析符号链接）
 * @param path 路径
 * @returns 真实路径
 */
export async function realPath(path: string): Promise<string> {
  const deno = getDeno();
  if (deno) {
    return await deno.realPath(path);
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的 fs API
    return await nodeFsPromises.realpath(path);
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 修改文件权限
 * @param path 文件路径
 * @param mode 权限模式（八进制数字，如 0o755）
 */
export async function chmod(path: string, mode: number): Promise<void> {
  const deno = getDeno();
  if (deno) {
    await deno.chmod(path, mode);
    return;
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的 fs API
    await nodeFsPromises.chmod(path, mode);
    return;
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 修改文件所有者
 * @param path 文件路径
 * @param uid 用户 ID
 * @param gid 组 ID
 */
export async function chown(
  path: string,
  uid: number,
  gid: number,
): Promise<void> {
  const deno = getDeno();
  if (deno) {
    await deno.chown(path, uid, gid);
    return;
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的 fs API
    await nodeFsPromises.chown(path, uid, gid);
    return;
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 创建临时目录
 * @param options 选项
 * @param options.prefix 目录名前缀
 * @param options.dir 临时目录的父目录
 * @returns 临时目录路径
 */
export async function makeTempDir(
  options?: { prefix?: string; dir?: string },
): Promise<string> {
  const deno = getDeno();
  if (deno) {
    return await deno.makeTempDir(options);
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的 fs API
    const tmpDir = options?.dir || nodeOs.tmpdir();
    const prefix = options?.prefix || "tmp-";
    // mkdtemp 需要 XXXXXX 占位符，会被替换为随机字符
    const template = join(tmpDir, prefix + "XXXXXX");

    const tempDirPath = await nodeFsPromises.mkdtemp(template);
    return tempDirPath;
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 创建临时文件
 * @param options 选项
 * @param options.prefix 文件名前缀
 * @param options.suffix 文件名后缀
 * @param options.dir 临时文件的父目录
 * @returns 临时文件路径
 */
export async function makeTempFile(
  options?: { prefix?: string; suffix?: string; dir?: string },
): Promise<string> {
  const deno = getDeno();
  if (deno) {
    return await deno.makeTempFile(options);
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的 fs API
    const tmpDir = options?.dir || nodeOs.tmpdir();
    const prefix = options?.prefix || "tmp-";
    const suffix = options?.suffix || "";

    // 生成随机文件名
    const randomStr = nodeCrypto.randomBytes(6).toString("hex");
    const tempFile = join(tmpDir, `${prefix}${randomStr}${suffix}`);

    // 创建空文件
    await nodeFsPromises.writeFile(tempFile, "");

    return tempFile;
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 获取当前工作目录
 * @returns 当前工作目录路径
 */
export function cwd(): string {
  const deno = getDeno();
  if (deno) {
    return deno.cwd();
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的 process API
    const process = getProcess();
    if (process?.cwd) {
      return process.cwd();
    }
    // 如果 process.cwd 不可用，使用 path.resolve
    return resolve(".");
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 更改当前工作目录
 * @param path 目标目录路径
 */
export function chdir(path: string): void {
  const deno = getDeno();
  if (deno) {
    deno.chdir(path);
    return;
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的 process API
    const process = getProcess();
    if (process?.chdir) {
      process.chdir(path);
      return;
    }
    throw new Error("Bun 环境不支持 chdir");
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 截断文件
 * @param path 文件路径
 * @param len 截断后的文件长度（字节）
 */
export async function truncate(path: string, len: number): Promise<void> {
  const deno = getDeno();
  if (deno) {
    await deno.truncate(path, len);
    return;
  }

  if (IS_BUN) {
    await nodeFsPromises.truncate(path, len);
    return;
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 检查文件或目录是否存在
 * @param path 文件或目录路径
 * @returns 如果存在返回 true，否则返回 false
 *
 * @example
 * ```typescript
 * import { exists } from "@dreamer/runtime-adapter";
 * if (await exists("./file.txt")) {
 *   console.log("文件存在");
 * }
 * ```
 */
export async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * 检查路径是否为文件
 * @param path 文件路径
 * @returns 如果是文件返回 true，否则返回 false
 *
 * @example
 * ```typescript
 * import { isFile } from "@dreamer/runtime-adapter";
 * if (await isFile("./file.txt")) {
 *   console.log("这是一个文件");
 * }
 * ```
 */
export async function isFile(path: string): Promise<boolean> {
  try {
    const info = await stat(path);
    return info.isFile;
  } catch {
    return false;
  }
}

/**
 * 检查路径是否为目录
 * @param path 目录路径
 * @returns 如果是目录返回 true，否则返回 false
 *
 * @example
 * ```typescript
 * import { isDirectory } from "@dreamer/runtime-adapter";
 * if (await isDirectory("./dir")) {
 *   console.log("这是一个目录");
 * }
 * ```
 */
export async function isDirectory(path: string): Promise<boolean> {
  try {
    const info = await stat(path);
    return info.isDirectory;
  } catch {
    return false;
  }
}

// ==================== 同步文件系统 API ====================
// 注意：这些同步 API 主要用于需要同步操作的场景（如 shouldUseColor 等）
// 在可能的情况下，优先使用异步 API

/**
 * 同步获取文件信息
 * @param path 文件路径
 * @returns 文件信息
 * @throws 如果文件不存在或无法访问，抛出错误
 *
 * @example
 * ```typescript
 * import { statSync } from "@dreamer/runtime-adapter";
 * try {
 *   const info = statSync("./file.txt");
 *   console.log("文件大小:", info.size);
 * } catch {
 *   console.log("文件不存在");
 * }
 * ```
 */
export function statSync(path: string): FileInfo {
  const deno = getDeno();
  if (deno) {
    const info = deno.statSync(path);
    return {
      isFile: info.isFile,
      isDirectory: info.isDirectory,
      isSymlink: info.isSymlink,
      size: info.size,
      mtime: info.mtime,
      atime: info.atime,
      birthtime: info.birthtime,
      mode: info.mode ?? null,
      dev: info.dev ?? null,
      ino: info.ino ?? null,
      nlink: info.nlink ?? null,
      uid: info.uid ?? null,
      gid: info.gid ?? null,
      rdev: info.rdev ?? null,
      blksize: info.blksize ?? null,
      blocks: info.blocks ?? null,
    };
  }

  if (IS_BUN) {
    // Bun 支持 Node.js 兼容的 fs 模块，使用同步 API
    const info = nodeFs.statSync(path);
    return {
      isFile: info.isFile(),
      isDirectory: info.isDirectory(),
      isSymlink: info.isSymbolicLink(),
      size: info.size,
      mtime: info.mtime,
      atime: info.atime,
      birthtime: info.birthtime,
      mode: info.mode,
      dev: info.dev,
      ino: info.ino,
      nlink: info.nlink,
      uid: info.uid,
      gid: info.gid,
      rdev: info.rdev,
      blksize: info.blksize,
      blocks: info.blocks,
    };
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 同步读取文本文件内容
 * @param path 文件路径
 * @param _encoding 编码格式（默认：utf-8，Bun 自动处理）
 * @returns 文件内容（字符串）
 * @throws 如果文件不存在或无法读取，抛出错误
 *
 * @example
 * ```typescript
 * import { readTextFileSync } from "@dreamer/runtime-adapter";
 * try {
 *   const content = readTextFileSync("./file.txt");
 *   console.log(content);
 * } catch {
 *   console.log("文件读取失败");
 * }
 * ```
 */
export function readTextFileSync(
  path: string,
  _encoding = "utf-8",
): string {
  const deno = getDeno();
  if (deno) {
    return deno.readTextFileSync(path);
  }

  if (IS_BUN) {
    // Bun 支持 Node.js 兼容的 fs 模块，使用同步 API
    return nodeFs.readFileSync(path, {
      encoding: _encoding as "utf-8" | "utf8",
    }) as string;
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 同步检查文件或目录是否存在
 * @param path 文件或目录路径
 * @returns 如果存在返回 true，否则返回 false
 *
 * @example
 * ```typescript
 * import { existsSync } from "@dreamer/runtime-adapter";
 * if (existsSync("./file.txt")) {
 *   console.log("文件存在");
 * }
 * ```
 */
export function existsSync(path: string): boolean {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * 同步读取文件内容（二进制）
 * @param path 文件路径
 * @returns 文件内容（Uint8Array）
 * @throws 如果文件不存在或无法读取，抛出错误
 *
 * @example
 * ```typescript
 * import { readFileSync } from "@dreamer/runtime-adapter";
 * try {
 *   const data = readFileSync("./file.bin");
 *   console.log("文件大小:", data.length);
 * } catch {
 *   console.log("文件读取失败");
 * }
 * ```
 */
export function readFileSync(path: string): Uint8Array {
  const deno = getDeno();
  if (deno) {
    return deno.readFileSync(path);
  }

  if (IS_BUN) {
    // Bun 支持 Node.js 兼容的 fs 模块，使用同步 API
    return new Uint8Array(nodeFs.readFileSync(path));
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 同步读取目录内容
 * @param path 目录路径
 * @returns 目录项数组
 * @throws 如果目录不存在或无法读取，抛出错误
 *
 * @example
 * ```typescript
 * import { readdirSync } from "@dreamer/runtime-adapter";
 * try {
 *   const entries = readdirSync("./src");
 *   for (const entry of entries) {
 *     console.log(entry.name, entry.isFile ? "文件" : "目录");
 *   }
 * } catch {
 *   console.log("目录读取失败");
 * }
 * ```
 */
export function readdirSync(path: string): DirEntry[] {
  const deno = getDeno();
  if (deno) {
    const entries: DirEntry[] = [];
    for (const entry of deno.readDirSync(path)) {
      entries.push({
        name: entry.name,
        isFile: entry.isFile,
        isDirectory: entry.isDirectory,
        isSymlink: entry.isSymlink,
      });
    }
    return entries;
  }

  if (IS_BUN) {
    // Bun 支持 Node.js 兼容的 fs 模块，使用同步 API
    try {
      // 先验证目录存在
      const dirInfo = nodeFs.statSync(path);
      if (!dirInfo.isDirectory()) {
        throw new Error(`路径 ${path} 不是目录`);
      }

      const entries = nodeFs.readdirSync(path, { withFileTypes: true });
      return entries.map((
        entry: {
          name: string;
          isFile(): boolean;
          isDirectory(): boolean;
          isSymbolicLink(): boolean;
        },
      ) => ({
        name: entry.name,
        isFile: entry.isFile(),
        isDirectory: entry.isDirectory(),
        isSymlink: entry.isSymbolicLink(),
      }));
    } catch (error: unknown) {
      const nodeError = error as { code?: string };
      if (nodeError?.code === "ENOENT") {
        throw new Error(`目录不存在: ${path}`);
      }
      throw error;
    }
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 同步检查路径是否为文件
 * @param path 文件路径
 * @returns 如果是文件返回 true，否则返回 false
 *
 * @example
 * ```typescript
 * import { isFileSync } from "@dreamer/runtime-adapter";
 * if (isFileSync("./file.txt")) {
 *   console.log("这是一个文件");
 * }
 * ```
 */
export function isFileSync(path: string): boolean {
  try {
    const info = statSync(path);
    return info.isFile;
  } catch {
    return false;
  }
}

/**
 * 同步检查路径是否为目录
 * @param path 目录路径
 * @returns 如果是目录返回 true，否则返回 false
 *
 * @example
 * ```typescript
 * import { isDirectorySync } from "@dreamer/runtime-adapter";
 * if (isDirectorySync("./dir")) {
 *   console.log("这是一个目录");
 * }
 * ```
 */
export function isDirectorySync(path: string): boolean {
  try {
    const info = statSync(path);
    return info.isDirectory;
  } catch {
    return false;
  }
}

/**
 * 同步解析真实路径
 * @param path 文件或目录路径
 * @returns 解析后的真实路径
 * @throws 如果路径不存在或无法解析，抛出错误
 *
 * @example
 * ```typescript
 * import { realPathSync } from "@dreamer/runtime-adapter";
 * try {
 *   const realPath = realPathSync("./symlink");
 *   console.log("真实路径:", realPath);
 * } catch {
 *   console.log("路径解析失败");
 * }
 * ```
 */
export function realPathSync(path: string): string {
  const deno = getDeno();
  if (deno) {
    return deno.realPathSync(path);
  }

  if (IS_BUN) {
    // Bun 支持 Node.js 兼容的 fs 模块，使用同步 API
    return nodeFs.realpathSync(path);
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 同步创建目录
 * @param path 目录路径
 * @param options 创建选项
 * @throws 如果目录创建失败，抛出错误
 *
 * @example
 * ```typescript
 * import { mkdirSync } from "@dreamer/runtime-adapter";
 * try {
 *   mkdirSync("./new-dir", { recursive: true });
 *   console.log("目录创建成功");
 * } catch {
 *   console.log("目录创建失败");
 * }
 * ```
 */
export function mkdirSync(
  path: string,
  options?: { recursive?: boolean; mode?: number },
): void {
  const deno = getDeno();
  if (deno) {
    deno.mkdirSync(path, options);
    return;
  }

  if (IS_BUN) {
    // Bun 支持 Node.js 兼容的 fs 模块，使用同步 API
    try {
      nodeFs.mkdirSync(path, {
        recursive: options?.recursive,
        mode: options?.mode,
      });
    } catch (error: unknown) {
      // 如果目录已存在且 recursive 为 true，忽略错误
      const nodeError = error as { code?: string };
      if (nodeError?.code === "EEXIST" || nodeError?.code === "EINVAL") {
        // 检查目录是否真的存在
        try {
          const info = nodeFs.statSync(path);
          if (info.isDirectory()) {
            // 目录已存在，这是正常的
            return;
          }
        } catch {
          // stat 失败，说明目录不存在，重新抛出原始错误
        }
      }
      // 其他错误继续抛出
      throw error;
    }
    return;
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 同步确保目录存在（如果不存在则创建，如果已存在则不做任何操作）
 * 类似于 mkdir -p 命令
 * @param path 目录路径
 * @param options 创建选项（mode 用于设置目录权限）
 * @throws 如果目录创建失败，抛出错误
 *
 * @example
 * ```typescript
 * import { ensureDirSync } from "@dreamer/runtime-adapter";
 * ensureDirSync("./path/to/dir");
 * ```
 */
export function ensureDirSync(
  path: string,
  options?: { mode?: number },
): void {
  // ensureDirSync 就是 mkdirSync 的 recursive: true 的封装
  mkdirSync(path, { recursive: true, mode: options?.mode });
}

/**
 * 同步删除文件或目录
 * @param path 路径
 * @param options 删除选项
 * @throws 如果删除失败，抛出错误
 *
 * @example
 * ```typescript
 * import { removeSync } from "@dreamer/runtime-adapter";
 * try {
 *   removeSync("./file.txt");
 *   console.log("删除成功");
 * } catch {
 *   console.log("删除失败");
 * }
 * ```
 */
export function removeSync(
  path: string,
  options?: { recursive?: boolean },
): void {
  const deno = getDeno();
  if (deno) {
    deno.removeSync(path, options);
    return;
  }

  if (IS_BUN) {
    // Bun 支持 Node.js 兼容的 fs 模块，使用同步 API
    try {
      const stats = nodeFs.statSync(path);
      if (stats.isDirectory()) {
        // 删除目录时，默认使用 recursive: true（如果未指定）
        nodeFs.rmSync(path, { recursive: options?.recursive !== false });
      } else {
        nodeFs.unlinkSync(path);
      }
    } catch (error: unknown) {
      const nodeError = error as { code?: string };
      if (nodeError?.code !== "ENOENT") {
        throw error;
      }
      // ENOENT 表示文件不存在，这是可以接受的
    }
    return;
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 同步写入文件内容（二进制）
 * @param path 文件路径
 * @param data 文件内容
 * @param options 写入选项
 * @throws 如果写入失败，抛出错误
 *
 * @example
 * ```typescript
 * import { writeFileSync } from "@dreamer/runtime-adapter";
 * try {
 *   const data = new Uint8Array([1, 2, 3, 4]);
 *   writeFileSync("./file.bin", data);
 *   console.log("写入成功");
 * } catch {
 *   console.log("写入失败");
 * }
 * ```
 */
export function writeFileSync(
  path: string,
  data: Uint8Array,
  options?: { create?: boolean; mode?: number },
): void {
  const deno = getDeno();
  if (deno) {
    deno.writeFileSync(path, data, options);
    return;
  }

  if (IS_BUN) {
    // Bun 支持 Node.js 兼容的 fs 模块，使用同步 API
    // 将 Uint8Array 转换为 Buffer（Bun 支持 Buffer）
    const Buffer = getBuffer();
    if (Buffer && typeof Buffer.from === "function") {
      const buffer = Buffer.from(data);
      nodeFs.writeFileSync(path, buffer, {
        mode: options?.mode,
        flag: options?.create === false ? "r+" : "w",
      });
    } else {
      // 如果没有 Buffer，直接使用 Uint8Array（Bun 的 fs.writeFileSync 应该支持）
      nodeFs.writeFileSync(path, data, {
        mode: options?.mode,
        flag: options?.create === false ? "r+" : "w",
      });
    }
    return;
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 同步写入文本文件内容
 * @param path 文件路径
 * @param data 文本内容
 * @param options 写入选项
 * @throws 如果写入失败，抛出错误
 *
 * @example
 * ```typescript
 * import { writeTextFileSync } from "@dreamer/runtime-adapter";
 * try {
 *   writeTextFileSync("./file.txt", "Hello, World!");
 *   console.log("写入成功");
 * } catch {
 *   console.log("写入失败");
 * }
 * ```
 */
export function writeTextFileSync(
  path: string,
  data: string,
  options?: { create?: boolean; mode?: number },
): void {
  const deno = getDeno();
  if (deno) {
    deno.writeTextFileSync(path, data, options);
    return;
  }

  if (IS_BUN) {
    // Bun 支持 Node.js 兼容的 fs 模块，使用同步 API
    nodeFs.writeFileSync(path, data, {
      encoding: "utf-8",
      mode: options?.mode,
      flag: options?.create === false ? "r+" : "w",
    });
    return;
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 目录遍历选项
 */
export interface WalkOptions {
  /** 最大深度（默认：Infinity，表示不限制） */
  maxDepth?: number;
  /** 是否包含文件（默认：true） */
  includeFiles?: boolean;
  /** 是否包含目录（默认：false） */
  includeDirs?: boolean;
  /** 路径匹配函数（返回 true 表示包含该路径） */
  match?: (path: string, info: FileInfo) => boolean;
  /** 是否跳过符号链接（默认：false） */
  skipSymlinks?: boolean;
}

/**
 * 递归遍历目录
 * @param dir 起始目录路径
 * @param options 遍历选项
 * @returns 异步生成器，生成文件/目录路径
 *
 * @example
 * ```typescript
 * import { walk } from "@dreamer/runtime-adapter";
 *
 * // 遍历所有文件
 * for await (const path of walk("./src")) {
 *   console.log(path);
 * }
 *
 * // 只遍历 TypeScript 文件
 * for await (const path of walk("./src", {
 *   includeDirs: false,
 *   match: (p) => p.endsWith(".ts"),
 * })) {
 *   console.log(path);
 * }
 * ```
 */
export async function* walk(
  dir: string,
  options: WalkOptions = {},
): AsyncGenerator<string> {
  const {
    maxDepth = Infinity,
    includeFiles = true,
    includeDirs = false,
    match,
    skipSymlinks = false,
  } = options;

  yield* walkDirectory(dir, 0);

  async function* walkDirectory(
    currentDir: string,
    depth: number,
  ): AsyncGenerator<string> {
    // 检查深度限制
    if (maxDepth !== Infinity && depth >= maxDepth) {
      return;
    }

    try {
      const entries = await readdir(currentDir);

      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);

        // 跳过符号链接（如果需要）
        if (skipSymlinks && entry.isSymlink) {
          continue;
        }

        // 获取文件信息用于匹配函数
        let fileInfo: FileInfo | null = null;
        try {
          fileInfo = await stat(fullPath);
        } catch {
          // 如果无法获取文件信息，跳过
          continue;
        }

        // 处理目录
        if (entry.isDirectory) {
          const shouldInclude = !match || match(fullPath, fileInfo);
          if (includeDirs && shouldInclude) {
            yield fullPath;
          }
          // 递归遍历子目录
          yield* walkDirectory(fullPath, depth + 1);
        } else if (entry.isFile) {
          // 处理文件
          const shouldInclude = !match || match(fullPath, fileInfo);
          if (includeFiles && shouldInclude) {
            yield fullPath;
          }
        }
      }
    } catch (error) {
      // 忽略无法访问的目录
      if (error instanceof Error && error.message.includes("Permission")) {
        return;
      }
      throw error;
    }
  }
}
