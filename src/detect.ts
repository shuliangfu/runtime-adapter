/**
 * 运行时检测模块
 * 检测当前运行环境是 Deno、Bun 还是 Node.js
 *
 * 检测顺序（必须固定）：Deno → Bun → Node → unknown
 * Bun 与 Node 都暴露 `process`，若先判 Node 会把 Bun 误判为 Node，故 Bun 必须先于 Node。
 */

import { onlyBunOrDenoError } from "./errors.ts";
import { $tr } from "./i18n.ts";

/**
 * 运行时类型
 *
 * `unknown` 表示非 Deno/Bun/Node（导入时即抛错）。
 */
export type Runtime = "deno" | "bun" | "node" | "unknown";

/**
 * 检测当前运行时环境
 * @returns 运行时类型
 */
export function detectRuntime(): Runtime {
  // 1. 真 Deno（需要检查是否是真实的 Deno，而不是 polyfill）
  const deno =
    (globalThis as unknown as { Deno?: { version?: { deno?: string } } }).Deno;
  if (
    typeof deno !== "undefined" &&
    deno.version &&
    deno.version.deno !== "polyfill"
  ) {
    return "deno";
  }

  // 2. Bun（globalThis.Bun）——必须在 Node 之前，因为 Bun 也暴露 process
  const bun = (globalThis as unknown as { Bun?: unknown }).Bun;
  if (typeof globalThis !== "undefined" && bun) {
    return "bun";
  }

  // 3. Node.js（process.versions.node；Bun 亦有 process，故只能排在 Bun 之后）
  const proc = (globalThis as unknown as {
    process?: { versions?: { node?: string } };
  }).process;
  if (typeof proc !== "undefined" && proc?.versions?.node) {
    return "node";
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
 * 是否为 Node.js 环境
 */
export const IS_NODE = RUNTIME === "node";

/**
 * 是否为已支持的服务端运行时（Deno、Bun 或 Node）
 */
export const IS_SUPPORTED = IS_DENO || IS_BUN || IS_NODE;

/**
 * 断言当前为 Deno / Bun / Node，否则抛出 {@link RuntimeAdapterError}
 * （供业务在入口做一次显式检查，与模块顶层检查互补）
 */
export function assertSupportedRuntime(): void {
  if (!IS_SUPPORTED) {
    throw onlyBunOrDenoError($tr("error.onlyBunOrDeno"));
  }
}

// 模块加载时即检查：仅 `unknown` 运行时抛错，Deno/Bun/Node 放行
// （错误类型沿用 RuntimeAdapterError，错误码 ONLY_BUN_OR_DENO 为对外契约，勿改名）
if (RUNTIME === "unknown") {
  throw onlyBunOrDenoError($tr("error.onlyBunOrDeno"));
}
