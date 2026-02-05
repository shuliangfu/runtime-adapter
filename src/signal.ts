/**
 * 信号处理 API 适配模块
 * 提供统一的信号处理接口，兼容 Deno 和 Bun
 *
 * 平台兼容性说明：
 * - Deno 在 Windows 上仅支持 SIGINT、SIGBREAK、SIGUP，不支持 SIGTERM
 * - 在 Windows + Deno 环境下，SIGTERM 的监听会被静默跳过
 * @see https://github.com/denoland/deno/issues/9995
 */

import { IS_BUN } from "./detect.ts";
import { getDeno, getProcess } from "./utils.ts";
import { platform } from "./process-info.ts";
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
    // Deno 在 Windows 上不支持 SIGTERM，仅支持 SIGINT、SIGBREAK、SIGUP
    // 在 Windows 上静默跳过 SIGTERM 注册，避免抛出 TypeError
    const plat = platform();
    if (plat === "windows" && signal === "SIGTERM") {
      return; // 静默跳过，不注册
    }
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
    // 与 addSignalListener 保持一致：Windows 上 SIGTERM 未注册，移除时也跳过
    const plat = platform();
    if (plat === "windows" && signal === "SIGTERM") {
      return;
    }
    deno.removeSignalListener(signal, handler);
  } else if (IS_BUN) {
    const process = getProcess();
    if (process?.off) {
      process.off(signal, handler);
    }
  }
}
