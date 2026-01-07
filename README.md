# @dreamer/runtime-adapter

运行时适配层库，提供统一的运行时 API 抽象层，兼容 Deno 和 Bun 运行时环境。

**设计理念：以 Bun 为主，兼容 Deno**

## 功能

运行时适配层，让其他 @dreamer/* 库可以在不同运行时环境中使用相同的 API。

## 特性

- **运行时自动检测**：自动检测当前运行环境（Deno / Bun）
- **文件系统 API 适配**：统一的文件读写、目录操作接口
- **网络 API 适配**：HTTP 服务器、WebSocket、TCP/TLS 连接
- **环境变量 API 适配**：统一的环境变量操作接口
- **进程/命令 API 适配**：统一的命令执行接口
- **终端 API 适配**：TTY 检测、标准输出流
- **定时任务 API 适配**：Cron 定时任务（Bun 使用简化实现，Deno 使用原生 API）

## 设计原则

**所有 @dreamer/* 库都遵循以下原则**：

- **主包（@dreamer/xxx）**：用于服务端（Bun/Deno 运行时）
- **客户端子包（@dreamer/xxx/client）**：用于客户端（浏览器环境）

这样可以：
- 明确区分服务端和客户端代码
- 避免在客户端代码中引入服务端依赖
- 提供更好的类型安全和代码提示
- 支持更好的 tree-shaking

## 使用场景

- 跨运行时库开发（Bun 和 Deno 兼容）
- 运行时 API 统一抽象
- 其他 @dreamer/* 库的基础依赖

## 优先级

⭐⭐⭐⭐⭐（核心基础库）

## 安装

### npm

```bash
npm install @dreamer/runtime-adapter
# 或
npm install @dreamer/runtime-adapter @types/bun
```

### Bun

```bash
bunx jsr add @dreamer/runtime-adapter
```

### JSR (Deno)

```bash
deno add jsr:@dreamer/runtime-adapter
```

### Deno

```bash
deno add jsr:@dreamer/runtime-adapter
```

## 环境兼容性

- **Bun 版本**：要求 Bun 1.0 或更高版本
- **Deno 版本**：要求 Deno 2.5 或更高版本
- **服务端**：✅ 支持（Bun 和 Deno 运行时）
- **客户端**：❌ 不支持（浏览器环境）
- **依赖**：无外部依赖（基于运行时原生 API）

## 使用示例

### 运行时检测

```typescript
import { detectRuntime, IS_DENO, IS_BUN, RUNTIME } from "jsr:@dreamer/runtime-adapter";

// 检测运行时
const runtime = detectRuntime(); // "deno" | "bun" | "unknown"

// 使用常量
if (IS_BUN) {
  console.log("运行在 Bun 环境（主要运行时）");
}

if (IS_DENO) {
  console.log("运行在 Deno 环境（兼容运行时）");
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
  chown
} from "jsr:@dreamer/runtime-adapter";

// 读取文件（自动适配 Bun 或 Deno）
const data = await readFile("./file.txt");
const text = await readTextFile("./file.txt", "utf-8");

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
chdir("./subdirectory");
```

### 网络操作

```typescript
import { serve, connect, startTls } from "jsr:@dreamer/runtime-adapter";

// HTTP 服务器（自动适配 Bun 或 Deno）
serve({ port: 3000 }, (req) => {
  return new Response("Hello, World!");
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
import { getEnv, setEnv, getEnvAll, hasEnv } from "jsr:@dreamer/runtime-adapter";

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
```

### 命令执行

```typescript
import { createCommand } from "jsr:@dreamer/runtime-adapter";

// 执行命令（自动适配 Bun 或 Deno）
const cmd = createCommand("ls", {
  args: ["-la"],
  cwd: "./",
  stdout: "piped",
});

const output = await cmd.output();
console.log("输出:", new TextDecoder().decode(output.stdout));
```

### 终端检测

```typescript
import { isTerminal, getStdout } from "jsr:@dreamer/runtime-adapter";

// 检查是否为终端（自动适配 Bun 或 Deno）
if (isTerminal()) {
  console.log("运行在终端环境中");
}

// 获取标准输出流
const stdout = getStdout();
const writer = stdout.getWriter();
await writer.write(new TextEncoder().encode("Hello\n"));
writer.releaseLock();
```

### 定时任务

```typescript
import { cron } from "jsr:@dreamer/runtime-adapter";

// 注册 Cron 任务（自动适配 Bun 或 Deno）
// Bun 使用 node-cron 库，Deno 使用原生 API
// 注意：cron 函数是异步的，返回 Promise<CronHandle>
const handle = await cron("*/1 * * * *", async () => {
  console.log("定时任务执行");
});

// 取消任务
handle.close();
```

## API 文档

### 运行时检测

- `detectRuntime()`: 检测当前运行时环境
- `RUNTIME`: 当前运行时常量
- `IS_BUN`: 是否为 Bun 环境（主要运行时）
- `IS_DENO`: 是否为 Deno 环境（兼容运行时）

### 文件系统 API

- `readFile(path: string)`: 读取文件（二进制）
- `readTextFile(path: string, encoding?: string)`: 读取文本文件
- `writeFile(path: string, data: Uint8Array, options?)`: 写入文件（二进制）
- `writeTextFile(path: string, data: string, options?)`: 写入文本文件
- `open(path: string, options?)`: 打开文件
- `create(path: string)`: 创建文件
- `mkdir(path: string, options?)`: 创建目录
- `remove(path: string, options?)`: 删除文件或目录
- `stat(path: string)`: 获取文件信息
- `readdir(path: string)`: 读取目录内容
- `copyFile(src: string, dest: string)`: 复制文件
- `rename(oldPath: string, newPath: string)`: 重命名或移动文件/目录
- `symlink(target: string, path: string, type?)`: 创建符号链接
- `realPath(path: string)`: 获取真实路径（解析符号链接）
- `chmod(path: string, mode: number)`: 修改文件权限
- `chown(path: string, uid: number, gid: number)`: 修改文件所有者
- `makeTempDir(options?)`: 创建临时目录
- `makeTempFile(options?)`: 创建临时文件
- `cwd()`: 获取当前工作目录
- `chdir(path: string)`: 更改当前工作目录
- `watchFs(paths: string | string[], options?)`: 监控文件系统变化

### 网络 API

- `serve(options, handler)`: 启动 HTTP 服务器
- `upgradeWebSocket(request, options?)`: 升级 WebSocket 连接
- `connect(options)`: 建立 TCP 连接
- `startTls(conn, options?)`: 升级 TCP 连接到 TLS

### 环境变量 API

- `getEnv(key: string)`: 获取环境变量
- `setEnv(key: string, value: string)`: 设置环境变量
- `deleteEnv(key: string)`: 删除环境变量
- `getEnvAll()`: 获取所有环境变量
- `hasEnv(key: string)`: 检查环境变量是否存在

### 进程/命令 API

- `createCommand(command: string, options?)`: 创建命令对象

### 终端 API

- `isTerminal()`: 检查标准输出是否为终端
- `isStderrTerminal()`: 检查标准错误输出是否为终端
- `getStdout()`: 获取标准输出流
- `getStderr()`: 获取标准错误输出流

### 定时任务 API

- `cron(expression: string, handler: () => void | Promise<void>, options?)`: 注册 Cron 定时任务

## 注意事项

1. **文件监控**：Bun 环境下的 `watchFs()` 功能受限，建议使用第三方库（如 `chokidar`）进行文件监控。

2. **WebSocket 升级**：Bun 环境下的 `upgradeWebSocket()` 需要在 `serve()` 时配置 `websocket` 处理器，不能单独使用。

3. **定时任务**：Bun 环境下的 Cron 任务使用简化实现，不支持复杂的 Cron 表达式，建议使用第三方库（如 `node-cron`）进行复杂定时任务。Deno 环境使用原生 `Deno.cron` API。

4. **TCP/TLS 连接**：Bun 环境下的 TCP/TLS 连接使用 Node.js 兼容 API，功能与 Deno 原生 API 基本一致。

5. **设计理念**：本库以 Bun 为主，优先使用 Bun 的 API。Deno 作为兼容层，在 Deno 环境下会适配到 Deno 的 API。

## 编辑器配置

### VSCode

1. 安装 Deno 插件：`denoland.vscode-deno`
2. 安装 Bun 插件（如果可用）
3. 配置 `.vscode/settings.json`（已包含在项目中）

详细配置请参考项目根目录的 `.vscode/settings.json`。

## 许可证

MIT License
