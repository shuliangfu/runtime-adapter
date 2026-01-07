/**
 * 环境变量 API 适配模块
 * 提供统一的环境变量操作接口，兼容 Deno 和 Bun
 */

import { IS_BUN, IS_DENO } from "./detect.ts";

/**
 * 获取环境变量值
 * @param key 环境变量键名
 * @returns 环境变量值，如果不存在则返回 undefined
 */
export function getEnv(key: string): string | undefined {
  if (IS_DENO) {
    return (globalThis as any).Deno.env.get(key);
  }

  if (IS_BUN) {
    // Bun 环境下使用全局 (globalThis as any).process（类型检查时会有警告，但运行时正常）
    return (globalThis as any).process?.env?.[key];
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 设置环境变量值
 * @param key 环境变量键名
 * @param value 环境变量值
 */
export function setEnv(key: string, value: string): void {
  if (IS_DENO) {
    (globalThis as any).Deno.env.set(key, value);
    return;
  }

  if (IS_BUN) {
    (globalThis as any).process = (globalThis as any).process || {};
    (globalThis as any).process.env = (globalThis as any).process.env || {};
    (globalThis as any).process.env[key] = value;
    return;
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 删除环境变量
 * @param key 环境变量键名
 */
export function deleteEnv(key: string): void {
  if (IS_DENO) {
    (globalThis as any).Deno.env.delete(key);
    return;
  }

  if (IS_BUN) {
    if ((globalThis as any).process?.env) {
      delete (globalThis as any).process.env[key];
    }
    return;
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 获取所有环境变量（以对象形式返回）
 * @returns 环境变量对象
 */
export function getEnvAll(): Record<string, string> {
  if (IS_DENO) {
    return (globalThis as any).Deno.env.toObject();
  }

  if (IS_BUN) {
    return { ...((globalThis as any).process?.env || {}) } as Record<
      string,
      string
    >;
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 检查环境变量是否存在
 * @param key 环境变量键名
 * @returns 是否存在
 */
export function hasEnv(key: string): boolean {
  if (IS_DENO) {
    return (globalThis as any).Deno.env.has(key);
  }

  if (IS_BUN) {
    return key in ((globalThis as any).process?.env || {});
  }

  throw new Error("不支持的运行时环境");
}
