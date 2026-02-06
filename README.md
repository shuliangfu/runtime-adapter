# @dreamer/runtime-adapter

> Runtime adaptation layer providing a unified API abstraction compatible with
> Deno and Bun runtimes

English | [中文 (Chinese)](./README-zh.md)

[![JSR](https://jsr.io/badges/@dreamer/runtime-adapter)](https://jsr.io/@dreamer/runtime-adapter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE.md)
[![Tests](https://img.shields.io/badge/tests-211%20passed-brightgreen)](./TEST_REPORT.md)

---

## 🎯 Overview

A runtime adaptation layer that enables other `@dreamer/*` libraries to use the
same API across different runtime environments.

---

## ✨ Features

- **Runtime auto-detection**:
  - Auto-detect current runtime (Deno / Bun)
  - Runtime type definitions and constants
- **Full type safety**:
  - Complete TypeScript types for all APIs
  - Zero `any` types, using type guards and explicit interfaces
  - Type-safe runtime API access via utility functions
  - Comprehensive types covering Deno and Bun runtime APIs
- **File system API**:
  - Unified file read/write and directory operations
  - Sync and async support
  - File watching, directory traversal, temp files/dirs
- **Network API**:
  - HTTP server (auto-adapts Deno and Bun)
  - WebSocket upgrade (unified API, auto-adapts)
  - TCP/TLS connections
- **Environment variable API**:
  - Unified env var operations
  - Get, set, delete, check
- **Process/command API**:
  - Unified command execution
  - Sync and async execution
  - Process management (PID, status, kill)
- **Process info API**:
  - Process ID, platform, architecture, version
  - Runtime version detection
- **Process utils API**:
  - Command-line arguments
  - Program exit
- **Signal handling API**:
  - OS signal listeners (SIGTERM, SIGINT, SIGUSR1, SIGUSR2)
- **Terminal API**:
  - TTY detection (stdin, stdout, stderr)
  - Standard streams (sync and async)
  - Raw mode support
- **Cron API**:
  - Cron scheduled tasks (via `node-cron`)
  - Second-level support
  - AbortSignal support
- **Path API**:
  - Path join, resolve, normalize
  - Relative path calculation
  - Absolute path check
- **File hash API**:
  - File and data hashing
  - Sync and async
  - SHA-256, SHA-512, SHA-1, MD5
- **System info API**:
  - Memory, CPU, disk usage
  - System load (Linux/macOS)
  - Hostname, platform, arch, uptime
  - Sync and async

---

## 🎨 Design Principles

All `@dreamer/*` libraries follow:

- **Main package (@dreamer/xxx)**: Server-side (Deno and Bun)
- **Client sub-package (@dreamer/xxx/client)**: Browser environment

Benefits:

- Clear separation of server and client code
- Avoid server dependencies in client code
- Better type safety and IntelliSense
- Better tree-shaking

---

## 🎯 Use Cases

- **Cross-runtime library development**: Bun and Deno compatible libraries
- **Unified runtime API abstraction**: Unify API differences across runtimes
- **Base dependency**: Foundation for other `@dreamer/*` libraries

---

## 📦 Installation

### Deno

```bash
deno add jsr:@dreamer/runtime-adapter
```

### Bun

```bash
bunx jsr add @dreamer/runtime-adapter
```

---

## 🌍 Compatibility

| Environment    | Version           | Status                                      |
| -------------- | ----------------- | ------------------------------------------- |
| **Deno**       | 2.5+              | ✅ Fully supported                          |
| **Bun**        | 1.0+              | ✅ Fully supported                          |
| **Server**     | -                 | ✅ Supported (Deno and Bun)                 |
| **Client**     | -                 | ❌ Not supported (browser)                  |
| **Dependency** | `node-cron@3.0.3` | 📦 For cron tasks, second-level expressions |

---

## 🚀 Quick Start

### Runtime Detection

```typescript
import {
  detectRuntime,
  IS_BUN,
  IS_DENO,
  RUNTIME,
} from "jsr:@dreamer/runtime-adapter";

// Detect runtime
const runtime = detectRuntime(); // "deno" | "bun" | "unknown"

// Use constants
if (IS_BUN) {
  console.log("Running in Bun");
}

if (IS_DENO) {
  console.log("Running in Deno");
}

console.log("Current runtime:", RUNTIME);
```

### File System Operations

#### Async API

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

// Read file (auto-adapts Bun or Deno)
const data = await readFile("./file.txt");
const text = await readTextFile("./file.txt");

// Write file
await writeFile("./output.txt", new Uint8Array([1, 2, 3]));
await writeTextFile("./output.txt", "Hello, World!");

// Directory operations
await mkdir("./data", { recursive: true });
await ensureDir("./data/subdir"); // Ensure dir exists (create if not)
await remove("./data", { recursive: true });

// Get file info
const info = await stat("./file.txt");
console.log("File size:", info.size);
console.log("Is file:", info.isFile);

// Read directory
const entries = await readdir("./data");
for (const entry of entries) {
  console.log(`${entry.name} - ${entry.isFile ? "file" : "dir"}`);
}

// Copy file
await copyFile("./source.txt", "./dest.txt");

// Rename or move
await rename("./old.txt", "./new.txt");

// Create symlink
await symlink("./target.txt", "./link.txt", "file");

// Resolve real path
const realPath = await realPath("./link.txt");
console.log("Real path:", realPath);

// Change permissions
await chmod("./file.txt", 0o755);

// Change owner (requires permissions)
await chown("./file.txt", 1000, 1000);

// File utilities
if (await exists("./file.txt")) {
  console.log("File exists");
}
if (await isFile("./file.txt")) {
  console.log("Is a file");
}
if (await isDirectory("./data")) {
  console.log("Is a directory");
}
await truncate("./file.txt", 100); // Truncate to 100 bytes

// Temp dir/file
const tempDir = await makeTempDir({ prefix: "my-app-" });
const tempFile = await makeTempFile({ prefix: "temp-", suffix: ".txt" });

// Working directory
const currentDir = cwd();
console.log("Current dir:", currentDir);
await chdir("./subdirectory");

// Directory walk
for await (
  const path of walk("./src", {
    includeDirs: false,
    match: (p) => p.endsWith(".ts"),
  })
) {
  console.log("Found:", path);
}

// File watching (exclude specified paths)
const watcher = watchFs(".", {
  recursive: true,
  filesOnly: true,
  exclude: [
    "uploads",
    "runtime",
    /node_modules/,
    /\.git/,
  ],
});

for await (const event of watcher) {
  console.log("Change:", event.kind, event.paths);
}
```

#### Sync API ⭐ New

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

// Sync read
const data = readFileSync("./file.txt");
const text = readTextFileSync("./file.txt");

// Sync write
writeFileSync("./output.txt", new Uint8Array([1, 2, 3]));
writeTextFileSync("./output.txt", "Hello, World!");

// Sync directory ops
mkdirSync("./data", { recursive: true });
ensureDirSync("./data/subdir");
removeSync("./data", { recursive: true });

// Sync file info
const info = statSync("./file.txt");
console.log("File size:", info.size);

// Sync read dir
const entries = readdirSync("./data");
for (const entry of entries) {
  console.log(`${entry.name} - ${entry.isFile ? "file" : "dir"}`);
}

// Sync checks
if (existsSync("./file.txt")) {
  console.log("File exists");
}
if (isFileSync("./file.txt")) {
  console.log("Is a file");
}
if (isDirectorySync("./data")) {
  console.log("Is a directory");
}

// Sync real path
const realPath = realPathSync("./link.txt");
console.log("Real path:", realPath);
```

### Network Operations

```typescript
import {
  connect,
  serve,
  startTls,
  upgradeWebSocket,
} from "jsr:@dreamer/runtime-adapter";

// HTTP server (auto-adapts Bun or Deno)
const handle = await serve({ port: 3000 }, (req) => {
  const url = new URL(req.url);

  // WebSocket upgrade (auto-adapts Bun or Deno)
  if (url.pathname === "/ws") {
    const { socket, response } = upgradeWebSocket(req, {
      idleTimeout: 120,
    });

    socket.addEventListener("open", () => {
      console.log("WebSocket connected");
    });

    socket.addEventListener("message", (event) => {
      console.log("Received:", event.data);
      socket.send(`Echo: ${event.data}`);
    });

    socket.addEventListener("close", () => {
      console.log("WebSocket closed");
    });

    return response || new Response("WebSocket upgrade", { status: 101 });
  }

  return new Response("Hello, World!");
});

console.log("Server on port:", handle.port);
await handle.shutdown();

// TCP connection
const conn = await connect({
  host: "example.com",
  port: 80,
});

// TLS connection
const tlsConn = await startTls(conn, {
  host: "example.com",
});
```

### Environment Variables

```typescript
import {
  deleteEnv,
  getEnv,
  getEnvAll,
  hasEnv,
  setEnv,
} from "jsr:@dreamer/runtime-adapter";

// Get env var (auto-adapts Bun or Deno)
const apiKey = getEnv("API_KEY");

// Set env var
setEnv("DEBUG", "true");

// Get all env vars
const allEnv = getEnvAll();

// Check if env var exists
if (hasEnv("NODE_ENV")) {
  console.log("NODE_ENV is set");
}

// Delete env var
deleteEnv("DEBUG");
```

### Command Execution

#### Async

```typescript
import { createCommand } from "jsr:@dreamer/runtime-adapter";

// Option 1: output() for simple cases
const cmd = createCommand("ls", {
  args: ["-la"],
  cwd: "./",
  stdout: "piped",
  stderr: "piped",
});

const output = await cmd.output();
console.log("stdout:", new TextDecoder().decode(output.stdout));
console.log("stderr:", new TextDecoder().decode(output.stderr));
console.log("exit code:", output.code);
console.log("success:", output.success);

// Option 2: spawn() for process control
const cmd2 = createCommand("sleep", {
  args: ["10"],
  stdout: "inherit",
  stderr: "inherit",
});

const child = cmd2.spawn();
console.log("PID:", child.pid);

const status = await child.status;
console.log("Status:", status);

// child.kill(15); // SIGTERM
```

#### Sync ⭐ New

```typescript
import { execCommandSync } from "jsr:@dreamer/runtime-adapter";

// Sync command execution
try {
  const output = execCommandSync("echo", ["Hello, World!"]);
  console.log("Output:", output.trim());
} catch (error) {
  console.error("Command failed:", error);
}

// With cwd and env
const result = execCommandSync("pwd", [], {
  cwd: "./src",
  env: { CUSTOM_VAR: "value" },
});
console.log("CWD:", result.trim());
```

### Terminal Detection and Operations

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

// Check if terminal (auto-adapts Bun or Deno)
if (isTerminal()) {
  console.log("Running in terminal");
}

if (isStderrTerminal()) {
  console.log("stderr is terminal");
}

if (isStdinTerminal()) {
  console.log("stdin is terminal");
}

// Get stdout stream (async write)
const stdout = getStdout();
const writer = stdout.getWriter();
await writer.write(new TextEncoder().encode("Hello\n"));
writer.releaseLock();

// Get stderr stream
const stderr = getStderr();
const stderrWriter = stderr.getWriter();
await stderrWriter.write(new TextEncoder().encode("Error message\n"));
stderrWriter.releaseLock();

// Sync write (e.g. for ANSI escape sequences)
const encoder = new TextEncoder();
writeStdoutSync(encoder.encode("\x1b[32mGreen text\x1b[0m\n"));
writeStderrSync(encoder.encode("Error message\n"));

// Read stdin
const buffer = new Uint8Array(1024);
const bytesRead = await readStdin(buffer);
if (bytesRead !== null) {
  const input = new TextDecoder().decode(buffer.subarray(0, bytesRead));
  console.log("User input:", input);
}

// Raw mode (e.g. for password input)
const isRaw = setStdinRaw(true, { cbreak: true });
if (isRaw) {
  setStdinRaw(false);
}
```

### Cron Tasks

```typescript
import { cron } from "jsr:@dreamer/runtime-adapter";

// Register cron task (auto-adapts Bun or Deno)
// Uses node-cron, supports second-level expressions

// Every minute
const handle1 = cron("0 * * * * *", async () => {
  console.log("Every minute");
});

// Every 5 seconds
const handle2 = cron("*/5 * * * * *", async () => {
  console.log("Every 5 seconds");
});

// Daily at 2:00 AM
const handle3 = cron("0 0 2 * * *", async () => {
  console.log("Daily at 2 AM");
});

// Cancel (close or stop)
handle1.close();
handle2.stop();
handle3.close();

// AbortSignal to cancel
const controller = new AbortController();
const handle4 = cron("*/10 * * * * *", async () => {
  console.log("Every 10 seconds");
}, { signal: controller.signal });

setTimeout(() => controller.abort(), 60000);
```

### File Hashing

#### Async API

```typescript
import { hash, hashFile } from "jsr:@dreamer/runtime-adapter";

// File hash
const fileHash = await hashFile("./file.txt");
console.log("File hash:", fileHash);

// String hash
const stringHash = await hash("Hello, World!");
console.log("String hash:", stringHash);

// Different algorithms
const sha512 = await hashFile("./file.txt", "SHA-512");
const md5 = await hash("Hello, World!", "MD5");
```

#### Sync API ⭐ New

```typescript
import { hashFileSync, hashSync } from "jsr:@dreamer/runtime-adapter";

// Sync file hash
const fileHash = hashFileSync("./file.txt");
console.log("File hash:", fileHash);

// Sync string hash
const stringHash = hashSync("Hello, World!");
console.log("String hash:", stringHash);

// Different algorithms
const sha512 = hashFileSync("./file.txt", "SHA-512");
const md5 = hashSync("Hello, World!", "MD5");
```

> 📌 **Note**: Sync hash requires `node:crypto`. Deno needs Node compat; Bun
> supports natively.

### System Info

#### Async API

```typescript
import {
  getCpuUsage,
  getDiskUsage,
  getLoadAverage,
  getMemoryInfo,
  getSystemInfo,
  getSystemStatus,
} from "jsr:@dreamer/runtime-adapter";

// Memory info
const memory = await getMemoryInfo();
console.log(`Total: ${(memory.total / 1024 / 1024 / 1024).toFixed(2)} GB`);
console.log(`Used: ${(memory.used / 1024 / 1024 / 1024).toFixed(2)} GB`);
console.log(`Usage: ${memory.usagePercent.toFixed(2)}%`);

// CPU usage
const cpu = await getCpuUsage();
console.log(`CPU: ${cpu.usagePercent.toFixed(2)}%`);

// Disk usage
const disk = await getDiskUsage("/");
console.log(`Disk total: ${(disk.total / 1024 / 1024 / 1024).toFixed(2)} GB`);
console.log(`Disk usage: ${disk.usagePercent.toFixed(2)}%`);

// Load average (Linux/macOS)
const load = await getLoadAverage();
if (load) {
  console.log(
    `Load 1/5/15: ${load.load1.toFixed(2)} / ${load.load5.toFixed(2)} / ${
      load.load15.toFixed(2)
    }`,
  );
}

// System info
const system = await getSystemInfo();
console.log(`Hostname: ${system.hostname}`);
console.log(`Platform: ${system.platform}`);
console.log(`Arch: ${system.arch}`);
console.log(`Uptime: ${(system.uptime / 3600).toFixed(2)} hours`);
if (system.cpus) {
  console.log(`CPUs: ${system.cpus}`);
}

const status = await getSystemStatus();
console.log("System status:", status);
```

#### Sync API ⭐ New

```typescript
import {
  getLoadAverageSync,
  getMemoryInfoSync,
  getSystemInfoSync,
} from "jsr:@dreamer/runtime-adapter";

// Sync memory info
const memory = getMemoryInfoSync();
console.log(`Total: ${(memory.total / 1024 / 1024 / 1024).toFixed(2)} GB`);

// Sync load average
const load = getLoadAverageSync();
if (load) {
  console.log(`Load 1m: ${load.load1.toFixed(2)}`);
}

// Sync system info
const system = getSystemInfoSync();
console.log(`Hostname: ${system.hostname}`);
console.log(`Platform: ${system.platform}`);
```

---

## 📚 API Reference

### Runtime Detection

| API               | Description              | Returns                        |
| ----------------- | ------------------------ | ------------------------------ |
| `detectRuntime()` | Detect current runtime   | `"deno" \| "bun" \| "unknown"` |
| `RUNTIME`         | Current runtime constant | `"deno" \| "bun"`              |
| `IS_BUN`          | Is Bun                   | `boolean`                      |
| `IS_DENO`         | Is Deno                  | `boolean`                      |
| `type Runtime`    | Runtime type             | `"deno" \| "bun" \| "unknown"` |

### File System API

#### Async File Read/Write

| API                                   | Description         | Returns               |
| ------------------------------------- | ------------------- | --------------------- |
| `readFile(path)`                      | Read file (binary)  | `Promise<Uint8Array>` |
| `readTextFile(path)`                  | Read text file      | `Promise<string>`     |
| `writeFile(path, data, options?)`     | Write file (binary) | `Promise<void>`       |
| `writeTextFile(path, data, options?)` | Write text file     | `Promise<void>`       |
| `open(path, options?)`                | Open file           | `Promise<File>`       |
| `create(path)`                        | Create file         | `Promise<File>`       |

#### Sync File Read/Write ⭐ New

| API                                       | Description     | Returns      |
| ----------------------------------------- | --------------- | ------------ |
| `readFileSync(path)`                      | Sync read file  | `Uint8Array` |
| `readTextFileSync(path)`                  | Sync read text  | `string`     |
| `writeFileSync(path, data, options?)`     | Sync write file | `void`       |
| `writeTextFileSync(path, data, options?)` | Sync write text | `void`       |

#### Async Directory Operations

| API                         | Description       | Options                                                                 |
| --------------------------- | ----------------- | ----------------------------------------------------------------------- |
| `mkdir(path, options?)`     | Create directory  | `recursive?`, `mode?`                                                   |
| `ensureDir(path, options?)` | Ensure dir exists | `mode?`                                                                 |
| `remove(path, options?)`    | Remove file/dir   | `recursive?`                                                            |
| `readdir(path)`             | Read directory    | -                                                                       |
| `stat(path)`                | Get file info     | -                                                                       |
| `walk(dir, options?)`       | Recursive walk    | `maxDepth?`, `includeFiles?`, `includeDirs?`, `match?`, `skipSymlinks?` |

#### Sync Directory Operations ⭐ New

| API                             | Description     | Options               |
| ------------------------------- | --------------- | --------------------- |
| `mkdirSync(path, options?)`     | Sync create dir | `recursive?`, `mode?` |
| `ensureDirSync(path, options?)` | Sync ensure dir | `mode?`               |
| `removeSync(path, options?)`    | Sync remove     | `recursive?`          |
| `readdirSync(path)`             | Sync read dir   | -                     |
| `statSync(path)`                | Sync stat       | -                     |
| `existsSync(path)`              | Sync exists     | -                     |
| `isFileSync(path)`              | Sync is file    | -                     |
| `isDirectorySync(path)`         | Sync is dir     | -                     |
| `realPathSync(path)`            | Sync real path  | -                     |

#### File Operations

| API                            | Description        |
| ------------------------------ | ------------------ |
| `copyFile(src, dest)`          | Copy file          |
| `rename(oldPath, newPath)`     | Rename or move     |
| `symlink(target, path, type?)` | Create symlink     |
| `realPath(path)`               | Resolve real path  |
| `chmod(path, mode)`            | Change permissions |
| `chown(path, uid, gid)`        | Change owner       |
| `exists(path)`                 | Check exists       |
| `isFile(path)`                 | Check is file      |
| `isDirectory(path)`            | Check is dir       |
| `truncate(path, len)`          | Truncate file      |

#### Temp Files/Dirs

| API                      | Description      | Options                      |
| ------------------------ | ---------------- | ---------------------------- |
| `makeTempDir(options?)`  | Create temp dir  | `prefix?`, `suffix?`, `dir?` |
| `makeTempFile(options?)` | Create temp file | `prefix?`, `suffix?`, `dir?` |

#### Working Directory

| API           | Description | Returns         |
| ------------- | ----------- | --------------- |
| `cwd()`       | Get CWD     | `string`        |
| `chdir(path)` | Change CWD  | `Promise<void>` |

#### File Watching

| API                        | Description        | Options                                |
| -------------------------- | ------------------ | -------------------------------------- |
| `watchFs(paths, options?)` | Watch file changes | `recursive?`, `filesOnly?`, `exclude?` |

**Options**:

- `recursive`: Recursive watch (default: `false`)
- `filesOnly`: Only watch files (default: `false`)
- `exclude`: Paths to exclude (string or RegExp)

**Example**:

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
  console.log("Change:", event.kind, event.paths);
}
```

### Network API

#### HTTP Server

```typescript
serve(
  options: ServeOptions,
  handler: (req: Request) => Response | Promise<Response>
): Promise<ServeHandle>
```

**Options**:

- `port?: number` - Port (default: random)
- `host?: string` - Host (default: `"0.0.0.0"`)
- `onListen?: (params: { host: string; port: number }) => void` - Listen
  callback

**Returns**:

- `ServeHandle.port` - Server port
- `ServeHandle.close()` - Close server

#### WebSocket

```typescript
upgradeWebSocket(
  request: Request,
  options?: UpgradeWebSocketOptions
): UpgradeWebSocketResult
```

**Options**:

- `protocol?: string` - WebSocket subprotocol
- `idleTimeout?: number` - Idle timeout (seconds)

**Returns**:

- `socket: WebSocket` - WebSocket object (standard `addEventListener`, `send`,
  `close`)
- `response: Response | undefined` - HTTP response (Deno returns Response; Bun
  returns undefined)

**Notes**:

- ✅ Cross-runtime: Deno and Bun both supported
- ✅ Unified API: Standard `addEventListener`
- ✅ Auto-adapt: Bun handles WebSocket upgrade automatically
- ✅ Events: `open`, `message`, `close`, `error`

**Example**:

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

#### TCP/TLS

| API                        | Description    | Options        |
| -------------------------- | -------------- | -------------- |
| `connect(options)`         | TCP connection | `host`, `port` |
| `startTls(conn, options?)` | Upgrade to TLS | `host?`        |

### Environment Variable API

| API                  | Description      | Returns                  |
| -------------------- | ---------------- | ------------------------ |
| `getEnv(key)`        | Get env var      | `string \| undefined`    |
| `setEnv(key, value)` | Set env var      | `void`                   |
| `deleteEnv(key)`     | Delete env var   | `void`                   |
| `getEnvAll()`        | Get all env vars | `Record<string, string>` |
| `hasEnv(key)`        | Check if exists  | `boolean`                |

### Process/Command API

#### Async

```typescript
createCommand(
  command: string,
  options?: CommandOptions
): CommandProcess
```

**Options**:

- `args?: string[]` - Command arguments
- `cwd?: string` - Working directory
- `env?: Record<string, string>` - Environment variables
- `stdin?`, `stdout?`, `stderr?` - `"inherit" \| "piped" \| "null"`

**CommandProcess**:

- `output()` - Get command output
- `status()` - Get status
- `kill(signo?)` - Kill process
- `pid` - Process ID

#### Sync ⭐ New

```typescript
execCommandSync(
  command: string,
  args?: string[],
  options?: { cwd?: string; env?: Record<string, string> }
): string
```

**Notes**:

- Sync execution, returns output
- Throws on failure
- Deno: `Deno.Command.outputSync()`
- Bun: `child_process.execFileSync()`

### Terminal API

| API                           | Description          | Returns                      |
| ----------------------------- | -------------------- | ---------------------------- |
| `isTerminal()`                | Is stdout a terminal | `boolean`                    |
| `isStderrTerminal()`          | Is stderr a terminal | `boolean`                    |
| `isStdinTerminal()`           | Is stdin a terminal  | `boolean`                    |
| `getStdout()`                 | Get stdout stream    | `WritableStream<Uint8Array>` |
| `getStderr()`                 | Get stderr stream    | `WritableStream<Uint8Array>` |
| `writeStdoutSync(data)`       | Sync write stdout    | `void`                       |
| `writeStderrSync(data)`       | Sync write stderr    | `void`                       |
| `readStdin(buffer)`           | Read stdin           | `Promise<number \| null>`    |
| `setStdinRaw(mode, options?)` | Set raw mode         | `boolean`                    |

### Cron API

```typescript
cron(
  expression: string,
  handler: () => void | Promise<void>,
  options?: CronOptions
): CronHandle
```

**Cron expression** (6 fields: second minute hour day month weekday):

- `"*/5 * * * * *"` - Every 5 seconds
- `"0 * * * * *"` - Every minute
- `"0 0 2 * * *"` - Daily at 2:00 AM

**Options**:

- `signal?: AbortSignal` - Cancel task

**Returns**:

- `CronHandle.close()` - Close task
- `CronHandle.stop()` - Alias for close

> 📌 Uses `node-cron@3.0.3`, second-level expressions. `stop()` and `close()`
> are equivalent.

### Process Info API

| API          | Description        | Returns                                         |
| ------------ | ------------------ | ----------------------------------------------- |
| `pid()`      | Current process ID | `number`                                        |
| `platform()` | OS platform        | `"linux" \| "darwin" \| "windows" \| "unknown"` |
| `arch()`     | CPU architecture   | `"x86_64" \| "aarch64" \| "arm64" \| "unknown"` |
| `version()`  | Runtime version    | `RuntimeVersion`                                |

**RuntimeVersion**:

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

### Process Utils API

| API          | Description            | Returns    |
| ------------ | ---------------------- | ---------- |
| `args()`     | Command-line arguments | `string[]` |
| `exit(code)` | Exit program           | `never`    |

### Signal Handling API

| API                                     | Description     | Params                          |
| --------------------------------------- | --------------- | ------------------------------- |
| `addSignalListener(signal, handler)`    | Add listener    | `signal`: SIGTERM, SIGINT, etc. |
| `removeSignalListener(signal, handler)` | Remove listener | Same                            |

### Path API

| API                    | Description         | Returns   |
| ---------------------- | ------------------- | --------- |
| `join(...paths)`       | Join path segments  | `string`  |
| `dirname(path)`        | Get dirname         | `string`  |
| `basename(path, ext?)` | Get basename        | `string`  |
| `extname(path)`        | Get extension       | `string`  |
| `resolve(...paths)`    | Resolve to absolute | `string`  |
| `relative(from, to)`   | Relative path       | `string`  |
| `normalize(path)`      | Normalize path      | `string`  |
| `isAbsolute(path)`     | Is absolute         | `boolean` |
| `isRelative(path)`     | Is relative         | `boolean` |

### File Hash API

#### Async

| API                          | Description | Params                                 | Returns           |
| ---------------------------- | ----------- | -------------------------------------- | ----------------- |
| `hashFile(path, algorithm?)` | File hash   | `path`, `algorithm` (default: SHA-256) | `Promise<string>` |
| `hash(data, algorithm?)`     | Data hash   | `data`, `algorithm`                    | `Promise<string>` |

#### Sync ⭐ New

| API                              | Description    | Returns  |
| -------------------------------- | -------------- | -------- |
| `hashFileSync(path, algorithm?)` | Sync file hash | `string` |
| `hashSync(data, algorithm?)`     | Sync data hash | `string` |

**HashAlgorithm**:

- `"SHA-256"`（默认）
- `"SHA-512"`
- `"SHA-1"`
- `"MD5"`

> 📌 Sync hash requires `node:crypto`. Deno needs Node compat; Bun supports
> natively.

### System Info API

#### Async

| API                                        | Description               | Params                        | Returns                             |
| ------------------------------------------ | ------------------------- | ----------------------------- | ----------------------------------- |
| `getMemoryInfo()`                          | Memory info               | -                             | `Promise<MemoryInfo>`               |
| `getCpuUsage(interval?)`                   | CPU usage                 | `interval` (ms, default: 100) | `Promise<CpuUsage>`                 |
| `getLoadAverage()`                         | System load (Linux/macOS) | -                             | `Promise<LoadAverage \| undefined>` |
| `getDiskUsage(path?)`                      | Disk usage                | `path` (default: CWD)         | `Promise<DiskUsage>`                |
| `getSystemInfo()`                          | System info               | -                             | `Promise<SystemInfo>`               |
| `getSystemStatus(cpuInterval?, diskPath?)` | Full status               | -                             | `Promise<SystemStatus>`             |

#### Sync ⭐ New

| API                    | Description             | Returns                    |
| ---------------------- | ----------------------- | -------------------------- |
| `getMemoryInfoSync()`  | Sync memory info        | `MemoryInfo`               |
| `getLoadAverageSync()` | Sync load (Linux/macOS) | `LoadAverage \| undefined` |
| `getSystemInfoSync()`  | Sync system info        | `SystemInfo`               |

**MemoryInfo**:

```typescript
interface MemoryInfo {
  total: number; // Total bytes
  available: number;
  used: number;
  free: number;
  usagePercent: number;
  swapTotal?: number;
  swapFree?: number;
}
```

**CpuUsage**: `usagePercent`, `userPercent`, `systemPercent`

**LoadAverage**: `load1`, `load5`, `load15` (1/5/15 min avg)

**DiskUsage**: `total`, `used`, `available`, `usagePercent`

**SystemInfo**: `hostname`, `platform`, `arch`, `uptime`, `cpus?`

**SystemStatus**: `system`, `memory`, `cpu`, `loadAverage?`, `disk?`

> 📌 Windows: `getLoadAverage()` returns `undefined`. Deno uses native API; Bun
> uses system commands. APIs return defaults on failure, no errors.

---

## ⚡ Performance

- **Type-safe access**: Runtime API via type-safe utilities
- **Auto-adapt**: Compile-time runtime detection
- **Sync API**: For blocking scenarios (CLI)
- **Batch ops**: File system batch support
- **Streaming**: Network and file streaming

---

## 🧪 Testing

### Run Tests

```bash
# Deno
deno test -A tests/

# Bun
bun test tests/
```

### Test Report

See [TEST_REPORT.md](./TEST_REPORT.md).

- ✅ 211 tests passed
- ✅ 17 modules covered
- ✅ Deno and Bun compatibility
- ✅ Sync and async API tests
- ✅ WebSocket tests

---

## 📝 Notes

- **Server/client separation**: `/client` subpath (this lib is server-only)
- **Unified API**: Same interface on Deno and Bun
- **Type safety**: Full TypeScript, zero `any`, type-safe `getDeno()`,
  `getBun()`, `getProcess()`
- **Auto-adapt**: Unified abstraction over native APIs
- **Sync/async**: Sync for CLI, async for most cases
- **File watching**: `watchFs()` on Deno and Bun (Bun uses `fs.watch`)
- **WebSocket**: `upgradeWebSocket()` unified, Bun auto-handles
- **Cron**: `node-cron@3.0.3`, second-level expressions
- **TCP/TLS**: Bun uses Node compat API
- **Permissions**: Deno tests need `-A` or `--allow-all`

---

## 🤝 Contributing

Issues and Pull Requests welcome!

---

## 📄 License

MIT License - see [LICENSE.md](./LICENSE.md)

---

<div align="center">

**Made with ❤️ by Dreamer Team**

</div>
