/**
 * 终端/标准输出 API 适配模块
 * 提供统一的终端操作接口，兼容 Deno 和 Bun
 */

import { IS_BUN, IS_DENO } from "./detect.ts";
// 静态导入 Node.js 模块（仅在 Bun 环境下使用）
import * as nodeFs from "node:fs";

/**
 * 检查标准输出是否为终端（TTY）
 * @returns 是否为终端
 */
export function isTerminal(): boolean {
  if (IS_DENO) {
    return (globalThis as any).Deno.stdout.isTerminal();
  }

  if (IS_BUN) {
    return (globalThis as any).process?.stdout?.isTTY ?? false;
  }

  return false;
}

/**
 * 检查标准错误输出是否为终端（TTY）
 * @returns 是否为终端
 */
export function isStderrTerminal(): boolean {
  if (IS_DENO) {
    return (globalThis as any).Deno.stderr.isTerminal();
  }

  if (IS_BUN) {
    return (globalThis as any).process?.stderr?.isTTY ?? false;
  }

  return false;
}

/**
 * 获取标准输出流
 * @returns 标准输出流
 */
export function getStdout(): WritableStream<Uint8Array> {
  if (IS_DENO) {
    return (globalThis as any).Deno.stdout.writable;
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的流
    return new WritableStream({
      write(chunk) {
        return new Promise((resolve, reject) => {
          const stdout = (globalThis as any).process?.stdout;
          if (!stdout) {
            reject(new Error("标准输出不可用"));
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

  throw new Error("不支持的运行时环境");
}

/**
 * 获取标准错误输出流
 * @returns 标准错误输出流
 */
export function getStderr(): WritableStream<Uint8Array> {
  if (IS_DENO) {
    return (globalThis as any).Deno.stderr.writable;
  }

  if (IS_BUN) {
    // Bun 使用 Node.js 兼容的流
    return new WritableStream({
      write(chunk) {
        return new Promise((resolve, reject) => {
          const stderr = (globalThis as any).process?.stderr;
          if (!stderr) {
            reject(new Error("标准错误输出不可用"));
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

  throw new Error("不支持的运行时环境");
}

/**
 * 同步写入标准输出
 * @param data 要写入的数据
 */
export function writeStdoutSync(data: Uint8Array): void {
  if (IS_DENO) {
    (globalThis as any).Deno.stdout.writeSync(data);
    return;
  }

  if (IS_BUN) {
    const stdout = (globalThis as any).process?.stdout;
    if (stdout) {
      // 使用文件描述符 1（标准输出）或 stdout.fd
      const fd = stdout.fd !== undefined ? stdout.fd : 1;
      nodeFs.writeSync(fd, data, 0, data.length);
      return;
    }
    return;
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 读取标准输入
 * @param buffer 缓冲区
 * @returns 读取的字节数或 null（如果到达末尾）
 */
export async function readStdin(
  buffer: Uint8Array,
): Promise<number | null> {
  if (IS_DENO) {
    return await (globalThis as any).Deno.stdin.read(buffer);
  }

  if (IS_BUN) {
    const stdin = (globalThis as any).process?.stdin;
    if (!stdin) {
      return null;
    }
    // Bun 使用 Node.js 兼容的流
    return new Promise((resolve) => {
      stdin.once("data", (chunk: any) => {
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
 */
export function setStdinRaw(
  mode: boolean,
  options?: { cbreak?: boolean },
): boolean {
  if (IS_DENO) {
    const stdin = (globalThis as any).Deno.stdin;
    if (stdin.setRaw) {
      stdin.setRaw(mode, options);
      return true;
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
  if (IS_DENO) {
    (globalThis as any).Deno.stderr.writeSync(data);
    return;
  }

  if (IS_BUN) {
    const stderr = (globalThis as any).process?.stderr;
    if (stderr) {
      // 使用文件描述符 2（标准错误输出）或 stderr.fd
      const fd = stderr.fd !== undefined ? stderr.fd : 2;
      nodeFs.writeSync(fd, data, 0, data.length);
      return;
    }
    return;
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 检查标准输入是否为终端
 * @returns 是否为终端
 */
export function isStdinTerminal(): boolean {
  if (IS_DENO) {
    return (globalThis as any).Deno.stdin.isTerminal();
  }

  if (IS_BUN) {
    return (globalThis as any).process?.stdin?.isTTY ?? false;
  }

  return false;
}
