/**
 * 进程工具 API 适配模块
 * 提供统一的进程工具接口，兼容 Deno 和 Bun
 */

import { IS_BUN } from "./detect.ts";
import { getDeno, getProcess } from "./utils.ts";
import { $tr } from "./i18n.ts";

/**
 * 获取命令行参数
 * @returns 命令行参数数组（不包含脚本路径和运行时路径）
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
