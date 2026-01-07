/**
 * 运行时检测模块
 * 检测当前运行环境是 Deno 还是 Bun
 */

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
  if (
    typeof (globalThis as any).Deno !== "undefined" &&
    (globalThis as any).Deno.version &&
    (globalThis as any).Deno.version.deno !== "polyfill"
  ) {
    return "deno";
  }

  // 检测 Bun
  // 使用 globalThis 访问，避免类型检查错误
  if (typeof globalThis !== "undefined" && (globalThis as any).Bun) {
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

// 运行时环境检查：只支持 Bun 或 Deno
if (!IS_BUN && !IS_DENO) {
  throw new Error("Only Bun or Deno can be used");
}
