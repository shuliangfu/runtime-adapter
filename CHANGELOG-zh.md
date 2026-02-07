# 变更日志

[English](./CHANGELOG.md) | 中文 (Chinese)

本文件记录 @dreamer/runtime-adapter 的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [1.0.1] - 2025-02-07

### 新增

- **execPath**：进程信息 API 新增 `execPath()`，返回运行时可执行文件路径
- **Windows 兼容性文档**：新增 `WINDOWS_COMPATIBILITY_ANALYSIS.md`（英文）与 `WINDOWS_COMPATIBILITY_ANALYSIS-zh.md`（中文）

### 修复

- **path.relative() 跨盘符**：Windows 上 `relative("C:/a/b", "D:/x/y")` 现正确返回 `D:/x/y`（与 Node.js 一致）
- **process-info execPath**：修复 Deno/Bun 类型断言，解决 `execPath` 类型错误
- **测试**：修复 open/create/watchFs 的 BadResource 错误；修复 watchFs 的 timer 泄漏（clearTimeout）

### 变更

- **System Info 的 wmic 备选**：Windows 上 `getMemoryInfo`、`getDiskUsage`、CPU 核心数在 wmic 不可用时自动回退到 PowerShell `Get-CimInstance`（兼容 Windows 11 24H2+）
- **README**：补充平台支持说明（Linux/macOS/Windows）及 Windows 平台注意事项
- **平台支持**：README 进程信息 API 表格中新增 `execPath()` 说明
- **文档**：README/README-zh 修复 MD024 重复标题；TEST_REPORT 更新（266 测试）；删除 TEST_COVERAGE_ANALYSIS.md

---

## [1.0.0] - 2026-02-06

### 新增

- **稳定版发布**：首个稳定版本，API 稳定
- **运行时自动检测**：自动检测 Deno / Bun 运行环境
- **文件系统 API**：readFile、writeFile、mkdir、remove、existsSync、makeTempDir、makeTempFile 等
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
