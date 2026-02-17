/**
 * @module @dreamer/runtime-adapter
 *
 * 运行时适配层库
 *
 * 提供统一的运行时 API 抽象层，兼容 Deno 和 Bun 运行时环境。
 * 让其他 @dreamer/* 库可以在不同运行时环境中使用相同的 API。
 *
 * 功能特性：
 * - 运行时自动检测（Deno / Bun）
 * - 文件系统 API 适配
 * - 网络 API 适配
 * - 环境变量 API 适配
 * - 进程/命令 API 适配
 * - 终端 API 适配
 * - 定时任务 API 适配
 *
 * 环境兼容性：
 * - ✅ Deno 2.6+
 * - ✅ Bun 1.3.5
 *
 * @example
 * ```typescript
 * import { readFile, writeFile, getEnv, serve } from "jsr:@dreamer/runtime-adapter";
 *
 * // 文件操作（自动适配 Deno 或 Bun）
 * const data = await readFile("./file.txt");
 * await writeFile("./output.txt", data);
 *
 * // 环境变量（自动适配）
 * const apiKey = getEnv("API_KEY");
 *
 * // HTTP 服务器（自动适配）
 * serve({ port: 3000 }, (req) => {
 *   return new Response("Hello, World!");
 * });
 * ```
 */

import { initRuntimeAdapterI18n } from "./i18n.ts";

// 入口处初始化 i18n，供错误信息等文案使用
initRuntimeAdapterI18n();

// 导出运行时检测
export * from "./detect.ts";

// 导出文件系统 API
export * from "./file.ts";
// 显式导出 existsSync，便于 Bun 等运行时正确解析（避免 export * 解析问题）
export { existsSync } from "./file.ts";

// 导出网络 API
export * from "./network.ts";

// 导出环境变量 API
export * from "./env.ts";

// 导出进程/命令 API
export * from "./process.ts";

// 导出终端 API
export * from "./terminal.ts";

// 导出定时任务 API
export * from "./cron.ts";

// 导出进程信息 API
export * from "./process-info.ts";
// 显式导出 execPath，便于 Bun 等运行时正确解析（避免 export * 解析问题）
export { execPath } from "./process-info.ts";

// 导出进程工具 API
export * from "./process-utils.ts";

// 导出信号处理 API
export * from "./signal.ts";

// 目录遍历 API 已包含在文件系统 API 中

// 导出文件哈希 API
export * from "./hash.ts";

// 导出路径操作 API
export * from "./path.ts";

// 导出系统信息 API
export * from "./system-info.ts";

export * from "./utils.ts";

// 导出 i18n（错误信息翻译与 locale）
export { $t, initRuntimeAdapterI18n, type Locale } from "./i18n.ts";
