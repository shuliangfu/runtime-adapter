# 变更日志

[English](../en-US/CHANGELOG.md) | 中文 (Chinese)

本文件记录 @dreamer/runtime-adapter 的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

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
