# @dreamer/runtime-adapter 测试报告

## 测试概览

- **测试库版本**：@dreamer/test（Deno / Bun / Node 三端共用同一套件）
- **统一套件**：`tests/*.test.ts`（三端跑同一批文件，不再有 Node 专用冒烟集）
- **测试日期**：2026-07-22
- **包版本**：1.2.1
- **测试环境**：
  - Deno 2.x
  - Bun 1.3.14
  - Node.js 22+

## 测试结果

### 总体统计

| 运行时   | 命令                                           | 结果                         |
| -------- | ---------------------------------------------- | ---------------------------- |
| **Deno** | `deno test -A tests/`                          | **309 通过**，0 失败（~41s） |
| **Bun**  | `bun test tests/`                              | **286 通过**，0 失败（~50s） |
| **Node** | `tsx --test --test-force-exit tests/*.test.ts` | **286 通过**，0 失败（~45s） |

- **通过率**：三端均为 100% ✅
- **一键**：`npm run test:all`（Deno + Bun + Node 同一套件）

> **计数说明**：三端跑同一批 `tests/*.test.ts`。Deno 309 含 Deno 专属用例分支
> （如 `upgradeWebSocket` 的 Deno/Bun 分支、Deno 原生 API 用例）；Bun/Node 跳过
> 非 本端用例，均为 286。主业务覆盖三端一致。

### 主套件文件（三端共用）

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

## 静态检查

- `deno check src/`：通过（0 错误）
- `deno lint src/`：通过（22 文件，0 问题）
- `deno fmt --check src/ tests/`：通过（46 文件已格式化）

## 结论

- **三端一等公民**：Deno / Bun / Node 跑同一套 `tests/*.test.ts`，全绿。
- **Node.js 22+**：经 `@dreamer/test` 的 Node
  后端接入主套件，不再维护独立冒烟集。
- **测试隔离**：文件测试各用独立 `tests/data/<file>` 子目录，消除并行竞争。
