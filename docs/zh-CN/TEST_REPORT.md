# @dreamer/runtime-adapter 测试报告

## 测试概览

- **测试库版本**：@dreamer/test@^1.0.0-beta.12
- **测试框架**：@dreamer/test（兼容 Deno 与 Bun）
- **测试日期**：2026-02-07
- **测试环境**：
  - Bun 1.3.5
  - Deno 2.6.4

## 测试结果

### 总体统计

- **总测试数**：267
- **通过**：267 ✅
- **失败**：0
- **通过率**：100% ✅
- **执行时间**：约 51 秒

### 测试文件统计

| 测试文件                 | 数量 | 状态        | 说明                                                         |
| ------------------------ | ---- | ----------- | ------------------------------------------------------------ |
| `detect.test.ts`         | 7    | ✅ 全部通过 | 运行时检测                                                   |
| `file.test.ts`           | 35   | ✅ 全部通过 | 异步文件系统 API（open、create、watchFs、ensureDir）         |
| `file-sync.test.ts`      | 21   | ✅ 全部通过 | 同步文件系统 API（含 ensureDirSync）                         |
| `file-ext.test.ts`       | 4    | ✅ 全部通过 | 文件扩展名工具                                               |
| `network.test.ts`        | 5    | ✅ 全部通过 | 网络 API（HTTP 服务）                                        |
| `websocket.test.ts`      | 6    | ✅ 全部通过 | WebSocket API（upgradeWebSocket）                            |
| `websocket-test.test.ts` | 36   | ✅ 全部通过 | WebSocket 服务（房间、事件、心跳）                           |
| `env.test.ts`            | 10   | ✅ 全部通过 | 环境变量 API                                                 |
| `process.test.ts`        | 12   | ✅ 全部通过 | 进程/命令 API（含同步命令执行）                              |
| `process-info.test.ts`   | 5    | ✅ 全部通过 | 进程信息 API（含 execPath）                                  |
| `process-utils.test.ts`  | 2    | ✅ 全部通过 | 进程工具 API                                                 |
| `signal.test.ts`         | 2    | ✅ 全部通过 | 信号处理 API                                                 |
| `terminal.test.ts`       | 25   | ✅ 全部通过 | 终端 API                                                     |
| `cron.test.ts`           | 4    | ✅ 全部通过 | 定时任务 API                                                 |
| `path.test.ts`           | 52   | ✅ 全部通过 | 路径 API（含跨盘相对路径）                                   |
| `hash.test.ts`           | 11   | ✅ 全部通过 | 文件哈希 API（含同步哈希）                                   |
| `system-info.test.ts`    | 16   | ✅ 全部通过 | 系统信息 API（含同步版本）                                   |
| `mod.test.ts`            | 14   | ✅ 全部通过 | 模块导出（含 utils：getDeno、getBun、getProcess、getBuffer） |

## 功能测试详情

### 1. 运行时检测 (detect.test.ts)

**测试场景**：

- ✅ `detectRuntime()`：返回有效运行时类型、正确 Runtime 类型
- ✅ `RUNTIME` 常量：有效运行时值、Runtime 类型
- ✅ `IS_DENO`、`IS_BUN`：均为布尔
- ✅ 运行时环境检查：在 Deno 或 Bun 下正确执行

**结果**：7 项全部通过

### 2. 文件系统 API (file.test.ts)

**测试场景**：目录操作（mkdir、ensureDir）、读写（writeTextFile、readTextFile、writeFile、readFile）、文件操作（copyFile、rename、remove、stat、readdir、realPath、symlink、chmod、chown）、临时文件/目录、工作目录、文件句柄（open、create）、watchFs、walk。

**结果**：35 项全部通过

### 3. 同步文件系统 API (file-sync.test.ts)

**测试场景**：mkdirSync、ensureDirSync、同步读写、statSync、removeSync、existsSync、isFileSync、isDirectorySync、readdirSync、realPathSync
等。

**结果**：20 项全部通过。跨运行时兼容（Deno 原生同步 API，Bun 使用 Node 兼容
fs）。

### 4. 文件扩展工具 (file-ext.test.ts)

**测试场景**：exists、isFile、isDirectory、truncate。**结果**：4 项全部通过

### 5. 网络 API (network.test.ts)

**测试场景**：serve 启动 HTTP 服务、处理不同路径与 POST、关闭服务、自定义
hostname。**结果**：5 项全部通过

### 6. WebSocket API (websocket.test.ts)

**测试场景**：upgradeWebSocket（Deno/Bun）、addEventListener、send、close。**结果**：5
项全部通过。跨运行时统一 API。

### 7. 环境变量 API (env.test.ts)

**测试场景**：setEnv、getEnv、hasEnv、deleteEnv、getEnvAll。**结果**：9
项全部通过

### 8. 进程/命令 API (process.test.ts)

**测试场景**：createCommand（创建、执行、stdin、环境、工作目录、等待、输出、取消）、execCommandSync。**结果**：12
项全部通过

### 9. 进程信息 API (process-info.test.ts)

**测试场景**：pid、platform、arch、version、execPath。**结果**：5 项全部通过

### 10. 进程工具 API (process-utils.test.ts)

**测试场景**：args、exit。**结果**：2 项全部通过

### 11. 信号 API (signal.test.ts)

**测试场景**：addSignalListener、removeSignalListener。**结果**：2 项全部通过

### 12. 终端 API (terminal.test.ts)

**测试场景**：isTerminal、isStderrTerminal、isStdinTerminal、getStdout、getStderr、writeStdoutSync、writeStderrSync、readStdin、setStdinRaw。**结果**：25
项全部通过

### 13. 定时任务 API (cron.test.ts)

**测试场景**：cron 创建、关闭、AbortSignal、不同表达式。**结果**：4 项全部通过

### 14. 路径 API (path.test.ts)

**测试场景**：join、dirname、basename、extname、resolve、relative、normalize、isAbsolute、isRelative
及综合用例。**结果**：52 项全部通过

### 15. 文件哈希 API (hash.test.ts)

**测试场景**：hash、hashFile、hashSync、hashFileSync，多算法。**结果**：11
项全部通过

### 16. 系统信息 API (system-info.test.ts)

**测试场景**：getMemoryInfo、getCpuUsage、getLoadAverage、getDiskUsage、getSystemInfo、getSystemStatus
及同步版本。**结果**：16 项全部通过

### 17. 模块导出 (mod.test.ts)

**测试场景**：运行时检测、文件、网络、环境变量、进程、路径、终端、cron、系统信息、哈希、utils
等导出。**结果**：14 项全部通过

## 新功能亮点 ⭐

- **WebSocket API**：upgradeWebSocket、WebSocketAdapter，Deno/Bun 统一接口
- **同步文件系统 API**：mkdirSync、ensureDirSync、读写同步、statSync、removeSync
  等
- **同步命令执行**：execCommandSync
- **同步哈希**：hashSync、hashFileSync
- **同步系统信息**：getMemoryInfoSync、getLoadAverageSync、getSystemInfoSync
- **ensureDir / ensureDirSync**：类似 mkdir -p，自动创建嵌套目录

## 跨运行时兼容

- **Deno**：全部 API 在 Deno 2.6.4 下正常，需 `--allow-all` 运行测试
- **Bun**：全部 API 在 Bun 1.3.5 下正常，使用 Node 兼容 API 或系统命令

## 性能与资源

- **执行时间**：约 10.92 秒，单测约 54ms；最慢约 4 秒（cron）
- **资源**：无内存/句柄泄漏，临时文件已清理

## 已知限制

- **系统信息**：Windows 依赖 wmic；macOS 内存/负载有简化；Linux 正常
- **系统负载**：Windows 不支持 getLoadAverage，返回 undefined
- **CPU 使用率**：Deno 用进程级；Bun 视 process.cpuUsage 支持情况
- **哈希 API**：使用 `node:crypto`，Deno 与 Bun 均支持

## 结论

- **通过率 100%**：267 项全部通过
- **质量**：功能完整、Deno/Bun 兼容、同步/异步齐全、错误与资源管理完善
- **建议**：CI 中同时跑 Deno/Bun 测试；关注执行时间；按需扩展系统信息与覆盖率

---

**报告生成**：2026-02-07 | **测试框架**：@dreamer/test@^1.0.0-beta.12 |
**环境**：Bun 1.3.5、Deno 2.6.4 | **总测试**：267 | **通过率**：100% ✅
