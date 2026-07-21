/**
 * 子路径入口：`@dreamer/runtime-adapter/fs`
 * 仅导出文件系统相关 API，避免误依赖 network 全局状态。
 */
export * from "./file.ts";
export { existsSync } from "./file.ts";
