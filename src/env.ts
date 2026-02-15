/**
 * 环境变量 API 适配模块
 * 提供统一的环境变量操作接口，兼容 Deno 和 Bun
 */

import { IS_BUN } from "./detect.ts";
import { getDeno, getProcess } from "./utils.ts";

/** 统一的环境变量提供层，避免各函数重复 Deno/Bun 分支 */
interface EnvProvider {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
  has(key: string): boolean;
  toObject(): Record<string, string>;
}

function getEnvProvider(): EnvProvider {
  const deno = getDeno();
  if (deno) {
    return {
      get: (k) => deno.env.get(k),
      set: (k, v) => deno.env.set(k, v),
      delete: (k) => deno.env.delete(k),
      has: (k) => deno.env.has(k),
      toObject: () => deno.env.toObject(),
    };
  }
  if (IS_BUN) {
    const proc = getProcess();
    const env = proc?.env ?? {};
    return {
      get: (k) => env[k],
      set: (k, v) => {
        if (proc) {
          if (!proc.env) proc.env = {};
          proc.env[k] = v;
        }
      },
      delete: (k) => {
        if (proc?.env) delete proc.env[k];
      },
      has: (k) => k in env,
      toObject: () => ({ ...env }) as Record<string, string>,
    };
  }
  throw new Error("不支持的运行时环境");
}

/**
 * 获取环境变量值
 * @param key 环境变量键名
 * @returns 环境变量值，如果不存在则返回 undefined
 */
export function getEnv(key: string): string | undefined {
  return getEnvProvider().get(key);
}

/**
 * 设置环境变量值
 * @param key 环境变量键名
 * @param value 环境变量值
 */
export function setEnv(key: string, value: string): void {
  getEnvProvider().set(key, value);
}

/**
 * 删除环境变量
 * @param key 环境变量键名
 */
export function deleteEnv(key: string): void {
  getEnvProvider().delete(key);
}

/**
 * 获取所有环境变量（以对象形式返回）
 * @returns 环境变量对象
 */
export function getEnvAll(): Record<string, string> {
  return getEnvProvider().toObject();
}

/**
 * 检查环境变量是否存在
 * @param key 环境变量键名
 * @returns 是否存在
 */
export function hasEnv(key: string): boolean {
  return getEnvProvider().has(key);
}
