/**
 * 进程信息 API 适配模块
 * 提供统一的进程信息接口，兼容 Deno 和 Bun
 */

import { IS_BUN, IS_DENO } from "./detect.ts";

/**
 * 操作系统平台类型
 */
export type Platform = "linux" | "darwin" | "windows" | "unknown";

/**
 * CPU 架构类型
 */
export type Arch = "x86_64" | "aarch64" | "arm64" | "unknown";

/**
 * 运行时版本信息
 */
export interface RuntimeVersion {
  /** 运行时名称 */
  runtime: "deno" | "bun";
  /** 版本号 */
  version: string;
  /** 构建信息（Deno 特有） */
  build?: {
    target: string;
    arch: string;
    os: string;
    vendor: string;
  };
}

/**
 * 获取当前进程 ID
 * @returns 进程 ID
 *
 * @example
 * ```typescript
 * import { pid } from "@dreamer/runtime-adapter";
 * const processId = pid();
 * console.log("进程 ID:", processId);
 * ```
 */
export function pid(): number {
  if (IS_DENO) {
    return (globalThis as any).Deno.pid;
  }
  if (IS_BUN) {
    return (globalThis as any).process?.pid || 0;
  }
  return 0;
}

/**
 * 获取操作系统平台
 * @returns 平台类型
 *
 * @example
 * ```typescript
 * import { platform } from "@dreamer/runtime-adapter";
 * const plat = platform();
 * // => "darwin" | "linux" | "windows" | "unknown"
 * ```
 */
export function platform(): Platform {
  if (IS_DENO) {
    const os = (globalThis as any).Deno.build?.os;
    if (os === "darwin") return "darwin";
    if (os === "windows") return "windows";
    if (os === "linux") return "linux";
    return "unknown";
  }
  if (IS_BUN) {
    const plat = (globalThis as any).process?.platform;
    if (plat === "darwin") return "darwin";
    if (plat === "win32") return "windows";
    if (plat === "linux") return "linux";
    return "unknown";
  }
  return "unknown";
}

/**
 * 获取 CPU 架构
 * @returns CPU 架构类型
 *
 * @example
 * ```typescript
 * import { arch } from "@dreamer/runtime-adapter";
 * const architecture = arch();
 * // => "x86_64" | "aarch64" | "arm64" | "unknown"
 * ```
 */
export function arch(): Arch {
  if (IS_DENO) {
    const arch = (globalThis as any).Deno.build?.arch;
    if (arch === "x86_64") return "x86_64";
    if (arch === "aarch64") return "aarch64";
    return "unknown";
  }
  if (IS_BUN) {
    const arch = (globalThis as any).process?.arch;
    if (arch === "x64") return "x86_64";
    if (arch === "arm64") return "arm64";
    return "unknown";
  }
  return "unknown";
}

/**
 * 获取运行时版本信息
 * @returns 运行时版本信息
 *
 * @example
 * ```typescript
 * import { version } from "@dreamer/runtime-adapter";
 * const ver = version();
 * console.log("运行时:", ver.runtime);
 * console.log("版本:", ver.version);
 * ```
 */
export function version(): RuntimeVersion {
  if (IS_DENO) {
    const denoVersion = (globalThis as any).Deno.version;
    return {
      runtime: "deno",
      version: denoVersion?.deno || "unknown",
      build: denoVersion?.v8
        ? {
          target: denoVersion.target || "",
          arch: (globalThis as any).Deno.build?.arch || "",
          os: (globalThis as any).Deno.build?.os || "",
          vendor: "deno",
        }
        : undefined,
    };
  }
  if (IS_BUN) {
    const bunVersion = (globalThis as any).Bun?.version;
    return {
      runtime: "bun",
      version: bunVersion || "unknown",
    };
  }
  return {
    runtime: "deno" as const, // 默认值
    version: "unknown",
  };
}
