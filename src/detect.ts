/**
 * 运行时检测模块
 * 检测当前运行环境是 Deno 还是 Bun
 */

import { onlyBunOrDenoError } from "./errors.ts";
import { $tr } from "./i18n.ts";

/**
 * 运行时类型
 *
 * 说明：暂不实现 Node 完整兼容；`unknown` 表示非 Deno/Bun。
 */
export type Runtime = "deno" | "bun" | "unknown";

/**
 * 检测当前运行时环境
 * @returns 运行时类型
 */
export function detectRuntime(): Runtime {
  // 检测 Deno（需要检查是否是真实的 Deno，而不是 polyfill）
  const deno =
    (globalThis as unknown as { Deno?: { version?: { deno?: string } } }).Deno;
  if (
    typeof deno !== "undefined" &&
    deno.version &&
    deno.version.deno !== "polyfill"
  ) {
    return "deno";
  }

  // 检测 Bun
  const bun = (globalThis as unknown as { Bun?: unknown }).Bun;
  if (typeof globalThis !== "undefined" && bun) {
    return "bun";
  }

  return "unknown";
}

/**
 * 当前运行时环境
 */
export const RUNTIME: Runtime = detectRuntime();

/**
 * 是否为 Deno 环境
 */
export const IS_DENO = RUNTIME === "deno";

/**
 * 是否为 Bun 环境
 */
export const IS_BUN = RUNTIME === "bun";

/**
 * 是否为已支持的服务端运行时（Deno 或 Bun）
 */
export const IS_SUPPORTED = IS_DENO || IS_BUN;

/**
 * 断言当前为 Deno 或 Bun，否则抛出 {@link RuntimeAdapterError}
 * （供业务在入口做一次显式检查，与模块顶层检查互补）
 */
export function assertSupportedRuntime(): void {
  if (!IS_SUPPORTED) {
    throw onlyBunOrDenoError($tr("error.onlyBunOrDeno"));
  }
}

// 模块加载时即检查：只支持 Bun 或 Deno（保持既有行为，错误类型升级为 RuntimeAdapterError）
if (!IS_SUPPORTED) {
  throw onlyBunOrDenoError($tr("error.onlyBunOrDeno"));
}
