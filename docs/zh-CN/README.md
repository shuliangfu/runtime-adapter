# @dreamer/runtime-adapter

> 运行时适配层包，提供统一的运行时 API 抽象层，兼容 Deno 和 Bun 运行时环境

[English](../../README.md) | 中文 (Chinese)

[![JSR](https://jsr.io/badges/@dreamer/runtime-adapter)](https://jsr.io/@dreamer/runtime-adapter)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](../../LICENSE)
[![Tests](https://img.shields.io/badge/tests-267%20passed-brightgreen)](./TEST_REPORT.md)

---

## 🎯 功能

运行时适配层，让其他 `@dreamer/*` 包可以在不同运行时环境中使用相同的 API。

---

## ✨ 特性

- **运行时自动检测**：
  - 自动检测当前运行环境（Deno / Bun）
  - 提供运行时类型定义和常量
- **完全类型安全**：
  - 所有 API 都有完整的 TypeScript 类型定义
  - 零 `any` 类型，使用类型守卫和明确的接口定义
  - 运行时 API 访问通过类型安全的工具函数
  - 完善的类型定义覆盖 Deno 和 Bun 的所有运行时 API
- **文件系统 API 适配**：
  - 统一的文件读写、目录操作接口
  - 支持同步和异步操作
  - 文件监控、目录遍历、临时文件/目录
- **网络 API 适配**：
  - HTTP 服务器（自动适配 Deno 和 Bun）
  - WebSocket 升级（统一 API，自动适配）
  - TCP/TLS 连接
- **环境变量 API 适配**：
  - 统一的环境变量操作接口
  - 支持获取、设置、删除、检查
- **进程/命令 API 适配**：
  - 统一的命令执行接口
  - 支持同步和异步执行
  - 进程管理（PID、状态、终止）
- **进程信息 API 适配**：
  - 进程 ID、平台、架构、版本信息
  - 运行时版本检测
- **进程工具 API 适配**：
  - 命令行参数获取
  - 程序退出
- **工具 API 适配**：
  - 类型安全的运行时访问：`getDeno()`、`getBun()`、`getProcess()`、`getBuffer()`
- **信号处理 API 适配**：
  - 操作系统信号监听和处理
  - 支持 SIGTERM、SIGINT、SIGUSR1、SIGUSR2
- **终端 API 适配**：
  - TTY 检测（标准输入、输出、错误）
  - 标准输入输出流（异步和同步）
  - 原始模式支持
- **定时任务 API 适配**：
  - Cron 定时任务（统一使用 `node-cron`）
  - 支持秒级任务
  - AbortSignal 支持
- **路径操作 API 适配**：
  - 路径拼接、解析、规范化，dirname、basename、extname
  - 相对路径计算，绝对/相对路径判断
  - file URL 与路径互转（`fromFileUrl`、`pathToFileUrl`）
- **文件哈希 API 适配**：
  - 文件和数据哈希计算
  - 支持同步和异步
  - 支持 SHA-256、SHA-512、SHA-1、MD5
- **系统信息 API 适配**：
  - 内存、CPU、磁盘使用情况
  - 系统负载（Linux/macOS）
  - 系统信息（主机名、平台、架构、运行时间）
  - 支持同步和异步

---

## 🎨 设计原则

__所有 @dreamer/_ 包都遵循以下原则_*：

- **主包（@dreamer/xxx）**：用于服务端（兼容 Deno 和 Bun 运行时）
- **客户端子包（@dreamer/xxx/client）**：用于客户端（浏览器环境）

这样可以：

- 明确区分服务端和客户端代码
- 避免在客户端代码中引入服务端依赖
- 提供更好的类型安全和代码提示
- 支持更好的 tree-shaking

---

## 🎯 使用场景

- **跨运行时包开发**：Bun 和 Deno 兼容的包开发
- **运行时 API 统一抽象**：统一不同运行时的 API 差异
- **基础依赖包**：其他 `@dreamer/*` 包的基础依赖

---

## 📦 安装

### Deno

```bash
deno add jsr:@dreamer/runtime-adapter
```

### Bun

```bash
bunx jsr add @dreamer/runtime-adapter
```

---

## 🌍 环境兼容性

| 环境       | 版本要求          | 状态                                  |
| ---------- | ----------------- | ------------------------------------- |
| **Deno**   | 2.5+              | ✅ 完全支持                           |
| **Bun**    | 1.0+              | ✅ 完全支持                           |
| **服务端** | -                 | ✅ 支持（兼容 Deno 和 Bun 运行时）    |
| **客户端** | -                 | ❌ 不支持（浏览器环境）               |
| **依赖**   | `node-cron@3.0.3` | 📦 用于定时任务，支持秒级 Cron 表达式 |

### 平台支持

| 平台        | Deno | Bun | 说明                                    |
| ----------- | ---- | --- | --------------------------------------- |
| **Linux**   | ✅   | ✅  | 完全支持                                |
| **macOS**   | ✅   | ✅  | 完全支持                                |
| **Windows** | ✅   | ✅  | 完全支持；部分 API 有平台差异（见下方） |

**Windows 平台说明**：

- **Path API**：`join` 遵循 node:path 语义，结果统一为正斜杠（如
  `join(".", "file.txt")` → `"file.txt"`）；支持 `C:\` 风格绝对路径；跨盘符时
  `relative()` 返回目标路径
- **Signal API**：Windows 上 SIGTERM 在 Deno 中不注册（静默跳过），Bun 正常
- **Terminal API**：`setStdinRaw` 在 Windows 可能返回 `false`（Deno 抛出 "The
  operation is not supported" 时捕获并回退）
- **System Info API**：`getLoadAverage()` 在 Windows 返回
  `undefined`；内存/磁盘使用 `wmic` 获取
- **Temp 目录**：Bun 使用 `os.tmpdir()`（如
  `C:\Users\xxx\AppData\Local\Temp`），Deno 使用原生 API
- **File API**：`chown` 在 Windows 上会抛出 EPERM（不支持）；`symlink`
  需管理员或开发者模式
- **System Info**：优先使用 `wmic`，不可用时自动回退到 PowerShell
  `Get-CimInstance`（如 Windows 11 24H2+）

详细分析见 [WIN_COMPAT.md](./WIN_COMPAT.md)。

---

## 🚀 快速开始

### 运行时检测

```typescript
import {
  detectRuntime,
  IS_BUN,
  IS_DENO,
  RUNTIME,
} from "jsr:@dreamer/runtime-adapter";

// 检测运行时
const runtime = detectRuntime(); // "deno" | "bun" | "unknown"

// 使用常量
if (IS_BUN) {
  console.log("运行在 Bun 环境");
}

if (IS_DENO) {
  console.log("运行在 Deno 环境");
}

console.log("当前运行时:", RUNTIME);
```

### 文件系统操作

#### 文件系统 - 异步 API

```typescript
import {
  chdir,
  chmod,
  chown,
  copyFile,
  cwd,
  ensureDir,
  exists,
  isDirectory,
  isFile,
  makeTempDir,
  makeTempFile,
  mkdir,
  readdir,
  readFile,
  readTextFile,
  realPath,
  remove,
  rename,
  stat,
  symlink,
  truncate,
  walk,
  watchFs,
  writeFile,
  writeTextFile,
} from "jsr:@dreamer/runtime-adapter";

// 读取文件（自动适配 Bun 或 Deno）
const data = await readFile("./file.txt");
const text = await readTextFile("./file.txt");

// 写入文件
await writeFile("./output.txt", new Uint8Array([1, 2, 3]));
await writeTextFile("./output.txt", "Hello, World!");

// 目录操作
await mkdir("./data", { recursive: true });
await ensureDir("./data/subdir"); // 确保目录存在（如果不存在则创建）
await remove("./data", { recursive: true });

// 获取文件信息
const info = await stat("./file.txt");
console.log("文件大小:", info.size);
console.log("是否为文件:", info.isFile);

// 读取目录内容
const entries = await readdir("./data");
for (const entry of entries) {
  console.log(`${entry.name} - ${entry.isFile ? "文件" : "目录"}`);
}

// 复制文件
await copyFile("./source.txt", "./dest.txt");

// 重命名或移动文件
await rename("./old.txt", "./new.txt");

// 创建符号链接
await symlink("./target.txt", "./link.txt", "file");

// 获取真实路径（解析符号链接）
const realPath = await realPath("./link.txt");
console.log("真实路径:", realPath);

// 修改文件权限
await chmod("./file.txt", 0o755);

// 修改文件所有者（需要相应权限）
await chown("./file.txt", 1000, 1000);

// 文件扩展功能
if (await exists("./file.txt")) {
  console.log("文件存在");
}
if (await isFile("./file.txt")) {
  console.log("这是一个文件");
}
if (await isDirectory("./data")) {
  console.log("这是一个目录");
}
await truncate("./file.txt", 100); // 截断文件到 100 字节

// 创建临时目录和文件
const tempDir = await makeTempDir({ prefix: "my-app-" });
const tempFile = await makeTempFile({ prefix: "temp-", suffix: ".txt" });

// 获取和更改工作目录
const currentDir = cwd();
console.log("当前目录:", currentDir);
await chdir("./subdirectory");

// 目录遍历
for await (
  const path of walk("./src", {
    includeDirs: false,
    match: (p) => p.endsWith(".ts"),
  })
) {
  console.log("找到文件:", path);
}

// 文件监控（监听项目所有文件，排除指定目录）
const watcher = watchFs(".", {
  recursive: true,
  filesOnly: true, // 只监听文件，排除目录
  exclude: [
    "uploads", // 排除包含 "uploads" 的路径
    "runtime", // 排除包含 "runtime" 的路径
    /node_modules/, // 使用正则表达式排除 node_modules
    /\.git/, // 排除 .git 目录
  ],
});

for await (const event of watcher) {
  console.log("文件变化:", event.kind, event.paths);
}
```

#### 文件系统 - 同步 API ⭐ 新增

```typescript
import {
  ensureDirSync,
  existsSync,
  isDirectorySync,
  isFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readTextFileSync,
  realPathSync,
  removeSync,
  statSync,
  writeFileSync,
  writeTextFileSync,
} from "jsr:@dreamer/runtime-adapter";

// 同步读取文件
const data = readFileSync("./file.txt");
const text = readTextFileSync("./file.txt");

// 同步写入文件
writeFileSync("./output.txt", new Uint8Array([1, 2, 3]));
writeTextFileSync("./output.txt", "Hello, World!");

// 同步目录操作
mkdirSync("./data", { recursive: true });
ensureDirSync("./data/subdir"); // 同步确保目录存在（如果不存在则创建）
removeSync("./data", { recursive: true });

// 同步获取文件信息
const info = statSync("./file.txt");
console.log("文件大小:", info.size);

// 同步读取目录内容
const entries = readdirSync("./data");
for (const entry of entries) {
  console.log(`${entry.name} - ${entry.isFile ? "文件" : "目录"}`);
}

// 同步检查文件/目录
if (existsSync("./file.txt")) {
  console.log("文件存在");
}
if (isFileSync("./file.txt")) {
  console.log("这是一个文件");
}
if (isDirectorySync("./data")) {
  console.log("这是一个目录");
}

// 同步获取真实路径
const realPath = realPathSync("./link.txt");
console.log("真实路径:", realPath);
```

### 网络操作

```typescript
import {
  connect,
  serve,
  startTls,
  upgradeWebSocket,
} from "jsr:@dreamer/runtime-adapter";

// HTTP 服务器（自动适配 Bun 或 Deno）
const handle = await serve({ port: 3000 }, (req) => {
  const url = new URL(req.url);

  // WebSocket 升级（自动适配 Bun 或 Deno）
  if (url.pathname === "/ws") {
    const { socket, response } = upgradeWebSocket(req, {
      idleTimeout: 120,
    });

    // 使用标准的 addEventListener API（Deno 和 Bun 都支持）
    socket.addEventListener("open", () => {
      console.log("WebSocket 连接已建立");
    });

    socket.addEventListener("message", (event) => {
      console.log("收到消息:", event.data);
      socket.send(`Echo: ${event.data}`);
    });

    socket.addEventListener("close", () => {
      console.log("WebSocket 连接已关闭");
    });

    // Bun 环境下 response 可能为 undefined（由 Bun 自动处理）
    return response || new Response("WebSocket upgrade", { status: 101 });
  }

  return new Response("Hello, World!");
});

// 获取服务器端口
console.log("服务器运行在端口:", handle.port);

// 关闭服务器
await handle.shutdown();

// TCP 连接
const conn = await connect({
  host: "example.com",
  port: 80,
});

// TLS 连接
const tlsConn = await startTls(conn, {
  host: "example.com",
});
```

### 环境变量

```typescript
import {
  deleteEnv,
  getEnv,
  getEnvAll,
  hasEnv,
  setEnv,
} from "jsr:@dreamer/runtime-adapter";

// 获取环境变量（自动适配 Bun 或 Deno）
const apiKey = getEnv("API_KEY");

// 设置环境变量
setEnv("DEBUG", "true");

// 获取所有环境变量
const allEnv = getEnvAll();

// 检查环境变量是否存在
if (hasEnv("NODE_ENV")) {
  console.log("NODE_ENV 已设置");
}

// 删除环境变量
deleteEnv("DEBUG");
```

### 命令执行

#### 命令 - 异步执行

```typescript
import { createCommand } from "jsr:@dreamer/runtime-adapter";

// 方式1：使用 output() 执行命令并获取输出（推荐用于简单场景）
const cmd = createCommand("ls", {
  args: ["-la"],
  cwd: "./",
  stdout: "piped",
  stderr: "piped",
});

const output = await cmd.output();
console.log("标准输出:", new TextDecoder().decode(output.stdout));
console.log("标准错误:", new TextDecoder().decode(output.stderr));
console.log("退出码:", output.code);
console.log("是否成功:", output.success);

// 方式2：使用 spawn() 获取子进程句柄（适用于需要控制进程的场景）
const cmd2 = createCommand("sleep", {
  args: ["10"],
  stdout: "inherit",
  stderr: "inherit",
});

const child = cmd2.spawn();
console.log("进程 PID:", child.pid);

// 等待进程完成
const status = await child.status;
console.log("进程状态:", status);

// 或者终止进程
// child.kill(15); // SIGTERM
```

#### 命令 - 同步执行 ⭐ 新增

```typescript
import { execCommandSync } from "jsr:@dreamer/runtime-adapter";

// 同步执行命令并获取输出
try {
  const output = execCommandSync("echo", ["Hello, World!"]);
  console.log("输出:", output.trim());
} catch (error) {
  console.error("命令执行失败:", error);
}

// 支持工作目录和环境变量
const result = execCommandSync("pwd", [], {
  cwd: "./src",
  env: { CUSTOM_VAR: "value" },
});
console.log("工作目录:", result.trim());
```

### 终端检测和操作

```typescript
import {
  getStderr,
  getStdout,
  isStderrTerminal,
  isStdinTerminal,
  isTerminal,
  readStdin,
  setStdinRaw,
  writeStderrSync,
  writeStdoutSync,
} from "jsr:@dreamer/runtime-adapter";

// 检查是否为终端（自动适配 Bun 或 Deno）
if (isTerminal()) {
  console.log("运行在终端环境中");
}

if (isStderrTerminal()) {
  console.log("标准错误输出是终端");
}

if (isStdinTerminal()) {
  console.log("标准输入是终端");
}

// 获取标准输出流（异步写入）
const stdout = getStdout();
const writer = stdout.getWriter();
await writer.write(new TextEncoder().encode("Hello\n"));
writer.releaseLock();

// 获取标准错误输出流（异步写入）
const stderr = getStderr();
const stderrWriter = stderr.getWriter();
await stderrWriter.write(new TextEncoder().encode("Error message\n"));
stderrWriter.releaseLock();

// 同步写入标准输出（适用于 ANSI 转义序列等场景）
const encoder = new TextEncoder();
writeStdoutSync(encoder.encode("\x1b[32m绿色文本\x1b[0m\n"));

// 同步写入标准错误输出
writeStderrSync(encoder.encode("错误消息\n"));

// 读取标准输入
const buffer = new Uint8Array(1024);
const bytesRead = await readStdin(buffer);
if (bytesRead !== null) {
  const input = new TextDecoder().decode(buffer.subarray(0, bytesRead));
  console.log("用户输入:", input);
}

// 设置标准输入为原始模式（用于交互式输入，如密码输入）
const isRaw = setStdinRaw(true, { cbreak: true });
if (isRaw) {
  // 原始模式已启用，可以逐字符读取
  // 使用完毕后恢复
  setStdinRaw(false);
}
```

### 定时任务

```typescript
import { cron } from "jsr:@dreamer/runtime-adapter";

// 注册 Cron 任务（自动适配 Bun 或 Deno）
// 统一使用 node-cron，支持秒级 Cron 表达式
// 注意：cron 函数是同步的，直接返回 CronHandle

// 每分钟执行一次
const handle1 = cron("0 * * * * *", async () => {
  console.log("每分钟执行");
});

// 每 5 秒执行一次（支持秒级）
const handle2 = cron("*/5 * * * * *", async () => {
  console.log("每 5 秒执行");
});

// 每天凌晨 2 点执行
const handle3 = cron("0 0 2 * * *", async () => {
  console.log("每天凌晨 2 点执行");
});

// 取消任务（可以使用 close 或 stop）
handle1.close();
handle2.stop(); // stop 是 close 的别名
handle3.close();

// 使用 AbortSignal 取消任务
const controller = new AbortController();
const handle4 = cron("*/10 * * * * *", async () => {
  console.log("每 10 秒执行");
}, { signal: controller.signal });

// 稍后取消
setTimeout(() => {
  controller.abort();
}, 60000);
```

### 文件哈希

#### 文件哈希 - 异步 API

```typescript
import { hash, hashFile } from "jsr:@dreamer/runtime-adapter";

// 计算文件哈希
const fileHash = await hashFile("./file.txt");
console.log("文件哈希:", fileHash);

// 计算字符串哈希
const stringHash = await hash("Hello, World!");
console.log("字符串哈希:", stringHash);

// 使用不同的算法
const sha512 = await hashFile("./file.txt", "SHA-512");
const md5 = await hash("Hello, World!", "MD5");
```

#### 文件哈希 - 同步 API ⭐ 新增

```typescript
import { hashFileSync, hashSync } from "jsr:@dreamer/runtime-adapter";

// 同步计算文件哈希
const fileHash = hashFileSync("./file.txt");
console.log("文件哈希:", fileHash);

// 同步计算字符串哈希
const stringHash = hashSync("Hello, World!");
console.log("字符串哈希:", stringHash);

// 使用不同的算法
const sha512 = hashFileSync("./file.txt", "SHA-512");
const md5 = hashSync("Hello, World!", "MD5");
```

> 📌 **注意**：哈希 API 使用 `node:crypto`，Deno 与 Bun 均支持。

### 系统信息

#### 系统信息 - 异步 API

```typescript
import {
  getCpuUsage,
  getDiskUsage,
  getLoadAverage,
  getMemoryInfo,
  getSystemInfo,
  getSystemStatus,
} from "jsr:@dreamer/runtime-adapter";

// 获取内存信息
const memory = await getMemoryInfo();
console.log(`总内存: ${(memory.total / 1024 / 1024 / 1024).toFixed(2)} GB`);
console.log(`已使用: ${(memory.used / 1024 / 1024 / 1024).toFixed(2)} GB`);
console.log(`使用率: ${memory.usagePercent.toFixed(2)}%`);

// 获取 CPU 使用率
const cpu = await getCpuUsage();
console.log(`CPU 使用率: ${cpu.usagePercent.toFixed(2)}%`);
console.log(`用户态: ${cpu.userPercent.toFixed(2)}%`);
console.log(`系统态: ${cpu.systemPercent.toFixed(2)}%`);

// 获取磁盘使用情况
const disk = await getDiskUsage("/");
console.log(`磁盘总空间: ${(disk.total / 1024 / 1024 / 1024).toFixed(2)} GB`);
console.log(`已使用: ${(disk.used / 1024 / 1024 / 1024).toFixed(2)} GB`);
console.log(`使用率: ${disk.usagePercent.toFixed(2)}%`);

// 获取系统负载（Linux/macOS）
const load = await getLoadAverage();
if (load) {
  console.log(`1分钟负载: ${load.load1.toFixed(2)}`);
  console.log(`5分钟负载: ${load.load5.toFixed(2)}`);
  console.log(`15分钟负载: ${load.load15.toFixed(2)}`);
}

// 获取系统信息
const system = await getSystemInfo();
console.log(`主机名: ${system.hostname}`);
console.log(`平台: ${system.platform}`);
console.log(`架构: ${system.arch}`);
console.log(`运行时间: ${(system.uptime / 3600).toFixed(2)} 小时`);
if (system.cpus) {
  console.log(`CPU 核心数: ${system.cpus}`);
}

// 获取完整的系统状态
const status = await getSystemStatus();
console.log("系统状态:", status);
```

#### 系统信息 - 同步 API ⭐ 新增

```typescript
import {
  getLoadAverageSync,
  getMemoryInfoSync,
  getSystemInfoSync,
} from "jsr:@dreamer/runtime-adapter";

// 同步获取内存信息
const memory = getMemoryInfoSync();
console.log(`总内存: ${(memory.total / 1024 / 1024 / 1024).toFixed(2)} GB`);

// 同步获取系统负载
const load = getLoadAverageSync();
if (load) {
  console.log(`1分钟负载: ${load.load1.toFixed(2)}`);
}

// 同步获取系统信息
const system = getSystemInfoSync();
console.log(`主机名: ${system.hostname}`);
console.log(`平台: ${system.platform}`);
```

---

## 📚 API 文档

### 运行时检测 API

| API               | 说明               | 返回值                         |
| ----------------- | ------------------ | ------------------------------ |
| `detectRuntime()` | 检测当前运行时环境 | `"deno" \| "bun" \| "unknown"` |
| `RUNTIME`         | 当前运行时常量     | `"deno" \| "bun"`              |
| `IS_BUN`          | 是否为 Bun 环境    | `boolean`                      |
| `IS_DENO`         | 是否为 Deno 环境   | `boolean`                      |
| `type Runtime`    | 运行时类型定义     | `"deno" \| "bun" \| "unknown"` |

### 文件系统 API

#### 异步文件读写

| API                                                   | 说明               | 返回值                |
| ----------------------------------------------------- | ------------------ | --------------------- |
| `readFile(path: string)`                              | 读取文件（二进制） | `Promise<Uint8Array>` |
| `readTextFile(path: string)`                          | 读取文本文件       | `Promise<string>`     |
| `writeFile(path: string, data: Uint8Array, options?)` | 写入文件（二进制） | `Promise<void>`       |
| `writeTextFile(path: string, data: string, options?)` | 写入文本文件       | `Promise<void>`       |
| `open(path: string, options?)`                        | 打开文件           | `Promise<File>`       |
| `create(path: string)`                                | 创建文件           | `Promise<File>`       |

#### 同步文件读写 ⭐ 新增

| API                                                       | 说明                   | 返回值       |
| --------------------------------------------------------- | ---------------------- | ------------ |
| `readFileSync(path: string)`                              | 同步读取文件（二进制） | `Uint8Array` |
| `readTextFileSync(path: string)`                          | 同步读取文本文件       | `string`     |
| `writeFileSync(path: string, data: Uint8Array, options?)` | 同步写入文件（二进制） | `void`       |
| `writeTextFileSync(path: string, data: string, options?)` | 同步写入文本文件       | `void`       |

#### 异步目录操作

| API                                 | 说明                             | 选项                                                                                                                                                          |
| ----------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mkdir(path: string, options?)`     | 创建目录                         | `recursive?: boolean`<br>`mode?: number`                                                                                                                      |
| `ensureDir(path: string, options?)` | 确保目录存在（如果不存在则创建） | `mode?: number`                                                                                                                                               |
| `remove(path: string, options?)`    | 删除文件或目录                   | `recursive?: boolean`                                                                                                                                         |
| `readdir(path: string)`             | 读取目录内容                     | -                                                                                                                                                             |
| `stat(path: string)`                | 获取文件信息                     | -                                                                                                                                                             |
| `walk(dir: string, options?)`       | 递归遍历目录                     | `maxDepth?: number`<br>`includeFiles?: boolean`<br>`includeDirs?: boolean`<br>`match?: (path: string, info: FileInfo) => boolean`<br>`skipSymlinks?: boolean` |

#### 同步目录操作 ⭐ 新增

| API                                     | 说明                                 | 选项                                     |
| --------------------------------------- | ------------------------------------ | ---------------------------------------- |
| `mkdirSync(path: string, options?)`     | 同步创建目录                         | `recursive?: boolean`<br>`mode?: number` |
| `ensureDirSync(path: string, options?)` | 同步确保目录存在（如果不存在则创建） | `mode?: number`                          |
| `removeSync(path: string, options?)`    | 同步删除文件或目录                   | `recursive?: boolean`                    |
| `readdirSync(path: string)`             | 同步读取目录内容                     | -                                        |
| `statSync(path: string)`                | 同步获取文件信息                     | -                                        |
| `existsSync(path: string)`              | 同步检查文件或目录是否存在           | -                                        |
| `isFileSync(path: string)`              | 同步检查路径是否为文件               | -                                        |
| `isDirectorySync(path: string)`         | 同步检查路径是否为目录               | -                                        |
| `realPathSync(path: string)`            | 同步获取真实路径（解析符号链接）     | -                                        |

#### 文件操作

| API                                                             | 说明                         |
| --------------------------------------------------------------- | ---------------------------- |
| `copyFile(src: string, dest: string)`                           | 复制文件                     |
| `rename(oldPath: string, newPath: string)`                      | 重命名或移动文件/目录        |
| `symlink(target: string, path: string, type?: "file" \| "dir")` | 创建符号链接                 |
| `realPath(path: string)`                                        | 获取真实路径（解析符号链接） |
| `chmod(path: string, mode: number)`                             | 修改文件权限                 |
| `chown(path: string, uid: number, gid: number)`                 | 修改文件所有者               |
| `exists(path: string)`                                          | 检查文件或目录是否存在       |
| `isFile(path: string)`                                          | 检查路径是否为文件           |
| `isDirectory(path: string)`                                     | 检查路径是否为目录           |
| `truncate(path: string, len: number)`                           | 截断文件                     |

#### 临时文件/目录

| API                      | 说明         | 选项                                                     |
| ------------------------ | ------------ | -------------------------------------------------------- |
| `makeTempDir(options?)`  | 创建临时目录 | `prefix?: string`<br>`suffix?: string`<br>`dir?: string` |
| `makeTempFile(options?)` | 创建临时文件 | `prefix?: string`<br>`suffix?: string`<br>`dir?: string` |

#### 工作目录

| API                   | 说明             | 返回值          |
| --------------------- | ---------------- | --------------- |
| `cwd()`               | 获取当前工作目录 | `string`        |
| `chdir(path: string)` | 更改当前工作目录 | `Promise<void>` |

#### 文件监控

| API                                            | 说明             | 选项                                                                                                                            |
| ---------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `watchFs(paths: string \| string[], options?)` | 监控文件系统变化 | `recursive?: boolean` - 是否递归监控<br>`filesOnly?: boolean` - 是否只监听文件<br>`exclude?: (string \| RegExp)[]` - 排除的路径 |

**选项说明**：

- `recursive`: 是否递归监控子目录（默认：`false`）
- `filesOnly`: 是否只监听文件，排除目录（默认：`false`）
- `exclude`:
  排除的路径规则数组，支持字符串（路径包含该字符串即排除）或正则表达式

**使用示例**：

```typescript
import { watchFs } from "jsr:@dreamer/runtime-adapter";

// 监听项目根目录，排除上传目录和 runtime 目录
const watcher = watchFs(".", {
  recursive: true,
  filesOnly: true,
  exclude: [
    "uploads", // 排除包含 "uploads" 的路径
    "runtime", // 排除包含 "runtime" 的路径
    /node_modules/, // 使用正则表达式排除 node_modules
    /\.git/, // 排除 .git 目录
  ],
});

for await (const event of watcher) {
  console.log("文件变化:", event.kind, event.paths);
}
```

### 网络 API

#### HTTP 服务器

```typescript
serve(
  options: ServeOptions,
  handler: (req: Request) => Response | Promise<Response>
): Promise<ServeHandle>
```

**选项：**

- `port?: number` - 端口号（可选，默认随机端口）
- `host?: string` - 主机名（可选，默认 `"0.0.0.0"`）
- `onListen?: (params: { host: string; port: number }) => void` - 监听回调函数

**返回值：**

- `ServeHandle.port` - 服务器端口号
- `ServeHandle.close()` - 关闭服务器

#### WebSocket

```typescript
upgradeWebSocket(
  request: Request,
  options?: UpgradeWebSocketOptions
): UpgradeWebSocketResult
```

**选项：**

- `protocol?: string` - WebSocket 子协议
- `idleTimeout?: number` - 空闲超时时间（秒）

**返回值：**

- `socket: WebSocket` - WebSocket 连接对象（支持标准的
  `addEventListener`、`send`、`close` 等方法）
- `response: Response | undefined` - HTTP 响应对象（Deno 环境返回 Response，Bun
  环境返回 undefined，由 Bun 自动处理）

**使用说明：**

- ✅ **跨运行时兼容**：Deno 和 Bun 环境都支持，使用统一的 API
- ✅ **统一接口**：使用标准的 `addEventListener` API，无需关心底层实现差异
- ✅ **自动适配**：Bun 环境下的 WebSocket 升级和事件处理完全自动化，无需手动配置
  `websocket` 处理器
- ✅ **事件支持**：支持 `open`、`message`、`close`、`error` 等标准 WebSocket
  事件

**示例：**

```typescript
import { serve, upgradeWebSocket } from "jsr:@dreamer/runtime-adapter";

const handle = serve({ port: 3000 }, (req) => {
  const url = new URL(req.url);
  if (url.pathname === "/ws") {
    const { socket, response } = upgradeWebSocket(req);

    socket.addEventListener("message", (event) => {
      socket.send(`Echo: ${event.data}`);
    });

    return response || new Response("WebSocket upgrade", { status: 101 });
  }
  return new Response("Not Found", { status: 404 });
});
```

#### TCP/TLS 连接

| API                                                  | 说明                | 选项                             |
| ---------------------------------------------------- | ------------------- | -------------------------------- |
| `connect(options: ConnectOptions)`                   | 建立 TCP 连接       | `host: string`<br>`port: number` |
| `startTls(conn: TcpConn, options?: StartTlsOptions)` | 升级 TCP 连接到 TLS | `host?: string`                  |

### 环境变量 API

| API                                  | 说明                 | 返回值                   |
| ------------------------------------ | -------------------- | ------------------------ |
| `getEnv(key: string)`                | 获取环境变量         | `string \| undefined`    |
| `setEnv(key: string, value: string)` | 设置环境变量         | `void`                   |
| `deleteEnv(key: string)`             | 删除环境变量         | `void`                   |
| `getEnvAll()`                        | 获取所有环境变量     | `Record<string, string>` |
| `hasEnv(key: string)`                | 检查环境变量是否存在 | `boolean`                |

### 进程/命令 API

#### 进程/命令 API - 异步执行

```typescript
createCommand(
  command: string,
  options?: CommandOptions
): CommandProcess
```

**选项：**

- `args?: string[]` - 命令参数数组
- `cwd?: string` - 工作目录
- `env?: Record<string, string>` - 环境变量对象
- `stdin?: "inherit" \| "piped" \| "null"` - 标准输入模式
- `stdout?: "inherit" \| "piped" \| "null"` - 标准输出模式
- `stderr?: "inherit" \| "piped" \| "null"` - 标准错误输出模式

**CommandProcess 方法：**

- `output()` - 获取命令输出
- `status()` - 获取命令状态
- `kill(signo?)` - 终止命令
- `pid` - 进程 ID

#### 进程/命令 API - 同步执行 ⭐ 新增

```typescript
execCommandSync(
  command: string,
  args?: string[],
  options?: { cwd?: string; env?: Record<string, string> }
): string
```

**说明：**

- 同步执行命令并返回输出
- 如果命令执行失败，会抛出错误
- Deno 使用 `Deno.Command.outputSync()`
- Bun 使用 `child_process.execFileSync()`

### 终端 API

| API                                    | 说明                       | 返回值                       |
| -------------------------------------- | -------------------------- | ---------------------------- |
| `isTerminal()`                         | 检查标准输出是否为终端     | `boolean`                    |
| `isStderrTerminal()`                   | 检查标准错误输出是否为终端 | `boolean`                    |
| `isStdinTerminal()`                    | 检查标准输入是否为终端     | `boolean`                    |
| `getStdout()`                          | 获取标准输出流（异步）     | `WritableStream<Uint8Array>` |
| `getStderr()`                          | 获取标准错误输出流（异步） | `WritableStream<Uint8Array>` |
| `writeStdoutSync(data: Uint8Array)`    | 同步写入标准输出           | `void`                       |
| `writeStderrSync(data: Uint8Array)`    | 同步写入标准错误输出       | `void`                       |
| `readStdin(buffer: Uint8Array)`        | 读取标准输入               | `Promise<number \| null>`    |
| `setStdinRaw(mode: boolean, options?)` | 设置标准输入为原始模式     | `boolean`                    |

### 定时任务 API

```typescript
cron(
  expression: string,
  handler: () => void | Promise<void>,
  options?: CronOptions
): CronHandle
```

**Cron 表达式格式：**

- 格式：`秒 分 时 日 月 周`（6 字段格式）
- 示例：`"*/5 * * * * *"` - 每 5 秒执行一次
- 示例：`"0 * * * * *"` - 每分钟执行
- 示例：`"0 0 2 * * *"` - 每天凌晨 2 点执行

**选项：**

- `signal?: AbortSignal` - 用于取消任务

**返回值：**

- `CronHandle.close()` - 关闭定时任务
- `CronHandle.stop()` - 停止定时任务（close 的别名）

> 📌 **注意**：统一使用 `node-cron@3.0.3`，支持秒级 Cron 表达式，在 Deno 和 Bun
> 环境下行为一致。`stop()` 和 `close()` 方法功能相同，可以根据使用习惯选择。

### 进程信息 API

| API          | 说明                 | 返回值                                                 |
| ------------ | -------------------- | ------------------------------------------------------ |
| `execPath()` | 运行时可执行文件路径 | `string`（如 `/usr/bin/deno` 或 `C:\path\to\bun.exe`） |
| `pid()`      | 获取当前进程 ID      | `number`                                               |
| `platform()` | 获取操作系统平台     | `"linux" \| "darwin" \| "windows" \| "unknown"`        |
| `arch()`     | 获取 CPU 架构        | `"x86_64" \| "aarch64" \| "arm64" \| "unknown"`        |
| `version()`  | 获取运行时版本信息   | `RuntimeVersion`                                       |

**RuntimeVersion 接口：**

```typescript
interface RuntimeVersion {
  runtime: "deno" | "bun";
  version: string;
  build?: {
    target: string;
    arch: string;
    os: string;
    vendor: string;
  };
}
```

### 进程工具 API

| API                  | 说明               | 返回值     |
| -------------------- | ------------------ | ---------- |
| `args()`             | 获取命令行参数数组 | `string[]` |
| `exit(code: number)` | 退出程序           | `never`    |

### 工具 API（运行时访问）

| API            | 说明                      | 返回值                      |
| -------------- | ------------------------- | --------------------------- |
| `getDeno()`    | 获取 Deno API（类型安全） | `Deno \| null`              |
| `getBun()`     | 获取 Bun API（类型安全）  | `Bun \| null`               |
| `getProcess()` | 获取 Node process 对象    | `process \| null`           |
| `getBuffer()`  | 获取 Node Buffer 构造函数 | `BufferConstructor \| null` |

> 📌 需要直接访问运行时对象时使用；跨运行时代码请优先使用适配器
> API（file、env、process 等）。

### 信号处理 API

| API                                                         | 说明           | 参数                                                                                               |
| ----------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------- |
| `addSignalListener(signal: Signal, handler: () => void)`    | 添加信号监听器 | `signal`: `"SIGTERM" \| "SIGINT" \| "SIGUSR1" \| "SIGUSR2" \| "SIGHUP"`<br>`handler`: 信号处理函数 |
| `removeSignalListener(signal: Signal, handler: () => void)` | 移除信号监听器 | 同上                                                                                               |

### 路径操作 API

| API                                    | 说明               | 返回值    |
| -------------------------------------- | ------------------ | --------- |
| `join(...paths: string[])`             | 拼接多个路径片段   | `string`  |
| `dirname(path: string)`                | 获取目录名         | `string`  |
| `basename(path: string, ext?: string)` | 获取文件名         | `string`  |
| `extname(path: string)`                | 获取扩展名         | `string`  |
| `resolve(...paths: string[])`          | 解析路径为绝对路径 | `string`  |
| `relative(from: string, to: string)`   | 计算相对路径       | `string`  |
| `normalize(path: string)`              | 规范化路径         | `string`  |
| `isAbsolute(path: string)`             | 判断是否为绝对路径 | `boolean` |
| `isRelative(path: string)`             | 判断是否为相对路径 | `boolean` |
| `fromFileUrl(url: string \| URL)`      | file URL 转为路径  | `string`  |
| `pathToFileUrl(path: string)`          | 路径转为 file URL  | `string`  |

> 📌 **注意**：`join` 遵循 node:path 语义（如 `join(".", "file.txt")` 返回
> `"file.txt"`）。所有路径结果统一为正斜杠。Windows 下 Bun 子进程脚本路径请用
> `fromFileUrl()`，避免 `URL.pathname` 得到 `/D:/...` 导致 spawn 失败。

### 文件哈希 API

#### 文件哈希 API - 异步

| API                                                           | 说明           | 参数                                                                              | 返回值            |
| ------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------- | ----------------- |
| `hashFile(path: string, algorithm?: HashAlgorithm)`           | 计算文件哈希值 | `path`: 文件路径<br>`algorithm`: 哈希算法（默认：`"SHA-256"`）                    | `Promise<string>` |
| `hash(data: Uint8Array \| string, algorithm?: HashAlgorithm)` | 计算数据哈希值 | `data`: 数据（Uint8Array 或字符串）<br>`algorithm`: 哈希算法（默认：`"SHA-256"`） | `Promise<string>` |

#### 文件哈希 API - 同步 ⭐ 新增

| API                                                               | 说明               | 参数                                                                              | 返回值   |
| ----------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------- | -------- |
| `hashFileSync(path: string, algorithm?: HashAlgorithm)`           | 同步计算文件哈希值 | `path`: 文件路径<br>`algorithm`: 哈希算法（默认：`"SHA-256"`）                    | `string` |
| `hashSync(data: Uint8Array \| string, algorithm?: HashAlgorithm)` | 同步计算数据哈希值 | `data`: 数据（Uint8Array 或字符串）<br>`algorithm`: 哈希算法（默认：`"SHA-256"`） | `string` |

**HashAlgorithm 类型：**

- `"SHA-256"`（默认）
- `"SHA-512"`
- `"SHA-1"`
- `"MD5"`

> 📌 **注意**：哈希 API 使用 `node:crypto`，Deno 与 Bun 均支持。

### 系统信息 API

#### 系统信息 API - 异步

| API                                                        | 说明                        | 参数                                                                     | 返回值                              |
| ---------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------ | ----------------------------------- |
| `getMemoryInfo()`                                          | 获取系统内存信息            | 无                                                                       | `Promise<MemoryInfo>`               |
| `getCpuUsage(interval?: number)`                           | 获取 CPU 使用率             | `interval`: 采样间隔（毫秒，默认：100）                                  | `Promise<CpuUsage>`                 |
| `getLoadAverage()`                                         | 获取系统负载（Linux/macOS） | 无                                                                       | `Promise<LoadAverage \| undefined>` |
| `getDiskUsage(path?: string)`                              | 获取磁盘使用情况            | `path`: 路径（默认：当前工作目录）                                       | `Promise<DiskUsage>`                |
| `getSystemInfo()`                                          | 获取系统信息                | 无                                                                       | `Promise<SystemInfo>`               |
| `getSystemStatus(cpuInterval?: number, diskPath?: string)` | 获取完整的系统状态          | `cpuInterval`: CPU 采样间隔（默认：100）<br>`diskPath`: 磁盘路径（可选） | `Promise<SystemStatus>`             |

#### 系统信息 API - 同步 ⭐ 新增

| API                    | 说明                            | 参数 | 返回值                     |
| ---------------------- | ------------------------------- | ---- | -------------------------- |
| `getMemoryInfoSync()`  | 同步获取系统内存信息            | 无   | `MemoryInfo`               |
| `getLoadAverageSync()` | 同步获取系统负载（Linux/macOS） | 无   | `LoadAverage \| undefined` |
| `getSystemInfoSync()`  | 同步获取系统信息                | 无   | `SystemInfo`               |

**MemoryInfo 接口：**

```typescript
interface MemoryInfo {
  total: number; // 总内存（字节）
  available: number; // 可用内存（字节）
  used: number; // 已使用内存（字节）
  free: number; // 空闲内存（字节）
  usagePercent: number; // 内存使用率（百分比）
  swapTotal?: number; // 交换区总量（字节，可选）
  swapFree?: number; // 空闲交换区（字节，可选）
}
```

**CpuUsage 接口：**

```typescript
interface CpuUsage {
  usagePercent: number; // 总 CPU 使用率（百分比）
  userPercent: number; // 用户态 CPU 使用率（百分比）
  systemPercent: number; // 系统态 CPU 使用率（百分比）
}
```

**LoadAverage 接口：**

```typescript
interface LoadAverage {
  load1: number; // 1 分钟平均负载
  load5: number; // 5 分钟平均负载
  load15: number; // 15 分钟平均负载
}
```

**DiskUsage 接口：**

```typescript
interface DiskUsage {
  total: number; // 总空间（字节）
  used: number; // 已使用空间（字节）
  available: number; // 可用空间（字节）
  usagePercent: number; // 使用率（百分比）
}
```

**SystemInfo 接口：**

```typescript
interface SystemInfo {
  hostname: string; // 主机名
  platform: string; // 操作系统平台
  arch: string; // CPU 架构
  uptime: number; // 系统运行时间（秒）
  cpus?: number; // CPU 核心数（可选）
}
```

**SystemStatus 接口：**

```typescript
interface SystemStatus {
  system: SystemInfo; // 系统信息
  memory: MemoryInfo; // 内存信息
  cpu: CpuUsage; // CPU 使用率
  loadAverage?: LoadAverage; // 系统负载（可选）
  disk?: DiskUsage; // 磁盘使用信息（可选）
}
```

> 📌 **注意**：
>
> - Windows 平台不支持系统负载，`getLoadAverage()` 和 `getLoadAverageSync()`
>   返回 `undefined`
> - Deno 环境使用原生 API，Bun 环境通过系统命令获取
> - 所有 API 在获取失败时会返回默认值，不会抛出异常

---

## ⚡ 性能优化

- **类型安全访问**：所有运行时 API
  访问都通过类型安全的工具函数，避免运行时类型检查开销
- **自动适配**：在编译时确定运行时环境，减少运行时判断
- **同步 API**：提供同步 API 用于需要阻塞等待的场景，避免异步开销
- **批量操作**：文件系统操作支持批量处理，减少 I/O 操作
- **流式处理**：网络和文件操作支持流式处理，减少内存占用

---

## 🧪 测试

### 运行测试

```bash
# Deno 环境
deno test -A tests/

# Bun 环境
bun test tests/
```

### 测试报告

详细的测试报告请查看 [TEST_REPORT.md](./TEST_REPORT.md)。

测试覆盖包括：

- ✅ 267 个测试用例全部通过
- ✅ 17 个功能模块完整测试
- ✅ Deno 和 Bun 跨运行时兼容性验证
- ✅ 同步和异步 API 完整测试
- ✅ WebSocket API 完整测试

---

## 📝 备注

- **服务端和客户端分离**：通过 `/client`
  子路径明确区分服务端和客户端代码（本包仅支持服务端）
- **统一接口**：所有 API 在 Deno 和 Bun 环境下使用相同的接口，降低学习成本
- **类型安全**：完全采用类型安全的实现方式，所有运行时 API
  访问都通过类型安全的工具函数（`getDeno()`, `getBun()`,
  `getProcess()`），避免了 `(globalThis as any)` 的使用。所有 API 都有完整的
  TypeScript 类型定义，零 `any` 类型。
- **自动适配**：本包提供统一的 API 抽象层，在 Deno 和 Bun
  环境下自动适配到对应的原生 API
- **同步和异步 API**：提供同步和异步两种 API，同步 API
  适合需要阻塞等待的场景（如 CLI 工具），异步 API 适合大多数场景
- **文件监控**：`watchFs()` 在 Deno 和 Bun 环境下都已实现。Bun 环境使用 Node.js
  的 `fs.watch` API，功能完整，支持递归监控、文件过滤和路径排除
- **WebSocket 升级**：`upgradeWebSocket()` 在 Deno 和 Bun
  环境下都支持，使用统一的 API。Bun 环境下的 WebSocket
  升级和事件处理完全自动化，无需手动配置 `websocket` 处理器。返回的 `socket`
  对象支持标准的 `addEventListener`、`send`、`close` 等方法
- **定时任务**：统一使用 `node-cron@3.0.3`，支持秒级 Cron 表达式，在 Deno 和 Bun
  环境下行为一致
- **TCP/TLS 连接**：Bun 环境下的 TCP/TLS 连接使用 Node.js 兼容 API，功能与 Deno
  原生 API 基本一致
- **权限要求**：在 Deno 环境下运行测试时，需要使用 `-A` 或 `--allow-all`
  标志来授予所有权限

---

## 📋 变更日志

### [1.0.18] - 2026-02-25

**修复**：Bun（Windows）下 `args()` 优先使用 `Bun.argv`，确保脚本参数（如
`--build`）正确传入。**新增**：process-utils 中 `args()`
的单元测试。完整历史详见 [CHANGELOG](./CHANGELOG.md)。

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

Apache License 2.0 - 详见 [LICENSE](../../LICENSE)

---

<div align="center">

**Made with ❤️ by Dreamer Team**

</div>
