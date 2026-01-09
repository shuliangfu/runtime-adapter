# @dreamer/runtime-adapter

> 运行时适配层库，提供统一的运行时 API 抽象层，兼容 Deno 和 Bun 运行时环境

[![JSR](https://jsr.io/badges/@dreamer/runtime-adapter)](https://jsr.io/@dreamer/runtime-adapter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🎯 功能

运行时适配层，让其他 `@dreamer/*` 库可以在不同运行时环境中使用相同的 API。

---

## ✨ 特性

| 特性 | 说明 |
|------|------|
| 🔍 **运行时自动检测** | 自动检测当前运行环境（Deno / Bun） |
| 📁 **文件系统 API 适配** | 统一的文件读写、目录操作接口 |
| 🌐 **网络 API 适配** | HTTP 服务器、WebSocket、TCP/TLS 连接 |
| 🔐 **环境变量 API 适配** | 统一的环境变量操作接口 |
| ⚙️ **进程/命令 API 适配** | 统一的命令执行接口 |
| 💻 **终端 API 适配** | TTY 检测、标准输入输出流、同步写入、原始模式 |
| ⏰ **定时任务 API 适配** | Cron 定时任务（统一使用 `node-cron`，支持秒级任务） |

---

## 🎨 设计原则

**所有 `@dreamer/*` 库都遵循以下原则**：

- **主包（@dreamer/xxx）**：用于服务端（Bun/Deno 运行时）
- **客户端子包（@dreamer/xxx/client）**：用于客户端（浏览器环境）

这样可以：
- ✅ 明确区分服务端和客户端代码
- ✅ 避免在客户端代码中引入服务端依赖
- ✅ 提供更好的类型安全和代码提示
- ✅ 支持更好的 tree-shaking

---

## 🚀 使用场景

- 🔄 跨运行时库开发（Bun 和 Deno 兼容）
- 🔧 运行时 API 统一抽象
- 📦 其他 `@dreamer/*` 库的基础依赖

---

## 📦 安装

### Bun

```bash
bunx jsr add @dreamer/runtime-adapter
```

### Deno

```bash
deno add jsr:@dreamer/runtime-adapter
```

---

## 🌍 环境兼容性

| 环境 | 版本要求 | 状态 |
|------|---------|------|
| **Bun** | 1.0+ | ✅ 完全支持 |
| **Deno** | 2.5+ | ✅ 完全支持 |
| **服务端** | - | ✅ 支持（Bun 和 Deno 运行时） |
| **客户端** | - | ❌ 不支持（浏览器环境） |
| **依赖** | `node-cron@3.0.3` | 📦 用于定时任务，支持秒级 Cron 表达式 |

---

## 🚀 快速开始

### 运行时检测

```typescript
import { detectRuntime, IS_DENO, IS_BUN, RUNTIME } from "jsr:@dreamer/runtime-adapter";

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

```typescript
import {
  readFile,
  writeFile,
  readTextFile,
  writeTextFile,
  mkdir,
  remove,
  stat,
  readdir,
  copyFile,
  rename,
  symlink,
  realPath,
  chmod,
  chown,
  makeTempDir,
  makeTempFile,
  cwd,
  chdir,
  watchFs,
} from "jsr:@dreamer/runtime-adapter";

// 读取文件（自动适配 Bun 或 Deno）
const data = await readFile("./file.txt");
const text = await readTextFile("./file.txt");

// 写入文件
await writeFile("./output.txt", new Uint8Array([1, 2, 3]));
await writeTextFile("./output.txt", "Hello, World!");

// 目录操作
await mkdir("./data", { recursive: true });
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

// 创建临时目录和文件
const tempDir = await makeTempDir({ prefix: "my-app-" });
const tempFile = await makeTempFile({ prefix: "temp-", suffix: ".txt" });

// 获取和更改工作目录
const currentDir = cwd();
console.log("当前目录:", currentDir);
await chdir("./subdirectory");

// 文件监控（监听项目所有文件，排除指定目录）
const watcher = watchFs(".", {
  recursive: true,
  filesOnly: true, // 只监听文件，排除目录
  exclude: [
    "uploads",        // 排除包含 "uploads" 的路径
    "runtime",        // 排除包含 "runtime" 的路径
    /node_modules/,  // 使用正则表达式排除 node_modules
    /\.git/,          // 排除 .git 目录
  ],
});

for await (const event of watcher) {
  console.log("文件变化:", event.kind, event.paths);
}
```

### 网络操作

```typescript
import { serve, connect, startTls, upgradeWebSocket } from "jsr:@dreamer/runtime-adapter";

// HTTP 服务器（自动适配 Bun 或 Deno）
const handle = await serve({ port: 3000 }, (req) => {
  return new Response("Hello, World!");
});

// 获取服务器端口
console.log("服务器运行在端口:", handle.port);

// 关闭服务器
handle.close();

// WebSocket 升级（Deno 环境）
const upgradeResult = upgradeWebSocket(req, {
  idleTimeout: 120,
});

// TCP 连接
const conn = await connect({
  hostname: "example.com",
  port: 80,
});

// TLS 连接
const tlsConn = await startTls(conn, {
  hostname: "example.com",
});
```

### 环境变量

```typescript
import { getEnv, setEnv, getEnvAll, hasEnv, deleteEnv } from "jsr:@dreamer/runtime-adapter";

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

```typescript
import { createCommand } from "jsr:@dreamer/runtime-adapter";

// 执行命令（自动适配 Bun 或 Deno）
const cmd = createCommand("ls", {
  args: ["-la"],
  cwd: "./",
  stdout: "piped",
  stderr: "piped",
});

// 获取输出
const output = await cmd.output();
console.log("标准输出:", new TextDecoder().decode(output.stdout));
console.log("标准错误:", new TextDecoder().decode(output.stderr));
console.log("退出码:", output.code);
console.log("是否成功:", output.success);

// 或者只获取状态
const status = await cmd.status();
console.log("进程状态:", status);

// 取消进程
cmd.kill();
```

### 终端检测和操作

```typescript
import {
  isTerminal,
  isStderrTerminal,
  isStdinTerminal,
  getStdout,
  getStderr,
  writeStdoutSync,
  writeStderrSync,
  readStdin,
  setStdinRaw,
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
// 注意：cron 函数是异步的，返回 Promise<CronHandle>

// 每分钟执行一次
const handle1 = await cron("0 * * * * *", async () => {
  console.log("每分钟执行");
});

// 每 5 秒执行一次（支持秒级）
const handle2 = await cron("*/5 * * * * *", async () => {
  console.log("每 5 秒执行");
});

// 每天凌晨 2 点执行
const handle3 = await cron("0 0 2 * * *", async () => {
  console.log("每天凌晨 2 点执行");
});

// 取消任务
handle1.close();
handle2.close();
handle3.close();

// 使用 AbortSignal 取消任务
const controller = new AbortController();
const handle4 = await cron("*/10 * * * * *", async () => {
  console.log("每 10 秒执行");
}, { signal: controller.signal });

// 稍后取消
setTimeout(() => {
  controller.abort();
}, 60000);
```

---

## 📚 API 文档

### 🔍 运行时检测

| API | 说明 | 返回值 |
|-----|------|--------|
| `detectRuntime()` | 检测当前运行时环境 | `"deno" \| "bun" \| "unknown"` |
| `RUNTIME` | 当前运行时常量 | `"deno" \| "bun"` |
| `IS_BUN` | 是否为 Bun 环境 | `boolean` |
| `IS_DENO` | 是否为 Deno 环境 | `boolean` |
| `type Runtime` | 运行时类型定义 | `"deno" \| "bun" \| "unknown"` |

### 📁 文件系统 API

#### 文件读写

| API | 说明 | 返回值 |
|-----|------|--------|
| `readFile(path: string)` | 读取文件（二进制） | `Promise<Uint8Array>` |
| `readTextFile(path: string)` | 读取文本文件 | `Promise<string>` |
| `writeFile(path: string, data: Uint8Array, options?)` | 写入文件（二进制） | `Promise<void>` |
| `writeTextFile(path: string, data: string, options?)` | 写入文本文件 | `Promise<void>` |
| `open(path: string, options?)` | 打开文件 | `Promise<File>` |
| `create(path: string)` | 创建文件 | `Promise<File>` |

#### 目录操作

| API | 说明 | 选项 |
|-----|------|------|
| `mkdir(path: string, options?)` | 创建目录 | `recursive?: boolean`<br>`mode?: number` |
| `remove(path: string, options?)` | 删除文件或目录 | `recursive?: boolean` |
| `readdir(path: string)` | 读取目录内容 | - |
| `stat(path: string)` | 获取文件信息 | - |

#### 文件操作

| API | 说明 |
|-----|------|
| `copyFile(src: string, dest: string)` | 复制文件 |
| `rename(oldPath: string, newPath: string)` | 重命名或移动文件/目录 |
| `symlink(target: string, path: string, type?: "file" \| "dir")` | 创建符号链接 |
| `realPath(path: string)` | 获取真实路径（解析符号链接） |
| `chmod(path: string, mode: number)` | 修改文件权限 |
| `chown(path: string, uid: number, gid: number)` | 修改文件所有者 |

#### 临时文件/目录

| API | 说明 | 选项 |
|-----|------|------|
| `makeTempDir(options?)` | 创建临时目录 | `prefix?: string`<br>`suffix?: string`<br>`dir?: string` |
| `makeTempFile(options?)` | 创建临时文件 | `prefix?: string`<br>`suffix?: string`<br>`dir?: string` |

#### 工作目录

| API | 说明 | 返回值 |
|-----|------|--------|
| `cwd()` | 获取当前工作目录 | `string` |
| `chdir(path: string)` | 更改当前工作目录 | `Promise<void>` |

#### 文件监控

| API | 说明 | 选项 |
|-----|------|------|
| `watchFs(paths: string \| string[], options?)` | 监控文件系统变化 | `recursive?: boolean` - 是否递归监控<br>`filesOnly?: boolean` - 是否只监听文件<br>`exclude?: (string \| RegExp)[]` - 排除的路径 |

**选项说明**：
- `recursive`: 是否递归监控子目录（默认：`false`）
- `filesOnly`: 是否只监听文件，排除目录（默认：`false`）
- `exclude`: 排除的路径规则数组，支持字符串（路径包含该字符串即排除）或正则表达式

**使用示例**：
```typescript
import { watchFs } from "jsr:@dreamer/runtime-adapter";

// 监听项目根目录，排除上传目录和 runtime 目录
const watcher = watchFs(".", {
  recursive: true,
  filesOnly: true,
  exclude: [
    "uploads",        // 排除包含 "uploads" 的路径
    "runtime",        // 排除包含 "runtime" 的路径
    /node_modules/,  // 使用正则表达式排除 node_modules
    /\.git/,          // 排除 .git 目录
  ],
});

for await (const event of watcher) {
  console.log("文件变化:", event.kind, event.paths);
}
```

### 🌐 网络 API

#### HTTP 服务器

```typescript
serve(
  options: ServeOptions,
  handler: (req: Request) => Response | Promise<Response>
): Promise<ServeHandle>
```

**选项：**
- `port?: number` - 端口号（可选，默认随机端口）
- `hostname?: string` - 主机名（可选，默认 `"0.0.0.0"`）
- `onListen?: (params: { hostname: string; port: number }) => void` - 监听回调函数

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

> ⚠️ **注意**：Bun 环境下的 WebSocket 升级需要在 `serve()` 时配置 `websocket` 处理器，不能单独使用。

#### TCP/TLS 连接

| API | 说明 | 选项 |
|-----|------|------|
| `connect(options: ConnectOptions)` | 建立 TCP 连接 | `hostname: string`<br>`port: number` |
| `startTls(conn: TcpConn, options?: StartTlsOptions)` | 升级 TCP 连接到 TLS | `hostname?: string` |

### 🔐 环境变量 API

| API | 说明 | 返回值 |
|-----|------|--------|
| `getEnv(key: string)` | 获取环境变量 | `string \| undefined` |
| `setEnv(key: string, value: string)` | 设置环境变量 | `void` |
| `deleteEnv(key: string)` | 删除环境变量 | `void` |
| `getEnvAll()` | 获取所有环境变量 | `Record<string, string>` |
| `hasEnv(key: string)` | 检查环境变量是否存在 | `boolean` |

### ⚙️ 进程/命令 API

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

### 💻 终端 API

| API | 说明 | 返回值 |
|-----|------|--------|
| `isTerminal()` | 检查标准输出是否为终端 | `boolean` |
| `isStderrTerminal()` | 检查标准错误输出是否为终端 | `boolean` |
| `isStdinTerminal()` | 检查标准输入是否为终端 | `boolean` |
| `getStdout()` | 获取标准输出流（异步） | `WritableStream<Uint8Array>` |
| `getStderr()` | 获取标准错误输出流（异步） | `WritableStream<Uint8Array>` |
| `writeStdoutSync(data: Uint8Array)` | 同步写入标准输出 | `void` |
| `writeStderrSync(data: Uint8Array)` | 同步写入标准错误输出 | `void` |
| `readStdin(buffer: Uint8Array)` | 读取标准输入 | `Promise<number \| null>` |
| `setStdinRaw(mode: boolean, options?)` | 设置标准输入为原始模式 | `boolean` |

### ⏰ 定时任务 API

```typescript
cron(
  expression: string,
  handler: () => void | Promise<void>,
  options?: CronOptions
): Promise<CronHandle>
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

> 📌 **注意**：统一使用 `node-cron@3.0.3`，支持秒级 Cron 表达式，在 Deno 和 Bun 环境下行为一致。

---

## 🧪 测试

### 运行测试

```bash
# Deno 环境
deno test -A tests/

# Bun 环境
bun test tests/
```

### 测试覆盖

| 模块 | 测试用例数 | 状态 |
|------|-----------|------|
| 运行时检测 | 7 | ✅ |
| 文件系统 API | 24 | ✅ |
| 网络 API | 5 | ✅ |
| 环境变量 API | 9 | ✅ |
| 进程/命令 API | 8 | ✅ |
| 终端 API | 6 | ✅ |
| 定时任务 API | 4 | ✅ |
| 模块导出 | 7 | ✅ |
| **总计** | **70** | ✅ **全部通过** |

---

## ⚠️ 注意事项

1. **文件监控**：`watchFs()` 在 Deno 和 Bun 环境下都已实现。Bun 环境使用 Node.js 的 `fs.watch` API，功能完整，支持递归监控、文件过滤和路径排除。

2. **WebSocket 升级**：Bun 环境下的 `upgradeWebSocket()` 需要在 `serve()` 时配置 `websocket` 处理器，不能单独使用。

3. **定时任务**：统一使用 `node-cron@3.0.3`，支持秒级 Cron 表达式，在 Deno 和 Bun 环境下行为一致。

4. **TCP/TLS 连接**：Bun 环境下的 TCP/TLS 连接使用 Node.js 兼容 API，功能与 Deno 原生 API 基本一致。

5. **设计理念**：本库提供统一的 API 抽象层，在 Deno 和 Bun 环境下自动适配到对应的原生 API。

6. **文件系统同步**：在 Bun 环境下，某些文件系统操作可能存在同步延迟，代码中已包含重试机制来处理这种情况。

7. **权限要求**：在 Deno 环境下运行测试时，需要使用 `-A` 或 `--allow-all` 标志来授予所有权限。

---

## ❓ 常见问题

### Q: 为什么在 Deno 环境下测试需要 `-A` 标志？

**A:** Deno 默认是安全的，需要显式授予权限。文件系统操作需要 `--allow-write` 权限，网络操作需要 `--allow-net` 权限，进程操作需要 `--allow-run` 权限。使用 `-A` 可以授予所有权限，方便测试。

### Q: Bun 和 Deno 的测试输出为什么不一样？

**A:** 这是两个测试框架的差异。Deno 会自动捕获测试中的 `stdout`/`stderr` 输出并显示，而 Bun 默认不显示子进程的输出。这是正常行为，不影响测试结果。

### Q: 定时任务支持哪些 Cron 表达式格式？

**A:** 统一使用 `node-cron`，支持标准的 6 字段格式（秒 分 时 日 月 周），例如：
- `"*/5 * * * * *"` - 每 5 秒执行
- `"0 * * * * *"` - 每分钟执行
- `"0 0 2 * * *"` - 每天凌晨 2 点执行

### Q: 如何在不同运行时环境下使用不同的实现？

**A:** 使用运行时检测 API：

```typescript
import { IS_BUN, IS_DENO } from "jsr:@dreamer/runtime-adapter";

if (IS_BUN) {
  // Bun 特定代码
} else if (IS_DENO) {
  // Deno 特定代码
}
```

---


## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

MIT License

---

<div align="center">

**Made with ❤️ by @dreamer**

</div>
