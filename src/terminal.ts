/**
 * 终端/标准输出 API 适配模块
 * 提供统一的终端操作接口，兼容 Deno 和 Bun
 */

import { IS_BUN, IS_DENO } from "./detect.ts";

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
