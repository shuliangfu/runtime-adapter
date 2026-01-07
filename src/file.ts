/**
 * 文件系统 API 适配模块
 * 提供统一的文件系统操作接口，兼容 Deno 和 Bun
 */

import { IS_BUN, IS_DENO } from "./detect.ts";

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
  if (IS_DENO) {
    return await (globalThis as any).Deno.readFile(path);
  }

  if (IS_BUN) {
    const file = (globalThis as any).Bun.file(path);
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
  if (IS_DENO) {
    return await (globalThis as any).Deno.readTextFile(path);
  }

  if (IS_BUN) {
    const file = (globalThis as any).Bun.file(path);
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
  if (IS_DENO) {
    await (globalThis as any).Deno.writeFile(path, data, options);
    return;
  }

  if (IS_BUN) {
    // Bun 使用原生高性能 API
    await (globalThis as any).Bun.write(path, data);
    // 验证文件确实写入成功（处理文件系统同步延迟）
    let retries = 10;
    while (retries > 0) {
      try {
        const file = (globalThis as any).Bun.file(path);
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
  if (IS_DENO) {
    await (globalThis as any).Deno.writeTextFile(path, data, options);
    return;
  }

  if (IS_BUN) {
    // Bun 使用原生高性能 API
    await (globalThis as any).Bun.write(path, data);
    // 验证文件确实写入成功（处理文件系统同步延迟）
    let retries = 5;
    while (retries > 0) {
      try {
        const file = (globalThis as any).Bun.file(path);
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
  if (IS_DENO) {
    const file = await (globalThis as any).Deno.open(path, options);
    return {
      readable: file.readable,
      writable: file.writable,
      close: () => file.close(),
    };
  }

  if (IS_BUN) {
    // Bun 使用不同的方式打开文件
    const file = (globalThis as any).Bun.file(path);
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
          await (globalThis as any).Bun.write(path, combined);
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
  if (IS_DENO) {
    await (globalThis as any).Deno.mkdir(path, options);
    return;
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的 fs API
    const { mkdir: nodeMkdir } = await import("node:fs/promises");
    try {
      await nodeMkdir(path, {
        recursive: options?.recursive,
        mode: options?.mode,
      });
    } catch (error: any) {
      // 如果目录已存在且 recursive 为 true，忽略错误
      // Bun 在某些情况下会抛出 EINVAL 错误，即使 recursive: true
      if (error?.code === "EEXIST" || error?.code === "EINVAL") {
        // 检查目录是否真的存在
        try {
          const { stat } = await import("node:fs/promises");
          const info = await stat(path);
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
 * 删除文件或目录
 * @param path 路径
 * @param options 删除选项
 */
export async function remove(
  path: string,
  options?: { recursive?: boolean },
): Promise<void> {
  if (IS_DENO) {
    await (globalThis as any).Deno.remove(path, options);
    return;
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的 fs API
    const { rm, unlink, stat } = await import("node:fs/promises");
    try {
      const stats = await stat(path);
      if (stats.isDirectory()) {
        await rm(path, { recursive: options?.recursive });
      } else {
        await unlink(path);
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
  if (IS_DENO) {
    const info = await (globalThis as any).Deno.stat(path);
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
    const { stat: nodeStat } = await import("node:fs/promises");
    const info = await nodeStat(path);
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
 * 监控文件系统变化
 * @param paths 要监控的路径（可以是文件或目录）
 * @param options 监控选项
 * @returns 文件监控器
 */
export function watchFs(
  paths: string | string[],
  options?: { recursive?: boolean },
): FileWatcher {
  if (IS_DENO) {
    const pathArray = Array.isArray(paths) ? paths : [paths];
    const watcher = (globalThis as any).Deno.watchFs(pathArray, {
      recursive: options?.recursive ?? false,
    });
    // 转换 Deno 的事件类型为统一格式
    return {
      close() {
        watcher.close();
      },
      async *[Symbol.asyncIterator](): AsyncIterableIterator<FileEvent> {
        for await (const event of watcher) {
          yield {
            kind: event.kind === "create"
              ? "create"
              : event.kind === "modify"
              ? "modify"
              : "remove",
            paths: event.paths,
          };
        }
      },
    };
  }

  if (IS_BUN) {
    // Bun 环境下的文件监控需要使用第三方库
    // 这里提供一个占位实现
    return {
      close() {
        // 占位实现，实际需要使用第三方库
      },
      async *[Symbol.asyncIterator](): AsyncIterableIterator<FileEvent> {
        // 这是一个占位实现，实际使用中需要使用第三方库如 chokidar
        // 或者使用 Node.js 的 fs.watch API（但功能受限）
        // 使用 yield 来满足生成器函数的要求
        yield {
          kind: "modify",
          paths: [],
        };
        throw new Error(
          "Bun 环境下的文件监控需要使用第三方库（如 chokidar）",
        );
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
  if (IS_DENO) {
    const entries: DirEntry[] = [];
    for await (const entry of (globalThis as any).Deno.readDir(path)) {
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
    const { readdir, stat } = await import("node:fs/promises");
    try {
      // 先验证目录存在
      const dirInfo = await stat(path);
      if (!dirInfo.isDirectory()) {
        throw new Error(`路径 ${path} 不是目录`);
      }

      const entries = await readdir(path, { withFileTypes: true });
      return entries.map((entry) => ({
        name: entry.name,
        isFile: entry.isFile(),
        isDirectory: entry.isDirectory(),
        isSymlink: entry.isSymbolicLink(),
      }));
    } catch (error: any) {
      if (error?.code === "ENOENT") {
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
  if (IS_DENO) {
    await (globalThis as any).Deno.copyFile(src, dest);
    return;
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的 fs API
    const { copyFile } = await import("node:fs/promises");
    await copyFile(src, dest);
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
  if (IS_DENO) {
    await (globalThis as any).Deno.rename(oldPath, newPath);
    return;
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的 fs API
    const { rename: nodeRename, mkdir, stat } = await import(
      "node:fs/promises"
    );
    const { dirname } = await import("node:path");

    try {
      // 确保目标目录存在
      const destDir = dirname(newPath);
      try {
        await mkdir(destDir, { recursive: true });
      } catch (error: any) {
        // 如果目录已存在，忽略错误
        if (error?.code !== "EEXIST" && error?.code !== "EINVAL") {
          throw error;
        }
        // 验证目录确实存在
        try {
          const dirInfo = await stat(destDir);
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
          const sourceInfo = await stat(oldPath);
          // 验证确实是文件或目录（FileInfo 接口使用 isFile 和 isDirectory 布尔属性）
          const isFile = Boolean(sourceInfo.isFile);
          const isDirectory = Boolean(sourceInfo.isDirectory);
          if (isFile || isDirectory) {
            sourceExists = true;
          } else {
            throw new Error(`源路径存在但不是文件或目录: ${oldPath}`);
          }
        } catch (error: any) {
          if (error?.code === "ENOENT") {
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
      await nodeRename(oldPath, newPath);
    } catch (error: any) {
      // 提供更详细的错误信息
      if (error?.code === "ENOENT") {
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
  if (IS_DENO) {
    // Deno.symlink 的签名：symlink(target, path, options?)
    // options 可以是 { type: "file" | "dir" } 或直接是 type 字符串
    if (type) {
      await (globalThis as any).Deno.symlink(target, path, { type });
    } else {
      await (globalThis as any).Deno.symlink(target, path);
    }
    return;
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的 fs API
    const { symlink } = await import("node:fs/promises");
    await symlink(target, path, type);
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
  if (IS_DENO) {
    return await (globalThis as any).Deno.realPath(path);
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的 fs API
    const { realpath } = await import("node:fs/promises");
    return await realpath(path);
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 修改文件权限
 * @param path 文件路径
 * @param mode 权限模式（八进制数字，如 0o755）
 */
export async function chmod(path: string, mode: number): Promise<void> {
  if (IS_DENO) {
    await (globalThis as any).Deno.chmod(path, mode);
    return;
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的 fs API
    const { chmod } = await import("node:fs/promises");
    await chmod(path, mode);
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
  if (IS_DENO) {
    await (globalThis as any).Deno.chown(path, uid, gid);
    return;
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的 fs API
    const { chown } = await import("node:fs/promises");
    await chown(path, uid, gid);
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
  if (IS_DENO) {
    return await (globalThis as any).Deno.makeTempDir(options);
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的 fs API
    const { mkdtemp } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const os = await import("node:os");

    const tmpDir = options?.dir || os.tmpdir();
    const prefix = options?.prefix || "tmp-";
    // mkdtemp 需要 XXXXXX 占位符，会被替换为随机字符
    const template = join(tmpDir, prefix + "XXXXXX");

    const tempDirPath = await mkdtemp(template);
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
  if (IS_DENO) {
    return await (globalThis as any).Deno.makeTempFile(options);
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的 fs API
    const { writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const os = await import("node:os");
    const { randomBytes } = await import("node:crypto");

    const tmpDir = options?.dir || os.tmpdir();
    const prefix = options?.prefix || "tmp-";
    const suffix = options?.suffix || "";

    // 生成随机文件名
    const randomStr = randomBytes(6).toString("hex");
    const tempFile = join(tmpDir, `${prefix}${randomStr}${suffix}`);

    // 创建空文件
    await writeFile(tempFile, "");

    return tempFile;
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 获取当前工作目录
 * @returns 当前工作目录路径
 */
export function cwd(): string {
  if (IS_DENO) {
    return (globalThis as any).Deno.cwd();
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的 process API
    const process = (globalThis as any).process;
    if (process?.cwd) {
      return process.cwd();
    }
    // 如果 process.cwd 不可用，使用 path.resolve
    const { resolve } = require("node:path");
    return resolve(".");
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 更改当前工作目录
 * @param path 目标目录路径
 */
export function chdir(path: string): void {
  if (IS_DENO) {
    (globalThis as any).Deno.chdir(path);
    return;
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的 process API
    const process = (globalThis as any).process;
    if (process?.chdir) {
      process.chdir(path);
      return;
    }
    throw new Error("Bun 环境不支持 chdir");
  }

  throw new Error("不支持的运行时环境");
}
