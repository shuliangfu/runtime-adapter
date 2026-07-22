# @dreamer/runtime-adapter 测试报告

## 测试概览

- **测试库版本**：@dreamer/test@^1.1.10（Deno / Bun 主套件）
- **Node 冒烟**：`node:test` + `tsx`（`tests/node/*`）
- **测试日期**：2026-07-22
- **包版本**：1.2.0
- **测试环境**：
  - Deno 2.x
  - Bun 1.3.14
  - Node.js 22+

## 测试结果

### 总体统计

| 运行时   | 命令                  | 结果                               |
| -------- | --------------------- | ---------------------------------- |
| **Deno** | `deno test -A tests/` | **315 通过**，0 失败（~43s）       |
| **Bun**  | `bun test tests/`     | **286 通过**，0 失败（~52s）       |
| **Node** | `npm run test:node`   | **29 通过**，0 失败（~5.5s，冒烟） |

- **通过率**：三端均为 100% ✅
- **一键**：`npm run test:all`（`deno` + `bun` + Node 冒烟）

> **计数说明**：Deno 扫到 `tests/node/*` 时，`if (!IS_NODE) return` 的 suite
> 仍计 为空 suite pass（约 +29）；Bun 对 `node:test`
> 不计用例。主业务套件两边一致。 Node 当前为 Phase A
> 冒烟（file/network/process/system-info/terminal/detect）， 完整主套件依赖
> `@dreamer/test` Node 后端在 Node 上跑同一批 `tests/*.test.ts`。

### 主套件文件（Deno / Bun）

| 测试文件                 | 状态 | 说明                            |
| ------------------------ | ---- | ------------------------------- |
| `detect.test.ts`         | ✅   | 运行时检测（含 IS_NODE 互斥）   |
| `file.test.ts`           | ✅   | 异步文件系统                    |
| `file-sync.test.ts`      | ✅   | 同步文件系统                    |
| `file-ext.test.ts`       | ✅   | exists / isFile / truncate 等   |
| `network.test.ts`        | ✅   | HTTP serve                      |
| `websocket.test.ts`      | ✅   | upgradeWebSocket                |
| `websocket-test.test.ts` | ✅   | 自研 WS Server 集成             |
| `env.test.ts`            | ✅   | 环境变量                        |
| `process.test.ts`        | ✅   | 命令执行                        |
| `process-info.test.ts`   | ✅   | pid / platform / arch / version |
| `process-utils.test.ts`  | ✅   | args / exit                     |
| `signal.test.ts`         | ✅   | 信号                            |
| `terminal.test.ts`       | ✅   | TTY / stdin-stdout              |
| `cron.test.ts`           | ✅   | 定时任务                        |
| `path.test.ts`           | ✅   | 路径                            |
| `hash.test.ts`           | ✅   | 文件哈希                        |
| `system-info.test.ts`    | ✅   | 内存 / CPU / 磁盘               |
| `mod.test.ts`            | ✅   | 导出面                          |

### Node 冒烟（`tests/node/`）

| 文件                        | 状态 | 说明                                       |
| --------------------------- | ---- | ------------------------------------------ |
| `smoke-detect.test.ts`      | ✅   | RUNTIME / IS_NODE / assertSupportedRuntime |
| `smoke-file.test.ts`        | ✅   | 读写 / open / create / mkdir / temp        |
| `smoke-network.test.ts`     | ✅   | serve + fetch / TCP / WebSocket            |
| `smoke-process.test.ts`     | ✅   | execCommandSync / createCommand            |
| `smoke-system-info.test.ts` | ✅   | getSystemInfo / memory / cpu               |
| `smoke-terminal.test.ts`    | ✅   | isTerminal / writeStdout / streams         |

## 验证记录（1.2.0 优化后）

- `deno check src/mod.ts`：通过
- Bun 本地 monorepo：需正确链接 `@dreamer/test` → `logger` → 本包（见 README
  注意）

## 结论

- **Deno / Bun 一等公民**：主套件全绿。
- **Node.js 22+**：闸门已放行，核心 API 冒烟全绿；生产路径建议继续以冒烟 +
  下游包实测为门禁，直至主套件在 Node 上完整接入。
