/**
 * @fileoverview 运行时适配工具函数
 *
 * 提供类型安全的运行时 API 访问辅助函数
 */

import { IS_BUN, IS_DENO } from "./detect.ts";
import type {
  BufferConstructor,
  BunGlobal,
  DenoGlobal,
  ProcessGlobal,
} from "./types.ts";

/**
 * 获取 Deno API（类型安全）
 * @returns Deno API 对象，如果不在 Deno 环境则返回 null
 */
export function getDeno(): DenoGlobal["Deno"] | null {
  if (
    IS_DENO && typeof (globalThis as unknown as DenoGlobal).Deno !== "undefined"
  ) {
    return (globalThis as unknown as DenoGlobal).Deno;
  }
  return null;
}

/**
 * 获取 Bun API（类型安全）
 * @returns Bun API 对象，如果不在 Bun 环境则返回 null
 */
export function getBun(): BunGlobal["Bun"] | null {
  if (
    IS_BUN && typeof (globalThis as unknown as BunGlobal).Bun !== "undefined"
  ) {
    return (globalThis as unknown as BunGlobal).Bun;
  }
  return null;
}

/**
 * 获取 Node.js Process API（类型安全）
 * @returns Process API 对象，如果不存在则返回 null
 */
export function getProcess(): ProcessGlobal["process"] | null {
  if (typeof (globalThis as unknown as ProcessGlobal).process !== "undefined") {
    return (globalThis as unknown as ProcessGlobal).process || null;
  }
  return null;
}

/**
 * 获取 Node.js Buffer 构造函数（类型安全）
 * @returns Buffer 构造函数，如果不存在则返回 null
 */
export function getBuffer(): BufferConstructor | null {
  if (
    typeof (globalThis as unknown as { Buffer?: BufferConstructor }).Buffer !==
      "undefined"
  ) {
    return (globalThis as unknown as { Buffer: BufferConstructor }).Buffer ||
      null;
  }
  return null;
}
