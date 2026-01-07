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
 * - ✅ Deno 2.5+
 * - ✅ Bun 1.0+
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

// 导出运行时检测
export {
  detectRuntime,
  IS_BUN,
  IS_DENO,
  RUNTIME,
  type Runtime,
} from "./detect.ts";

// 导出文件系统 API
export {
  chdir,
  chmod,
  chown,
  copyFile,
  create,
  cwd,
  type DirEntry,
  type FileEvent,
  type FileEventType,
  type FileInfo,
  type FileOpenOptions,
  type FileWatcher,
  makeTempDir,
  makeTempFile,
  mkdir,
  open,
  readdir,
  readFile,
  readTextFile,
  realPath,
  remove,
  rename,
  stat,
  symlink,
  watchFs,
  type WatchFsOptions,
  writeFile,
  writeTextFile,
} from "./file.ts";

// 导出网络 API
export {
  connect,
  type ConnectOptions,
  serve,
  type ServeHandle,
  type ServeOptions,
  startTls,
  type StartTlsOptions,
  type TcpConn,
  upgradeWebSocket,
  type UpgradeWebSocketOptions,
  type UpgradeWebSocketResult,
} from "./network.ts";

// 导出环境变量 API
export { deleteEnv, getEnv, getEnvAll, hasEnv, setEnv } from "./env.ts";

// 导出进程/命令 API
export {
  type CommandOptions,
  type CommandOutput,
  type CommandProcess,
  createCommand,
} from "./process.ts";

// 导出终端 API
export {
  getStderr,
  getStdout,
  isStderrTerminal,
  isTerminal,
} from "./terminal.ts";

// 导出定时任务 API
export { cron, type CronHandle, type CronOptions } from "./cron.ts";
// 注意：cron 函数是异步的，返回 Promise<CronHandle>
