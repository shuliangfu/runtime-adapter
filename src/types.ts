/**
 * @fileoverview 运行时 API 类型定义
 *
 * 定义 Deno 和 Bun 运行时的 API 接口类型，用于类型安全的适配
 */

/**
 * Deno 全局 API 接口
 */
export interface DenoGlobal {
  Deno: {
    // 文件系统 API
    readFile(path: string): Promise<Uint8Array>;
    readTextFile(
      path: string,
      options?: { encoding?: string },
    ): Promise<string>;
    writeFile(
      path: string,
      data: Uint8Array,
      options?: { create?: boolean; mode?: number },
    ): Promise<void>;
    writeTextFile(
      path: string,
      data: string,
      options?: { create?: boolean; mode?: number },
    ): Promise<void>;
    open(
      path: string,
      options?: {
        read?: boolean;
        write?: boolean;
        create?: boolean;
        truncate?: boolean;
        append?: boolean;
        createNew?: boolean;
        mode?: number;
      },
    ): Promise<
      {
        readable: ReadableStream<Uint8Array>;
        writable: WritableStream<Uint8Array>;
        close(): void;
      }
    >;
    mkdir(
      path: string,
      options?: { recursive?: boolean; mode?: number },
    ): Promise<void>;
    remove(path: string, options?: { recursive?: boolean }): Promise<void>;
    stat(
      path: string,
    ): Promise<
      {
        isFile: boolean;
        isDirectory: boolean;
        isSymlink: boolean;
        size: number;
        mtime: Date | null;
        atime: Date | null;
        birthtime: Date | null;
        mode: number | null;
        dev: number | null;
        ino: number | null;
        nlink: number | null;
        uid: number | null;
        gid: number | null;
        rdev: number | null;
        blksize: number | null;
        blocks: number | null;
      }
    >;
    watchFs(
      paths: string | string[],
      options?: { recursive?: boolean },
    ): {
      close(): void;
      [Symbol.asyncIterator](): AsyncIterableIterator<
        { kind: "create" | "modify" | "remove"; paths: string[] }
      >;
    };
    readDir(
      path: string,
    ): AsyncIterable<
      {
        name: string;
        isFile: boolean;
        isDirectory: boolean;
        isSymlink: boolean;
      }
    >;
    copyFile(src: string, dest: string): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<void>;
    symlink(
      target: string,
      path: string,
      options?: { type?: "file" | "dir" },
    ): Promise<void>;
    realPath(path: string): Promise<string>;
    chmod(path: string, mode: number): Promise<void>;
    chown(path: string, uid: number, gid: number): Promise<void>;
    makeTempDir(
      options?: { prefix?: string; suffix?: string; dir?: string },
    ): Promise<string>;
    makeTempFile(
      options?: { prefix?: string; suffix?: string; dir?: string },
    ): Promise<string>;
    cwd(): string;
    chdir(path: string): void;
    truncate(path: string, len: number): Promise<void>;
    // 同步文件系统 API
    statSync(
      path: string,
    ): {
      isFile: boolean;
      isDirectory: boolean;
      isSymlink: boolean;
      size: number;
      mtime: Date | null;
      atime: Date | null;
      birthtime: Date | null;
      mode: number | null;
      dev: number | null;
      ino: number | null;
      nlink: number | null;
      uid: number | null;
      gid: number | null;
      rdev: number | null;
      blksize: number | null;
      blocks: number | null;
    };
    readTextFileSync(path: string, options?: { encoding?: string }): string;
    readFileSync(path: string): Uint8Array;
    readDirSync(
      path: string,
    ): Iterable<
      {
        name: string;
        isFile: boolean;
        isDirectory: boolean;
        isSymlink: boolean;
      }
    >;
    realPathSync(path: string): string;
    mkdirSync(
      path: string,
      options?: { recursive?: boolean; mode?: number },
    ): void;
    removeSync(path: string, options?: { recursive?: boolean }): void;
    writeFileSync(
      path: string,
      data: Uint8Array,
      options?: { create?: boolean; mode?: number },
    ): void;
    writeTextFileSync(
      path: string,
      data: string,
      options?: { create?: boolean; mode?: number },
    ): void;
    // 网络 API
    serve(
      handler: (req: Request) => Response | Promise<Response>,
    ): {
      finished: Promise<void>;
      shutdown(options?: { graceful?: boolean }): Promise<void>;
      port?: number;
    };
    serve(
      options: {
        port?: number;
        hostname?: string;
        onListen?: (params: { hostname: string; port: number }) => void;
      },
      handler: (req: Request) => Response | Promise<Response>,
    ): {
      finished: Promise<void>;
      shutdown(options?: { graceful?: boolean }): Promise<void>;
      port?: number;
    };
    upgradeWebSocket(
      request: Request,
      options?: { protocol?: string; idleTimeout?: number },
    ): { socket: WebSocket; response: Response };
    connect(
      options: { hostname: string; port: number; transport?: "tcp" },
    ): Promise<
      {
        readable: ReadableStream<Uint8Array>;
        writable: WritableStream<Uint8Array>;
        close(): void;
        closeWrite(): void;
        rid: number;
        localAddr: { host: string; port: number; transport: string };
        remoteAddr: { host: string; port: number; transport: string };
      }
    >;
    startTls(
      conn: { rid: number },
      options?: { hostname?: string; caCerts?: Uint8Array[] },
    ): Promise<
      {
        readable: ReadableStream<Uint8Array>;
        writable: WritableStream<Uint8Array>;
        close(): void;
        rid: number;
      }
    >;
    // 环境变量 API
    env: {
      get(key: string): string | undefined;
      set(key: string, value: string): void;
      delete(key: string): void;
      toObject(): Record<string, string>;
      has(key: string): boolean;
    };
    // 进程 API
    Command: new (
      command: string,
      options?: {
        args?: string[];
        cwd?: string;
        env?: Record<string, string>;
        stdin?: "inherit" | "piped" | "null";
        stdout?: "inherit" | "piped" | "null";
        stderr?: "inherit" | "piped" | "null";
      },
    ) => {
      output(): Promise<
        {
          code: number;
          signal: string | null;
          stdout: Uint8Array;
          stderr: Uint8Array;
          success: boolean;
        }
      >;
      outputSync(): {
        code: number;
        signal: string | null;
        stdout: Uint8Array;
        stderr: Uint8Array;
        success: boolean;
      };
      status(): Promise<
        { code: number; signal: string | null; success: boolean }
      >;
      spawn(): {
        stdin: WritableStream<Uint8Array> | null;
        stdout: ReadableStream<Uint8Array> | null;
        stderr: ReadableStream<Uint8Array> | null;
        pid: number;
        status: Promise<
          { code: number; signal: string | null; success: boolean }
        >;
        kill(signo?: number): void;
      };
    };
    // 终端 API
    stdout: {
      isTerminal(): boolean;
      writable: WritableStream<Uint8Array>;
      writeSync(data: Uint8Array): void;
    };
    stderr: {
      isTerminal(): boolean;
      writable: WritableStream<Uint8Array>;
      writeSync(data: Uint8Array): void;
    };
    stdin: { readable: ReadableStream<Uint8Array>; isTerminal(): boolean };
    // 系统信息 API
    systemMemoryInfo(): {
      total: number;
      available: number;
      free: number;
      swapTotal?: number;
      swapFree?: number;
    };
    cpuUsage(
      prevCpuUsage?: { user: number; system: number },
    ): { user: number; system: number };
    loadavg(): [number, number, number];
    hostname(): string;
    osUptime(): number;
    build?: { os: string; arch: string };
    version: { deno: string; v8: string; typescript: string; target?: string };
    pid: number;
    args: string[];
    // 信号处理 API
    addSignalListener(
      signal: DenoSignal | BunSignal,
      handler: () => void,
    ): void;
    removeSignalListener(
      signal: DenoSignal | BunSignal,
      handler: () => void,
    ): void;
    exit(code: number): never;
  };
}

/**
 * Bun 全局 API 接口
 */
export interface BunGlobal {
  Bun: {
    // 文件系统 API
    file(path: string): {
      arrayBuffer(): Promise<ArrayBuffer>;
      text(): Promise<string>;
      exists(): Promise<boolean>;
      stream(): ReadableStream<Uint8Array>;
    };
    write(path: string, data: Uint8Array | string): Promise<number>;
    // 网络 API
    serve(options: {
      port?: number;
      hostname?: string;
      fetch: (req: Request, server: BunServer) => Response | Promise<Response>;
      websocket?: {
        message?: (ws: BunWebSocket, message: string | Uint8Array) => void;
        open?: (ws: BunWebSocket) => void;
        close?: (ws: BunWebSocket, code?: number, reason?: string) => void;
        error?: (ws: BunWebSocket, error: Error) => void;
      };
    }): BunServer;
    connect(options: {
      hostname: string;
      port: number;
      socket?: {
        open?: (sock: BunSocket) => void;
        data?: (sock: BunSocket, data: Uint8Array) => void;
        close?: (sock: BunSocket) => void;
        error?: (sock: BunSocket, error: Error) => void;
        connectError?: (sock: BunSocket, error: Error) => void;
      };
      tls?: { ca?: Uint8Array[] };
    }): void;
    // 进程 API
    spawn(
      command: string[],
      options?: {
        cwd?: string;
        env?: Record<string, string>;
        stdin?: "inherit" | "piped" | "pipe" | "null";
        stdout?: "inherit" | "piped" | "pipe" | "null";
        stderr?: "inherit" | "piped" | "pipe" | "null";
      },
    ): {
      stdin?: WritableStream<Uint8Array> | null;
      stdout: ReadableStream<Uint8Array>;
      stderr: ReadableStream<Uint8Array>;
      exitCode: Promise<number>;
      exited: Promise<number>;
      kill(signal?: string | number): void;
      pid: number;
    };
    // 版本信息
    version: string;
  };
}

/**
 * Bun 服务器接口
 */
export interface BunServer {
  port: number;
  hostname?: string;
  stop(): Promise<void>;
  upgrade(
    request: Request,
    options?: {
      data?: { adapterId?: string; [key: string]: unknown };
      headers?: Record<string, string>;
    },
  ): boolean;
}

/**
 * Bun WebSocket 接口
 */
export interface BunWebSocket extends WebSocket {
  data?: {
    adapterId?: string;
    [key: string]: unknown;
  };
}

/**
 * Bun Socket 接口
 */
export interface BunSocket {
  fd?: number;
  localAddress?: string;
  localPort?: number;
  remoteAddress?: string;
  remotePort?: number;
  write(chunk: Uint8Array): number;
  end(): void;
  terminate(): void;
  on(event: "drain", handler: () => void): void;
  off(event: "drain", handler: () => void): void;
  [key: string]: unknown;
}

/**
 * Deno 支持的系统信号类型
 * 参考自 Deno.Signal (不稳定 API 已在 1.x 中标准化)
 */
export type DenoSignal =
  | "SIGINT" // 终端中断 (Ctrl+C)
  | "SIGTERM" // 终止信号 (默认杀死进程信号)
  | "SIGHUP" // 终端挂断
  | "SIGQUIT" // 终端退出
  | "SIGUSR1" // 用户自定义信号 1
  | "SIGUSR2" // 用户自定义信号 2
  | "SIGALRM" // 闹钟信号
  | "SIGCHLD" // 子进程状态改变
  | "SIGCONT" // 继续执行暂停的进程
  | "SIGSTOP" // 暂停执行 (不可捕获)
  | "SIGTSTP" // 终端停止信号 (Ctrl+Z)
  | "SIGTTIN" // 后台进程尝试读取终端
  | "SIGTTOU" // 后台进程尝试写入终端
  | "SIGBUS" // 总线错误
  | "SIGFPE" // 算术异常
  | "SIGILL" // 非法指令
  | "SIGSEGV" // 段错误
  | "SIGTRAP" // 跟踪断点
  | "SIGWINCH"; // 窗口大小改变
/**
 * 完整的 Bun 进程信号与事件类型定义
 */
export type BunSignal =
  // --- 标准生命周期事件 ---
  | "exit" // 进程即将退出（仅限同步操作）
  | "beforeExit" // 事件循环为空，退出前（支持异步）
  // --- 错误处理事件 ---
  | "uncaughtException" // 未捕获的异常
  | "unhandledRejection" // 未处理的 Promise 拒绝
  | "warning" // 运行时警告
  | "rejectionHandled" // 延迟处理的 Promise 拒绝
  // --- 常见的系统 POSIX 信号 ---
  | "SIGINT" // Terminal 中断 (Ctrl+C)
  | "SIGTERM" // 终止信号 (Docker/Kubernetes 停止信号)
  | "SIGHUP" // 终端挂断
  | "SIGQUIT" // 终端退出
  | "SIGILL" // 非法指令
  | "SIGTRAP" // 跟踪/断点陷阱
  | "SIGABRT" // 中止信号
  | "SIGBUS" // 总线错误
  | "SIGFPE" // 算术异常
  | "SIGSEGV" // 段错误
  | "SIGUSR1" // 用户自定义信号 1
  | "SIGUSR2" // 用户自定义信号 2
  // --- 其他特定平台信号 ---
  | "SIGBREAK" // Windows Ctrl+Break
  | "SIGWINCH" // 终端窗口大小改变
  // --- 进程间通信 ---
  | "message" // 收到父进程消息
  | "disconnect"; // IPC 通道断开

/**
 * Node.js Process 接口（用于 Bun 环境）
 */
export interface ProcessGlobal {
  process?: {
    platform: string;
    arch: string;
    pid: number;
    env: Record<string, string | undefined>;
    argv: string[];
    cwd(): string;
    chdir(path: string): void;
    uptime(): number;
    cpuUsage(
      previousValue?: { user: number; system: number },
    ): { user: number; system: number };
    memoryUsage(): { rss: number; heapTotal: number; heapUsed: number };
    stdout?: {
      isTTY?: boolean;
      fd?: number;
      write(
        data: Uint8Array,
        callback?: (error: Error | null | undefined) => void,
      ): void;
    };
    stderr?: {
      isTTY?: boolean;
      fd?: number;
      write(
        data: Uint8Array,
        callback?: (error: Error | null | undefined) => void,
      ): void;
    };
    stdin?: {
      isTTY?: boolean;
      once(event: "data", handler: (chunk: Uint8Array) => void): void;
      once(event: "end", handler: () => void): void;
      once(event: "error", handler: () => void): void;
    };
    on(
      signal: DenoSignal | BunSignal,
      handler: () => void,
    ): void;
    off(
      signal: DenoSignal | BunSignal,
      handler: () => void,
    ): void;
    exit(code: number): never;
  };
}

/**
 * Node.js Crypto Hash 接口
 */
export interface CryptoHash {
  update(data: string | Uint8Array): CryptoHash;
  digest(encoding: "hex"): string;
}

/**
 * Node.js Crypto 模块接口
 */
export interface CryptoModule {
  createHash(algorithm: "sha256" | "sha512" | "sha1" | "md5"): CryptoHash;
  readFileSync(path: string): Buffer;
}

/**
 * Node.js Buffer 类型（使用 Uint8Array 作为基础类型）
 * 在 Deno/Bun 环境中，Buffer 实际上就是 Uint8Array 的别名
 */
export type Buffer = Uint8Array;

/**
 * Node.js Buffer 构造函数接口
 */
export interface BufferConstructor {
  from(data: string | Uint8Array, encoding?: string): Buffer;
  isBuffer(obj: unknown): obj is Buffer;
}

/**
 * Node.js require 函数类型
 */
export type RequireFunction = (module: string) => unknown;
