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

// 导出运行时检测
export {
  detectRuntime,
  IS_BUN,
  IS_DENO,
  RUNTIME,
  type Runtime
} from "./detect.ts"

// 导出文件系统 API
export {
  chdir,
  chmod,
  chown,
  copyFile,
  create,
  cwd, exists,
  existsSync, isDirectory,
  isDirectorySync,
  isFile,
  isFileSync,
  makeTempDir,
  makeTempFile,
  mkdir,
  mkdirSync,
  open,
  readdir,
  readdirSync,
  readFile,
  readFileSync,
  readTextFile,
  readTextFileSync,
  realPath,
  realPathSync,
  remove,
  removeSync,
  rename,
  stat,
  statSync,
  symlink,
  truncate,
  walk, watchFs, writeFile,
  writeFileSync,
  writeTextFile,
  writeTextFileSync, type DirEntry, type FileEvent,
  type FileEventType,
  type FileInfo,
  type FileOpenOptions,
  type FileWatcher, type WalkOptions, type WatchFsOptions
} from "./file.ts"

// 导出网络 API
export {
  connect, serve, startTls, upgradeWebSocket, type ConnectOptions, type ServeHandle,
  type ServeOptions, type StartTlsOptions,
  type TcpConn, type UpgradeWebSocketOptions,
  type UpgradeWebSocketResult
} from "./network.ts"

// 导出环境变量 API
export { deleteEnv, getEnv, getEnvAll, hasEnv, setEnv } from "./env.ts"

// 导出进程/命令 API
export {
  createCommand,
  execCommandSync, type CommandOptions,
  type CommandOutput,
  type CommandProcess
} from "./process.ts"

// 导出终端 API
export {
  getStderr,
  getStdout,
  isStderrTerminal,
  isStdinTerminal,
  isTerminal,
  readStdin,
  setStdinRaw,
  writeStderrSync,
  writeStdoutSync
} from "./terminal.ts"

// 导出定时任务 API
export { cron, type CronHandle, type CronOptions } from "./cron.ts"

// 导出进程信息 API
export {
  arch,
  pid, platform, version, type Arch, type Platform, type RuntimeVersion
} from "./process-info.ts"

// 导出进程工具 API
export { args, exit } from "./process-utils.ts"

// 导出信号处理 API
export {
  addSignalListener,
  removeSignalListener,
  type Signal,
  type SignalHandler
} from "./signal.ts"

// 目录遍历 API 已包含在文件系统 API 中

// 导出文件哈希 API
export {
  hash, hashFile,
  hashFileSync,
  hashSync, type HashAlgorithm
} from "./hash.ts"

// 导出路径操作 API
export {
  basename,
  dirname,
  extname,
  isAbsolute,
  isRelative,
  join,
  normalize,
  relative,
  resolve
} from "./path.ts"

// 导出系统信息 API
export {
  getCpuUsage,
  getDiskUsage,
  getLoadAverage,
  getLoadAverageSync,
  getMemoryInfo,
  getMemoryInfoSync,
  getSystemInfo,
  getSystemInfoSync,
  getSystemStatus, type CpuUsage,
  type DiskUsage, type LoadAverage,
  type MemoryInfo,
  type SystemInfo,
  type SystemStatus
} from "./system-info.ts"
