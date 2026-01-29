/**
 * 信号处理 API 适配模块
 * 提供统一的信号处理接口，兼容 Deno 和 Bun
 */

import { IS_BUN } from "./detect.ts";
import { getDeno, getProcess } from "./utils.ts";
import type { BunSignal, DenoSignal } from "./types.ts";

/**
 * 信号处理器函数类型
 */
export type SignalHandler = () => void;

/**
 * 添加信号监听器
 * @param signal 信号类型
 * @param handler 信号处理函数
 *
 * @example
 * ```typescript
 * import { addSignalListener } from "@dreamer/runtime-adapter";
 *
 * addSignalListener("SIGTERM", () => {
 *   console.log("收到 SIGTERM 信号，正在优雅关闭...");
 *   // 执行清理操作
 *   exit(0);
 * });
 * ```
 */
export function addSignalListener(
  signal: DenoSignal | BunSignal,
  handler: SignalHandler,
): void {
  const deno = getDeno();
  if (deno) {
    deno.addSignalListener(signal, handler);
  } else if (IS_BUN) {
    const process = getProcess();
    if (process?.on) {
      process.on(signal, handler);
    }
  }
}

/**
 * 移除信号监听器
 * @param signal 信号类型
 * @param handler 信号处理函数（必须与添加时使用的函数是同一个引用）
 *
 * @example
 * ```typescript
 * import { addSignalListener, removeSignalListener } from "@dreamer/runtime-adapter";
 *
 * const handler = () => {
 *   console.log("收到信号");
 * };
 *
 * addSignalListener("SIGINT", handler);
 * // 稍后移除
 * removeSignalListener("SIGINT", handler);
 * ```
 */
export function removeSignalListener(
  signal: DenoSignal | BunSignal,
  handler: SignalHandler,
): void {
  const deno = getDeno();
  if (deno) {
    deno.removeSignalListener(signal, handler);
  } else if (IS_BUN) {
    const process = getProcess();
    if (process?.off) {
      process.off(signal, handler);
    }
  }
}
