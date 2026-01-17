/**
 * 环境变量 API 适配模块
 * 提供统一的环境变量操作接口，兼容 Deno 和 Bun
 */

import { IS_BUN } from "./detect.ts";
import { getDeno, getProcess } from "./utils.ts";

/**
 * 获取环境变量值
 * @param key 环境变量键名
 * @returns 环境变量值，如果不存在则返回 undefined
 */
export function getEnv(key: string): string | undefined {
  const deno = getDeno();
  if (deno) {
    return deno.env.get(key);
  }

  if (IS_BUN) {
    // Bun 环境下使用 process.env
    const process = getProcess();
    return process?.env?.[key];
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 设置环境变量值
 * @param key 环境变量键名
 * @param value 环境变量值
 */
export function setEnv(key: string, value: string): void {
  const deno = getDeno();
  if (deno) {
    deno.env.set(key, value);
    return;
  }

  if (IS_BUN) {
    const process = getProcess();
    if (process) {
      if (!process.env) {
        process.env = {};
      }
      process.env[key] = value;
    }
    return;
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 删除环境变量
 * @param key 环境变量键名
 */
export function deleteEnv(key: string): void {
  const deno = getDeno();
  if (deno) {
    deno.env.delete(key);
    return;
  }

  if (IS_BUN) {
    const process = getProcess();
    if (process?.env) {
      delete process.env[key];
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
  const deno = getDeno();
  if (deno) {
    return deno.env.toObject();
  }

  if (IS_BUN) {
    const process = getProcess();
    return { ...(process?.env || {}) } as Record<string, string>;
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 检查环境变量是否存在
 * @param key 环境变量键名
 * @returns 是否存在
 */
export function hasEnv(key: string): boolean {
  const deno = getDeno();
  if (deno) {
    return deno.env.has(key);
  }

  if (IS_BUN) {
    const process = getProcess();
    return key in (process?.env || {});
  }

  throw new Error("不支持的运行时环境");
}
