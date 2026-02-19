/**
 * 终端/标准输出 API 适配模块
 * 提供统一的终端操作接口，兼容 Deno 和 Bun
 */

import { IS_BUN } from "./detect.ts";
import { getDeno, getProcess } from "./utils.ts";
import { $tr } from "./i18n.ts";
// 静态导入 Node.js 模块（仅在 Bun 环境下使用）
import * as nodeFs from "node:fs";

/**
 * 检查标准输出是否为终端（TTY）
 * @returns 是否为终端
 */
export function isTerminal(): boolean {
  const deno = getDeno();
  if (deno) {
    return deno.stdout.isTerminal();
  }

  if (IS_BUN) {
    const process = getProcess();
    return process?.stdout?.isTTY ?? false;
  }

  return false;
}

/**
 * 检查标准错误输出是否为终端（TTY）
 * @returns 是否为终端
 */
export function isStderrTerminal(): boolean {
  const deno = getDeno();
  if (deno) {
    return deno.stderr.isTerminal();
  }

  if (IS_BUN) {
    const process = getProcess();
    return process?.stderr?.isTTY ?? false;
  }

  return false;
}

/**
 * 获取标准输出流
 * @returns 标准输出流
 */
export function getStdout(): WritableStream<Uint8Array> {
  const deno = getDeno();
  if (deno) {
    return deno.stdout.writable;
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的流
    return new WritableStream({
      write(chunk) {
        return new Promise((resolve, reject) => {
          const process = getProcess();
          const stdout = process?.stdout;
          if (!stdout) {
            reject(new Error($tr("error.stdoutUnavailable")));
            return;
          }
          stdout.write(chunk, (error: Error | null | undefined) => {
            if (error) reject(error);
            else resolve();
          });
        });
      },
    });
  }

  throw new Error($tr("error.unsupportedRuntime"));
}

/**
 * 获取标准错误输出流
 * @returns 标准错误输出流
 */
export function getStderr(): WritableStream<Uint8Array> {
  const deno = getDeno();
  if (deno) {
    return deno.stderr.writable;
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的流
    return new WritableStream({
      write(chunk) {
        return new Promise((resolve, reject) => {
          const process = getProcess();
          const stderr = process?.stderr;
          if (!stderr) {
            reject(new Error($tr("error.stderrUnavailable")));
            return;
          }
          stderr.write(chunk, (error: Error | null | undefined) => {
            if (error) reject(error);
            else resolve();
          });
        });
      },
    });
  }

  throw new Error($tr("error.unsupportedRuntime"));
}

/**
 * 同步写入标准输出
 * @param data 要写入的数据
 */
export function writeStdoutSync(data: Uint8Array): void {
  const deno = getDeno();
  if (deno) {
    deno.stdout.writeSync(data);
    return;
  }

  if (IS_BUN) {
    const process = getProcess();
    const stdout = process?.stdout;
    if (stdout) {
      // 使用文件描述符 1（标准输出）或 stdout.fd
      const fd = stdout.fd !== undefined ? stdout.fd : 1;
      nodeFs.writeSync(fd, data, 0, data.length);
      return;
    }
    return;
  }

  throw new Error($tr("error.unsupportedRuntime"));
}

/**
 * 读取标准输入
 * @param buffer 缓冲区
 * @returns 读取的字节数或 null（如果到达末尾）
 */
export async function readStdin(
  buffer: Uint8Array,
): Promise<number | null> {
  const deno = getDeno();
  if (deno) {
    // Deno.stdin.readable 是一个 ReadableStream，使用 reader 读取
    const reader = deno.stdin.readable.getReader();
    try {
      const result = await reader.read();
      if (result.done) {
        return null;
      }
      const len = Math.min(result.value.length, buffer.length);
      buffer.set(result.value.subarray(0, len));
      return len;
    } finally {
      reader.releaseLock();
    }
  }

  if (IS_BUN) {
    const process = getProcess();
    const stdin = process?.stdin;
    if (!stdin) {
      return null;
    }
    // Bun 使用 Node.js 兼容的流
    return new Promise((resolve) => {
      stdin.once("data", (chunk: Uint8Array) => {
        // chunk 可能是 Buffer 或 Uint8Array
        const data = chunk instanceof Uint8Array
          ? chunk
          : new Uint8Array(chunk);
        const len = Math.min(data.length, buffer.length);
        buffer.set(data.subarray(0, len));
        resolve(len);
      });
      stdin.once("end", () => {
        resolve(null);
      });
      stdin.once("error", () => {
        resolve(null);
      });
    });
  }

  return null;
}

/**
 * 设置标准输入为原始模式
 * @param mode 是否启用原始模式
 * @param options 选项
 * @returns 是否成功设置
 *
 * 注意：Windows 上 Deno.stdin.setRaw 可能抛出 "The operation is not supported"，
 * 此时捕获异常并返回 false，调用方将退化为非 raw 模式读取（仍可正常输入）。
 */
export function setStdinRaw(
  mode: boolean,
  options?: { cbreak?: boolean },
): boolean {
  const deno = getDeno();
  if (deno) {
    const stdin = deno.stdin as unknown as {
      setRaw?: (mode: boolean, options?: { cbreak?: boolean }) => void;
    };
    // Deno.stdin 可能没有 setRaw 方法，需要类型检查
    if (typeof stdin.setRaw === "function") {
      try {
        stdin.setRaw(mode, options);
        return true;
      } catch {
        // Windows 等环境下 setRaw 可能抛出 "The operation is not supported"
        // 返回 false，调用方将使用非 raw 模式（仍可正常读取输入）
        return false;
      }
    }
    return false;
  }

  if (IS_BUN) {
    // Bun 可能不支持原始模式
    return false;
  }

  return false;
}

/**
 * 同步写入标准错误输出
 * @param data 要写入的数据
 */
export function writeStderrSync(data: Uint8Array): void {
  const deno = getDeno();
  if (deno) {
    deno.stderr.writeSync(data);
    return;
  }

  if (IS_BUN) {
    const process = getProcess();
    const stderr = process?.stderr;
    if (stderr) {
      // 使用文件描述符 2（标准错误输出）或 stderr.fd
      const fd = stderr.fd !== undefined ? stderr.fd : 2;
      nodeFs.writeSync(fd, data, 0, data.length);
      return;
    }
    return;
  }

  throw new Error($tr("error.unsupportedRuntime"));
}

/**
 * 检查标准输入是否为终端
 * @returns 是否为终端
 */
export function isStdinTerminal(): boolean {
  const deno = getDeno();
  if (deno) {
    return deno.stdin.isTerminal();
  }

  if (IS_BUN) {
    const process = getProcess();
    return process?.stdin?.isTTY ?? false;
  }

  return false;
}
