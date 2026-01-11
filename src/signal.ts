/**
 * 信号处理 API 适配模块
 * 提供统一的信号处理接口，兼容 Deno 和 Bun
 */

import { IS_BUN, IS_DENO } from "./detect.ts";

/**
 * 信号类型
 */
export type Signal = "SIGTERM" | "SIGINT" | "SIGUSR1" | "SIGUSR2";

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
  signal: Signal,
  handler: SignalHandler,
): void {
  if (IS_DENO) {
    (globalThis as any).Deno.addSignalListener(signal, handler);
  } else if (IS_BUN) {
    (globalThis as any).process?.on(signal, handler);
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
  signal: Signal,
  handler: SignalHandler,
): void {
  if (IS_DENO) {
    (globalThis as any).Deno.removeSignalListener(signal, handler);
  } else if (IS_BUN) {
    (globalThis as any).process?.off(signal, handler);
  }
}
