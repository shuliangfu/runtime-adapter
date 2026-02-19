/**
 * 运行时检测模块
 * 检测当前运行环境是 Deno 还是 Bun
 */

import { $tr, initRuntimeAdapterI18n } from "./i18n.ts";

/**
 * 运行时类型
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

// 运行时环境检查：只支持 Bun 或 Deno（i18n 不依赖本模块，可安全使用 $t 翻译）
if (!IS_BUN && !IS_DENO) {
  initRuntimeAdapterI18n();
  throw new Error($tr("error.onlyBunOrDeno"));
}
