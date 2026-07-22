# 变更日志

[English](../en-US/CHANGELOG.md) | 中文 (Chinese)

本文件记录 @dreamer/runtime-adapter 的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [1.2.2] - 2026-07-22

### 修复

- **Node `spawn ENOENT` unhandledRejection**：`output()` 先 `await` 流收集
  （`Promise.all([stdout, stderr])`）再 `await exitPromise`。当 `spawn` 触发
  ENOENT（如现代 Windows Server / GitHub Actions runner 已移除 `wmic`）时，
  `exitPromise` 经 `proc.once("error", reject)` 立即 reject，但该 tick 未被
  await —— Node 测试运行器将此未捕获拒绝判为 `unhandledRejection` 导致测试失败。
  现将 `exitPromise` 并入与流收集同一个 `Promise.all`，任一 reject
  即时传播并被外层 `try/catch` 捕获。这也使 `system-info.ts` 中 `wmic` →
  PowerShell `Get-CimInstance` 备选路径在已移除 `wmic` 的 runner 上可达。
- **Deno 2.5 CI `Cannot find name 'Buffer'`（TS2580）**：`network.ts` 使用全局
  `Buffer`（`head: Buffer` 类型标注、`Buffer.from(c)`）却未导入。Deno 2.9 的 lib
  全局暴露 `Buffer` 故本地检查通过，但 CI 的 Deno 2.5 lib 缺少该声明。显式
  `import { Buffer } from "node:buffer"`（与 `process.ts` 一致），兼容所有 Deno
  版本。

### 变更

- **CI：Deno `v2.5` → `v2.9`**（6 处）：对齐本地开发环境，解决 Deno 2.5 类型诊断
  （全局 `Buffer` 缺失、`process` 全局 discouraged 警告）。
- **CI：新增 3 个 Node.js 任务**（`test-linux-node` / `test-macos-node` /
  `test-windows-node`，Node 22，`npm install` + `npm run test:node`，不装
  Chromium）。runtime-adapter CI 现为 9 任务（3 Deno + 3 Bun + 3
  Node），落实三端 一等公民策略。
- **`@dreamer/test` devDependency**：`^1.2.0` → `^1.2.1`。

### 验证

- Deno：309 通过，0 失败
- Bun：286 通过，0 失败
- Node：286 通过，0 失败（`tsx --test --test-force-exit tests/*.test.ts`）

---

## [1.2.1] - 2026-07-22

### 修复

- **`serve()` Node 分支返回 `Promise<ServeHandle>`**：Node 的 `server.listen()`
  异步，端口绑定在事件循环后续 tick 完成；原先同步返回 handle 导致 `handle.port`
  读 `server.address()` 得 `null` → `undefined`。现 Node 分支在 listen 回调内
  resolve handle，对齐 Deno/Bun 同步语义（调用方须 `await serve(...)`）。
- **WebSocket 升级 socket 误销毁**：`upgradeWebSocket` 已同步调
  `wss.handleUpgrade` 接管 socket 并置 `ctx.upgraded=true`；若 `fetchHandler`
  后续抛错（如 undici 下 `Response(null,{status:101})` 触发 RangeError），catch
  块原会 `socket.destroy()` 杀死已升级连接 → WS `message` 事件静默丢失。现 catch
  内先检查 `ctx.upgraded`， 已升级则不销毁。
- **Node 升级响应 status 101 RangeError**：undici 的 `Response` 构造拒绝 status
  101（须 200-599）。`toUpgradeResponse` 在 `IS_NODE` 下返回
  `Response(null,{status:200})` （Node 升级走 socket 接管，Response
  返回值被忽略）。
- **测试并行竞争**：`file`/`file-ext`/`file-sync`/`hash` 四个测试文件共享
  `./tests/data`，Node 默认并行跑测试文件时并发 mkdir/remove 同一目录 → 偶发
  ENOENT
  /端口失败。各文件改用独立子目录（`./tests/data/{file,file-ext,file-sync,hash}`）。
- **`websocket.test.ts` / `websocket-test.test.ts` 未 await `serve()`**：与
  serve Promise 化配套，`serveWithSystemPort` / `listen` 改为
  `await serve(...)`。

### 变更

- ⚠ **统一测试套件**：删除 `tests/node/`（6 个 `node:test` smoke 文件），三端
  统一跑 `tests/*.test.ts`。Node 经 `@dreamer/test` 的 Node 后端跑同一批主套件，
  不再维护独立冒烟集。
- **`test:node` 脚本**：`tsx --test tests/node/*.test.ts` →
  `tsx --test --test-force-exit tests/*.test.ts`（`--test-force-exit` 解决
  stdin/ server handle 导致 Node 测试进程挂起）。
- **`@dreamer/i18n`**：`1.0.1` → `^1.1.0`。
- **`test:all`**：同步更新为三端统一 `tests/*.test.ts`。

### 验证

- Deno：309 通过，0 失败
- Bun：286 通过，0 失败
- Node：286 通过，0 失败（`tsx --test --test-force-exit tests/*.test.ts`）

---

## [1.2.0] - 2026-07-22

### 新增

- **Node.js 兼容（Phase A）**：`detect`/`env`/`signal`/`process-utils`/
  `process-info`/`file`/`system-info`/`terminal`/`network` 模块现支持 Node.js >=
  22（与 Deno、Bun 并列）。
  - **网络**：`serve`（http.createServer）、`upgradeWebSocket`（ws 包 +
    AsyncLocalStorage 升级上下文）、`connect`（node:net）、`startTls`
    （node:tls）。
  - **WebSocketAdapter**：合并 `IS_BUN` → `IS_BUN || IS_NODE`；修复 Node
    `handleUpgrade` 同步回调导致 "open" 事件丢失。
- **engines.node**：package.json 声明 `>=22`。
- **Node 冒烟测试**：`tests/node/`（`node:test` +
  `tsx`；`if (!IS_NODE) return`）。
- **WebSocket CSWSH 防护**：`ServeOptions.allowedOrigins` — 升级 Origin 校验
  （默认同源；可显式列表；无 Origin 的非浏览器客户端放行）。
- **WebSocket 加固**：`websocket.maxPayload`（默认 1MB）、`idleTimeout` （默认
  120000ms）、以及升级级 `maxPayload` / `allowedOrigins` 覆盖。
- **connect/startTls 超时**：`ConnectOptions.timeout` /
  `StartTlsOptions.timeout`（默认 30000ms；0/负数禁用）。
- **子进程输出上限**：`CommandOptions.maxOutputBytes`（默认 10MB）；超限抛
  `RuntimeAdapterError(OUTPUT_SIZE_EXCEEDED)`。
- **错误码**：`OUTPUT_SIZE_EXCEEDED`。
- **i18n**：`nodeWsNeedServe`、`error.internalServerError`、
  `error.wsOriginRejected`、`error.connectTimeout`、
  `error.tlsHandshakeTimeout`、`error.outputSizeExceeded`。
- **Node `startTls` signal**：types 声明握手超时/取消用第三参。
- **脚本**：`test:deno` / `test:node` / `test:all`。

### 变更

- ⚠ **`removeSync` 默认 `recursive` true → false**：与异步 `remove()` / Deno
  对齐；非空目录须显式 `{ recursive: true }`。
- ⚠ **WebSocket `maxPayload` 默认 100MB → 1MB**：防大消息 OOM，可配置覆盖。
- **`rename` 重试**：源路径 stat 预检 50 → 5 次。
- 移除 `@types/ws`（消除 `@types/node` 对 `Event` 的全局污染）。
- Node `startTls`：`caCerts` 经 `Buffer.from()` 转换。
- 增加 `ws` 依赖与 `tsx`（`test:node`）。
- **文档**：README / CHANGELOG / TEST_REPORT / NODE_COMPAT 对齐三端现状。

### 优化

- Bun `writeFile` / `writeTextFile`：去掉写后 re-read 轮询。
- Bun `open`：真实流式写入，不再每 chunk 整文件重写。
- `stat` 映射抽取；`readFile(Sync)` 零拷贝；`writeFileSync` 免多余拷贝。
- `version` / `execPath` 兜底不再伪装为 `"deno"`。
- `args`：Bun.argv 优先，再与 Node 共用 `process.argv`。
- `makeTempDir`：避免 prefix 以 `X` 结尾。
- `env` provider 懒加载缓存；`readStdin` 命名处理器防监听器泄漏。

### 修复

- Node `serve` 不再向客户端透传 HTTP 500 内部细节。
- WebSocket 升级 Origin 校验（CSWSH）。
- `allAdapters` 关闭时从静态集合移除。
- Node 升级同步回调导致 "open" 丢失。

## [1.1.0] - 2026-07-21

### 新增

- **`RuntimeAdapterError`**：稳定错误码（`UNSUPPORTED_RUNTIME`、
  `ONLY_BUN_OR_DENO`、`PLATFORM_LIMITATION` 等）与 `isRuntimeAdapterError()`。
- **`IS_SUPPORTED` / `assertSupportedRuntime()`**：显式支持运行时检查（仅 Deno /
  Bun，暂不目标 Node）。
- **子路径导出**：`@dreamer/runtime-adapter/fs`、`/path`、`/process`、`/net`，
  便于按需引用。

### 修复

- **Bun 多 `serve` WebSocket 升级**：请求处理走 `AsyncLocalStorage`，
  `upgradeWebSocket` 绑定当前请求的 server，避免全局单例串台。
- **Bun 无 `process.chdir` 时的 `chdir`**：抛出带 `PLATFORM_LIMITATION` 的
  `RuntimeAdapterError`。

### 变更

- file / env / process-utils：不支持的运行时统一抛 `RuntimeAdapterError`。
- 开发依赖 `@dreamer/test` 升至 `^1.1.10`。

### 修复（补充）

- **macOS 磁盘用量**：`getDiskUsage` 在 darwin 上使用 `df -k`（并换算为字节），
  不再使用 Linux 专用的 `df -B1`。

---

## [1.0.19] - 2026-06-26

### 修复

- **Deno 下 `serve()` WebSocket 升级**：请求处理器不再用 `async/await`
  包装，handler 可同步返回 `upgradeWebSocket` 的原始 101 响应，修复经 `serve()`
  升级 WebSocket 时的 `Upgrade response was not returned from
  callback` 错误。
- **WebSocket 集成测试**：测试用 mock 服务器（`tests/websocket.ts`）在
  `upgradeWebSocket()` 前读取握手信息、立即返回 101，并通过 microtask 延迟创建
  Socket 与中间件，满足 Deno 升级约束。

### 变更

- **CI**：工作流增加 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` 环境变量，用于 GitHub
  Actions Node 24 验证。

---

## [1.0.18] - 2026-02-25

### 修复

- **args() 在 Bun（Windows）下**：在 Bun 下运行时，`args()` 现在优先使用
  `Bun.argv` 而非 `process.argv`，以便在 Windows 上正确拿到脚本参数（例如
  `bun run script.ts -- --build` 中的 `--build`），避免 `process.argv`
  未传递的问题。

### 新增

- **process-utils 测试**：为 `args()` 增加测试（多次调用、Bun 环境）；Windows
  Bun 下 `--build` 的完整行为由 dweb CI 覆盖。

---

## [1.0.17] - 2026-02-22

### 新增

- **路径 API – `fromFileUrl()`**：将 `file://` URL（字符串或 `URL` 对象）转为
  文件系统路径（统一正斜杠）。在 Windows 下用 Bun 启动子进程并传入脚本路径时，
  `URL.pathname` 会得到 `/D:/...` 导致 spawn 失败，可改用
  `fromFileUrl(new URL("./script.ts", import.meta.url))` 得到 Bun 可识别的路径。

### 修复

- **fromFileUrl 测试在 Windows 下**：测试改为在 Windows 上使用本平台有效的 file
  URL（Node `fileURLToPath` 要求绝对路径，Unix 风格 `file:///home/...`
  会抛错）。 Deno 与 Bun Windows CI 通过。

---

## [1.0.16] - 2026-02-21

### 修复

- **Windows Bun CI – 系统信息 platform**：`getSystemInfo()` 与
  `getSystemInfoSync()` 现在将 Node/Bun 的 `"win32"` 规范化为 `"windows"`，
  返回的 `platform` 为 `linux`、`darwin`、`windows` 或 `unknown` 之一，与 Deno
  及测试预期一致。
- **Windows Bun CI – pathToFileUrl**：`pathToFileUrl()` 现在将返回的 `file://`
  URL 中的反斜杠规范化为正斜杠，在 Windows（含 Bun）下行为一致， 测试通过。
- **Windows Bun CI – cron 关闭测试**：定时任务测试「应该支持关闭定时任务」
  现在允许在 `handle.close()` 之后至多多执行一次，以兼容 Windows/Bun 下
  node-cron 在 stop 后可能再触发一次的情况。

---

## [1.0.15] - 2026-02-19

### 变更

- **i18n**：初始化改为在加载 i18n
  模块时自动执行。入口文件（`mod.ts`、`detect.ts`）不再导入或调用
  `initRuntimeAdapterI18n`；请从你的代码中移除相关用法。

---

## [1.0.14] - 2026-02-19

### 变更

- **i18n**：翻译方法由 `$t` 重命名为 `$tr`，避免与全局 `$t`
  冲突。请将现有代码中本包消息改为使用 `$tr`。

---

## [1.0.13] - 2026-02-18

### 变更

- **i18n**：所有面向用户与日志的文案统一经 `$t` 从 locale
  获取，不再硬编码中英文。 新增 `debug.*` 与 `error.bunRethrowSubstring1/2` 至
  en-US、zh-CN；WebSocket 调试 文案与 Bun execFileSync 重抛检测均走
  i18n。翻译入口仅保留 `$t`（无 `tr` 方法）。

---

## [1.0.12] - 2026-02-18

### 修复

- **Bun WebSocket fetch 返回值**：对 WebSocket 升级请求先 await handler
  完成再返回 101 Response，不再返回 undefined。Bun 在收到 undefined 时会报
  "Expected a Response object" 并导致客户端连接失败；改为在 handler 完成后返回
  101，升级正常且错误消失。已同时修复两种 serve() 重载（函数形式与对象形式）。

---

## [1.0.11] - 2026-02-18

### 修复

- **Bun WebSocket open 事件时机**：在 `setWebSocket` 中改为用 `setTimeout(0)`
  而非 `queueMicrotask` 触发适配器 `open` 事件。Bun 在 `upgrade()` 内同步调用
  `websocket.open(ws)`，此时 handler 尚未执行到
  `addEventListener("open", ...)`； 微任务仍在 handler 继续之前执行，故
  listeners 为 0。推迟到下一宏任务再 `emit("open")`，确保 handler
  已注册监听器，服务端 send（如 "Hello from server"） 能正确下发。

### 新增

- **WebSocket 调试日志**：设置环境变量 `RUNTIME_ADAPTER_DEBUG_WS=1` 可输出
  fetch、upgradeWebSocket、open(ws)、setWebSocket 的调试日志，便于排查问题。

---

## [1.0.10] - 2026-02-18

### 修复

- **Bun WebSocket 升级**：在调用 `bunServerInstance.upgrade(request)` **之前**
  先创建并注册 WebSocket 适配器到 `pendingBunAdapters`。Bun 可能在 `upgrade()`
  期间同步调用 `websocket.open(ws)`；若在 `upgrade()` 之后才创建
  适配器，`open(ws)` 无法找到适配器，导致 `setWebSocket(ws)` 从未被调用， 服务端
  `send()` 一直留在 `pendingOperations`，客户端收不到消息（如批量心跳
  ping）。现在 `open(ws)` 能正确解析适配器并执行待发送队列。

---

## [1.0.9] - 2026-02-18

### 新增

- **i18n**：错误信息（不支持的运行时、文件/进程/网络/终端/cron）现可通过
  `@dreamer/i18n` 配合 en-US、zh-CN
  语言包翻译。新增导出：`$t`、`initRuntimeAdapterI18n`、`Locale`。`detect.ts`
  使用 `$t("error.onlyBunOrDeno")`；i18n 不依赖 `detect.ts` 以避免循环依赖。

---

## [1.0.8] - 2026-02-17

### 新增

- **SpawnedProcess.unref()**：等待子进程 status 后允许父进程退出（Deno 默认会
  ref 子进程，在 `await child.status` 后调用 `unref()` 以便 CLI
  能正常退出）。Bun 下为 no-op。

---

## [1.0.7] - 2026-02-16

### 修复

- **path resolve 根路径测试（Windows）**：改为按平台断言；Windows 上
  `resolve("/", "file.txt")` 返回当前盘符根（如 `D:/file.txt`），而非
  `/file.txt`。

---

## [1.0.6] - 2026-02-16

### 变更

- **path.join**：仅采用 node:path 语义，结果统一为正斜杠（如
  `join(".", "file.txt")` 返回 `"file.txt"`），移除补 `"./"` 的特殊逻辑。
- **hash API**：统一使用 `node:crypto`（异步与同步），Deno 与 Bun
  均支持静态导入；移除 `IS_DENO`/`IS_BUN` 及 `require` 回退。
- **文档**：Path API 说明（join 语义、正斜杠）；Hash API
  说明（node:crypto、Deno/Bun）；TEST_REPORT 哈希用例 10→11，总测试 266→267。
- **许可**：项目许可已更换为 Apache 2.0。

---

## [1.0.5] - 2026-02-10

### 变更

- **CI**：移除 Bun 测试 job（CI 中 JSR 依赖解析问题）；CI 仅在
  Linux、macOS、Windows 上运行 Deno 测试
- **CI**：将 package.json 恢复至 .gitignore（不再提交）
- **CI**：调整 job 顺序，将 test-windows 放最后（Linux → macOS → Windows）

---

## [1.0.4] - 2025-02-07

### 修复

- **pathToFileUrl 测试（Windows）**：POSIX 绝对路径的平台特定断言；Windows 上
  pathToFileURL 会解析为当前驱动器路径（如 `file:///D:/home/user/config.ts`）

### 变更

- **WebSocket 测试**：改用系统分配端口（`port: 0`）替代固定端口，避免 AddrInUse
  冲突

---

## [1.0.3] - 2025-02-07

### 新增

- **CI 工作流**：GitHub Actions 在 Linux、macOS、Windows 上运行 CI（deno
  check、lint、test）

### 修复

- **Windows chmod**：chmod 包裹 try-catch（Windows 可能不支持）
- **Windows chdir**：路径断言兼容反斜杠
- **Windows path resolve**：按平台区分 Unix/Windows 路径断言
- **Windows 进程**：cd 需通过 `cmd /c cd` 调用；spawn 用 sort/cat；env 用
  set/printenv；cwd 用 cmd /c cd
- **Deno check**：crypto 脚本用 globalThis.require；file.test 用
  globalThis.process
- **watchFs 测试**：接受 create 或 modify 事件（Bun/Node fs.watch 可能报告
  modify）
- **WebSocket 测试**：ws.send 包裹 try-catch；Windows cd
  修复；端口计数器+延迟避免 AddrInUse

---

## [1.0.2] - 2025-02-07

### 修复

- **Bun createCommand stdin**：将 Bun FileSink 包装为 Web Streams
  WritableStream，使 `proc.stdin.getWriter()` 可用（Bun 返回 write/end 接口的
  FileSink，不含 getWriter）
- **Bun createCommand stdio**：将 `"null"` 映射为 `"ignore"`、`"piped"` 映射为
  `"pipe"`，以符合 Bun spawn 选项（Bun 不接受字符串 `"null"`）
- **Bun 导出解析**：在 mod.ts 中显式导出 `execPath`，便于 Bun
  workspace/本地依赖解析

### 新增

- **package.json exports**：增加 `exports` 字段，支持 Bun workspace 与本地 file:
  依赖解析

---

## [1.0.1] - 2025-02-07

### 新增

- **execPath**：进程信息 API 新增 `execPath()`，返回运行时可执行文件路径
- **Windows 兼容性文档**：新增 `WINDOWS_COMPATIBILITY_ANALYSIS.md`（英文）与
  `WINDOWS_COMPATIBILITY_ANALYSIS-zh.md`（中文）

### 修复

- **path.relative() 跨盘符**：Windows 上 `relative("C:/a/b", "D:/x/y")`
  现正确返回 `D:/x/y`（与 Node.js 一致）
- **process-info execPath**：修复 Deno/Bun 类型断言，解决 `execPath` 类型错误
- **测试**：修复 open/create/watchFs 的 BadResource 错误；修复 watchFs 的 timer
  泄漏（clearTimeout）

### 变更

- **System Info 的 wmic 备选**：Windows 上 `getMemoryInfo`、`getDiskUsage`、CPU
  核心数在 wmic 不可用时自动回退到 PowerShell `Get-CimInstance`（兼容 Windows 11
  24H2+）
- **README**：补充平台支持说明（Linux/macOS/Windows）及 Windows 平台注意事项
- **平台支持**：README 进程信息 API 表格中新增 `execPath()` 说明
- **文档**：README/README-zh 修复 MD024 重复标题；TEST_REPORT 更新（266
  测试）；删除 TEST_COVERAGE_ANALYSIS.md

---

## [1.0.0] - 2026-02-06

### 新增

- **稳定版发布**：首个稳定版本，API 稳定
- **运行时自动检测**：自动检测 Deno / Bun 运行环境
- **文件系统
  API**：readFile、writeFile、mkdir、remove、existsSync、makeTempDir、makeTempFile
  等
- **网络 API**：serve、upgradeWebSocket、TCP/TLS 连接
- **环境变量 API**：getEnv、setEnv、hasEnv、deleteEnv
- **进程/命令 API**：spawn、exec、kill 等
- **进程信息 API**：进程 ID、平台、架构、版本信息
- **进程工具 API**：命令行参数、程序退出
- **信号处理 API**：SIGTERM、SIGINT、SIGUSR1、SIGUSR2 监听
- **终端 API**：TTY 检测、标准流、原始模式
- **Cron API**：Cron 定时任务（基于 node-cron），支持秒级
- **路径 API**：join、resolve、dirname、basename、relative 等
- **文件哈希 API**：SHA-256、SHA-512、SHA-1、MD5
- **系统信息 API**：内存、CPU、磁盘使用、系统负载、主机名等

### 兼容性

- Deno 2.6+
- Bun 1.3.5+
