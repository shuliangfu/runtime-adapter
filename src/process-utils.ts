/**
 * 进程工具 API 适配模块
 * 提供统一的进程工具接口，兼容 Deno 和 Bun
 */

import { IS_BUN } from "./detect.ts";
import { getBun, getDeno, getProcess } from "./utils.ts";
import { $tr } from "./i18n.ts";

/**
 * 获取命令行参数
 * @returns 命令行参数数组（不包含脚本路径和运行时路径）
 *
 * Bun 下优先使用 Bun.argv（Bun 官方 API），在 Windows 上比 process.argv 更可靠，
 * 能正确拿到 `bun run script.ts -- --build` 传入的 --build。
 *
 * @example
 * ```typescript
 * import { args } from "@dreamer/runtime-adapter";
 * const arguments = args();
 * // 如果运行: deno run script.ts --help
 * // 返回: ["--help"]
 * ```
 */
export function args(): string[] {
  const deno = getDeno();
  if (deno) {
    return deno.args;
  }
  if (IS_BUN) {
    const bun = getBun();
    const bunArgv =
      bun && "argv" in bun && Array.isArray((bun as { argv?: string[] }).argv)
        ? (bun as { argv: string[] }).argv
        : null;
    if (bunArgv && bunArgv.length > 2) {
      return bunArgv.slice(2);
    }
    const process = getProcess();
    return process?.argv?.slice(2) || [];
  }
  return [];
}

/**
 * 退出程序
 * @param code 退出码（0 表示成功，非 0 表示失败）
 * @returns 永远不会返回（函数类型为 never）
 *
 * @example
 * ```typescript
 * import { exit } from "@dreamer/runtime-adapter";
 * if (error) {
 *   exit(1); // 退出并返回错误码
 * }
 * exit(0); // 正常退出
 * ```
 */
export function exit(code: number): never {
  const deno = getDeno();
  if (deno) {
    deno.exit(code);
  }
  if (IS_BUN) {
    const process = getProcess();
    if (process?.exit) {
      process.exit(code);
    }
  }
  throw new Error($tr("error.unsupportedRuntime"));
}
