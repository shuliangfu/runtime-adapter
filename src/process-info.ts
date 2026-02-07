/**
 * 进程信息 API 适配模块
 * 提供统一的进程信息接口，兼容 Deno 和 Bun
 */

import { IS_BUN } from "./detect.ts";
import { getBun, getDeno, getProcess } from "./utils.ts";

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
 * 获取当前运行时可执行文件路径
 * @returns Deno 为 deno 可执行文件路径，Bun 为 bun 可执行文件路径
 *
 * @example
 * ```typescript
 * import { execPath } from "@dreamer/runtime-adapter";
 * const path = execPath(); // "/usr/bin/deno" or "/usr/local/bin/bun"
 * ```
 */
export function execPath(): string {
  const deno = getDeno();
  if (deno && "execPath" in deno && typeof (deno as { execPath?: () => string }).execPath === "function") {
    return (deno as { execPath: () => string }).execPath();
  }
  const proc = getProcess();
  if (proc && "execPath" in proc && typeof (proc as { execPath?: unknown }).execPath === "string") {
    return (proc as { execPath: string }).execPath;
  }
  return "deno"; // fallback
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
  const deno = getDeno();
  if (deno) {
    return deno.pid;
  }
  if (IS_BUN) {
    const process = getProcess();
    return process?.pid || 0;
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
  const deno = getDeno();
  if (deno) {
    const os = deno.build?.os;
    if (os === "darwin") return "darwin";
    if (os === "windows") return "windows";
    if (os === "linux") return "linux";
    return "unknown";
  }
  if (IS_BUN) {
    const process = getProcess();
    const plat = process?.platform;
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
  const deno = getDeno();
  if (deno) {
    const archValue = deno.build?.arch;
    if (archValue === "x86_64") return "x86_64";
    if (archValue === "aarch64") return "aarch64";
    return "unknown";
  }
  if (IS_BUN) {
    const process = getProcess();
    const archValue = process?.arch;
    if (archValue === "x64") return "x86_64";
    if (archValue === "arm64") return "arm64";
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
  const deno = getDeno();
  if (deno) {
    const denoVersion = deno.version;
    return {
      runtime: "deno",
      version: denoVersion?.deno || "unknown",
      build: denoVersion?.v8
        ? {
          target: denoVersion.target || "",
          arch: deno.build?.arch || "",
          os: deno.build?.os || "",
          vendor: "deno",
        }
        : undefined,
    };
  }
  const bun = getBun();
  if (bun) {
    return {
      runtime: "bun",
      version: bun.version || "unknown",
    };
  }
  return {
    runtime: "deno" as const, // 默认值
    version: "unknown",
  };
}
