/**
 * 进程/命令 API 适配模块
 * 提供统一的进程和命令执行接口，兼容 Deno / Bun / Node.js
 */

import { IS_BUN, IS_NODE } from "./detect.ts";
import { RuntimeAdapterError } from "./errors.ts";
import { $tr } from "./i18n.ts";
import { platform } from "./process-info.ts";
import { getBun, getDeno } from "./utils.ts";
// 静态导入 Node.js 模块（Deno/Bun/Node 三端均可用，仅 Bun/Node 分支实际调用）
import { Buffer } from "node:buffer";
import * as nodeChildProcess from "node:child_process";
import { Readable, Writable } from "node:stream";

/**
 * 【Why】H4：子进程 output() 默认输出上限 10MB，防止恶意/失控子进程把 stdout/stderr
 * 撑爆内存导致 OOM。调用方可经 CommandOptions.maxOutputBytes 覆盖；0/负数禁用。
 */
const DEFAULT_OUTPUT_MAX_BYTES = 10 * 1024 * 1024;

/**
 * 杀掉指定 PID 的全部子进程树（递归）。
 *
 * Bun 下 `proc.kill(9)` 只杀父进程，esbuild 等子进程会变孤儿继续占用端口。
 * 此函数通过 `pkill -P` (Unix) 或 `taskkill /T` (Windows) 杀掉整棵进程树。
 *
 * @param pid 父进程 PID
 * @param signo 信号号（Unix 下传递给 pkill，默认 9 = SIGKILL）
 */
export function killProcessTree(pid: number, signo: number = 9): void {
  const plat = platform();
  if (plat === "windows") {
    // Windows: taskkill /T 杀整棵树
    try {
      nodeChildProcess.execFileSync("taskkill", [
        "/pid",
        String(pid),
        "/T",
        "/F",
      ], { stdio: "ignore" });
    } catch {
      // ignore - 进程可能已退出
    }
  } else {
    // Unix: 先递归杀子进程，再杀父进程
    try {
      const childPids = nodeChildProcess
        .execFileSync("pgrep", ["-P", String(pid)], { encoding: "utf-8" })
        .trim();
      if (childPids) {
        for (const childPidStr of childPids.split("\n")) {
          const childPid = parseInt(childPidStr.trim(), 10);
          if (childPid) killProcessTree(childPid, signo);
        }
      }
    } catch {
      // pgrep 失败 = 没有子进程，正常
    }
    try {
      process.kill(pid, signo);
    } catch {
      // ignore - 进程可能已退出
    }
  }
}

/**
 * 将 Bun FileSink（write/end 接口）包装为 Web Streams WritableStream，以兼容 getWriter()
 */
function toWritableStream(sink: {
  write(
    chunk: string | ArrayBufferView | ArrayBuffer,
  ): number | Promise<number>;
  end(error?: Error): number | Promise<number>;
}): WritableStream<Uint8Array> {
  return new WritableStream<Uint8Array>({
    write(chunk) {
      const result = sink.write(chunk);
      const p = result instanceof Promise ? result : Promise.resolve(result);
      return p.then(() => {});
    },
    close() {
      const result = sink.end();
      const p = result instanceof Promise ? result : Promise.resolve(result);
      return p.then(() => {});
    },
  });
}

/**
 * 将 CommandOptions 的 stdio 值映射为 Bun/Node 接受的格式。
 * Bun/Node 均不接受字符串 "null"，需转为 "ignore"；"piped" → "pipe"。
 *
 * 【Why 共用】Bun 与 Node 的 stdio 字面量约定一致（inherit/pipe/ignore），
 * 故抽公共映射，避免两处重复。
 */
function mapStdio(
  v: "inherit" | "piped" | "null" | undefined,
): "inherit" | "pipe" | "ignore" | undefined {
  if (v === "null") return "ignore";
  if (v === "piped") return "pipe";
  return v;
}

/**
 * Node Readable（node:stream）→ Web ReadableStream<Uint8Array>。
 * 使用 Node 17+ 的 Readable.toWeb；node:* 静态导入三端可用，运行时仅 Bun/Node 调用。
 *
 * 【Why 参数类型用 Readable 而非 NodeJS.ReadableStream】Deno 的 lib 将
 * `NodeJS.ReadableStream` 别名为全局 Web `ReadableStream`，与 Node 的 `Readable`
 * 类不兼容；而 node:child_process 的 proc.stdout 即 `Readable`，故直接用该类型。
 */
function nodeReadableToWeb(stream: Readable): ReadableStream<Uint8Array> {
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
}

/**
 * Node Writable（node:stream）→ Web WritableStream<Uint8Array>。
 */
function nodeWritableToWeb(stream: Writable): WritableStream<Uint8Array> {
  return Writable.toWeb(stream) as WritableStream<Uint8Array>;
}

/**
 * 收集 Node Readable 的全部数据为 Uint8Array。
 *
 * 【Why 不用 Readable.toWeb + Response】output() 路径下子进程「写完即退出」时，
 * proc.stdout 可能在 toWeb 包装后立即 end，undici 的 Response 构造会以
 * "disturbed or locked" 拒绝。改用 Node 原生 async iteration 最稳。
 * spawn() 的公开 stdout/stderr 仍走 toWeb（契约要求返回 Web Stream）。
 *
 * 【Why maxBytes】H4 防 OOM：累计字节超限时立即 destroy 流并抛
 * RuntimeAdapterError(OUTPUT_SIZE_EXCEEDED)，避免失控子进程撑爆内存。
 * 【Perf】用 Buffer.concat 零拷贝拼接（V8 直接合并底层 ArrayBuffer），替代手动 set 循环。
 *
 * @param stream Node Readable 流（proc.stdout/stderr）
 * @param maxBytes 单流字节上限；0/负数禁用（无限收集）
 */
async function collectNodeReadable(
  stream: Readable | null,
  maxBytes?: number,
): Promise<Uint8Array> {
  if (!stream) return new Uint8Array();
  const limit = maxBytes && maxBytes > 0 ? maxBytes : Infinity;
  // Buffer 是 Uint8Array 子类，Buffer.concat 直接产出 Buffer（零拷贝合并）
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    // Node 字节流 chunk 为 Buffer（继承 Uint8Array）；字符串则编码归一
    const buf: Buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(
      chunk instanceof Uint8Array
        ? chunk
        : new TextEncoder().encode(String(chunk)),
    );
    total += buf.length;
    // 超限：销毁流释放底层 fd，抛错让上层 Promise.all 中止
    if (total > limit) {
      stream.destroy();
      throw new RuntimeAdapterError(
        "OUTPUT_SIZE_EXCEEDED",
        $tr("error.outputSizeExceeded", { maxBytes: String(limit) }),
      );
    }
    chunks.push(buf);
  }
  if (total === 0) return new Uint8Array();
  // Buffer.concat 零拷贝合并所有 chunk；视图共享底层 ArrayBuffer
  return Buffer.concat(chunks, total);
}

/**
 * 命令执行选项
 */
export interface CommandOptions {
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  stdin?: "inherit" | "piped" | "null";
  stdout?: "inherit" | "piped" | "null";
  stderr?: "inherit" | "piped" | "null";
  /**
   * output() 收集 stdout/stderr 的单流字节上限（H4 防 OOM）。
   * 默认 10MB；超限销毁流并抛 RuntimeAdapterError(OUTPUT_SIZE_EXCEEDED)。
   * 0/负数禁用（无限收集）。
   */
  maxOutputBytes?: number;
}

/**
 * 命令执行结果
 */
export interface CommandOutput {
  code: number | null;
  success: boolean;
  stdout: Uint8Array;
  stderr: Uint8Array;
  signal: string | null;
}

/**
 * 已启动的子进程句柄
 *
 * 在 Deno 下，子进程默认会 ref 事件循环，导致父进程在 handler 返回后仍不退出。
 * 等待 status 后若不再需要子进程，应调用 unref()，以便父进程能正常退出。
 */
export interface SpawnedProcess {
  readonly stdin: WritableStream<Uint8Array> | null;
  readonly stdout: ReadableStream<Uint8Array> | null;
  readonly stderr: ReadableStream<Uint8Array> | null;
  readonly pid: number;
  /** 等待进程结束并返回状态（不读取 stdout/stderr） */
  readonly status: Promise<CommandOutput>;
  /** 终止进程（仅杀父进程，不杀子进程树） */
  kill(signo?: number): void;
  /**
   * 终止进程及其全部子进程树。
   *
   * Bun 下 `proc.kill(9)` 只杀父进程，esbuild 等子进程会变孤儿继续占用端口。
   * 此方法通过 `pkill -P` (Unix) 或 `taskkill /T` (Windows) 杀掉整棵进程树。
   */
  killTree(signo?: number): void;
  /**
   * 取消子进程对事件循环的引用，允许父进程在子进程已退出后正常退出。
   * Deno 和 Bun 下均应调用，防止测试运行器将子进程视为 "dangling process" 而误杀。
   */
  unref(): void;
}

/**
 * 命令对象（未启动）
 */
export interface CommandProcess {
  /** 启动进程并返回子进程句柄（适用于 inherit 模式的实时输出） */
  spawn(): SpawnedProcess;
  /** 执行命令并等待完成，返回输出（适用于 piped 模式） */
  output(): Promise<CommandOutput>;
}

/**
 * 创建命令对象（不立即启动进程）
 * @param command 命令名称
 * @param options 命令选项
 * @returns 命令对象，可通过 spawn() 启动或 output() 执行
 *
 * @example
 * ```typescript
 * // 方式1：实时输出模式（适用于 inherit）
 * const cmd = createCommand("deno", {
 *   args: ["test"],
 *   stdout: "inherit",
 *   stderr: "inherit",
 * });
 * const child = cmd.spawn();
 * const status = await child.status;
 * console.log(status.success);
 *
 * // 方式2：捕获输出模式（适用于 piped）
 * const cmd = createCommand("echo", {
 *   args: ["hello"],
 *   stdout: "piped",
 * });
 * const output = await cmd.output();
 * console.log(new TextDecoder().decode(output.stdout));
 * ```
 */
export function createCommand(
  command: string,
  options?: CommandOptions,
): CommandProcess {
  const deno = getDeno();
  if (deno) {
    const Command = deno.Command;

    return {
      // spawn() - 启动进程并返回子进程句柄（适用于 inherit 模式）
      spawn(): SpawnedProcess {
        const cmd = new Command(command, {
          args: options?.args,
          cwd: options?.cwd,
          env: options?.env,
          stdin: options?.stdin,
          stdout: options?.stdout,
          stderr: options?.stderr,
        });
        const child = cmd.spawn();

        return {
          get stdin() {
            return child.stdin;
          },
          get stdout() {
            return child.stdout;
          },
          get stderr() {
            return child.stderr;
          },
          get pid() {
            return child.pid;
          },
          // status 是一个 Promise，等待进程结束
          get status(): Promise<CommandOutput> {
            return child.status.then((s) => ({
              code: s.code,
              success: s.success,
              stdout: new Uint8Array(),
              stderr: new Uint8Array(),
              signal: s.signal,
            }));
          },
          kill(signo?: number) {
            child.kill(signo);
          },
          killTree(signo?: number) {
            killProcessTree(child.pid, signo ?? 9);
          },
          unref() {
            const c = child as unknown as { unref(): void };
            if (typeof c.unref === "function") c.unref();
          },
        };
      },

      // output() - 执行命令并返回输出（适用于 piped 模式）
      async output(): Promise<CommandOutput> {
        const cmd = new Command(command, {
          args: options?.args,
          cwd: options?.cwd,
          env: options?.env,
          stdin: options?.stdin,
          stdout: options?.stdout,
          stderr: options?.stderr,
        });
        const output = await cmd.output();
        // 【Why】H4：Deno cmd.output() 原生全量缓冲，后置长度检查防下游处理超大输出
        const maxBytes = options?.maxOutputBytes ?? DEFAULT_OUTPUT_MAX_BYTES;
        if (
          maxBytes > 0 &&
          (output.stdout.length > maxBytes || output.stderr.length > maxBytes)
        ) {
          throw new RuntimeAdapterError(
            "OUTPUT_SIZE_EXCEEDED",
            $tr("error.outputSizeExceeded", { maxBytes: String(maxBytes) }),
          );
        }
        return {
          code: output.code,
          success: output.success,
          stdout: output.stdout,
          stderr: output.stderr,
          signal: output.signal,
        };
      },
    };
  }

  const bun = getBun();
  if (bun) {
    return {
      // spawn() - 启动进程并返回子进程句柄
      spawn(): SpawnedProcess {
        const proc = bun.spawn([command, ...(options?.args || [])], {
          cwd: options?.cwd,
          env: options?.env,
          stdin: mapStdio(options?.stdin) as "inherit" | "pipe" | undefined,
          stdout: mapStdio(options?.stdout) as
            | "inherit"
            | "pipe"
            | undefined,
          stderr: mapStdio(options?.stderr) as
            | "inherit"
            | "pipe"
            | undefined,
        });

        return {
          get stdin() {
            const s = proc.stdin;
            if (!s) return null;
            // 若已是 Web Streams（有 getWriter），直接返回
            if (typeof (s as WritableStream).getWriter === "function") {
              return s as WritableStream<Uint8Array>;
            }
            // Bun FileSink 用 write/end，包装为 WritableStream
            return toWritableStream(
              s as unknown as {
                write(chunk: unknown): number | Promise<number>;
                end(error?: Error): number | Promise<number>;
              },
            );
          },
          get stdout() {
            return proc.stdout || null;
          },
          get stderr() {
            return proc.stderr || null;
          },
          get pid() {
            return proc.pid;
          },
          // status 是一个 Promise，等待进程结束
          get status(): Promise<CommandOutput> {
            return proc.exited.then((exitCode: number) => ({
              code: exitCode,
              success: exitCode === 0,
              stdout: new Uint8Array(),
              stderr: new Uint8Array(),
              signal: null,
            }));
          },
          kill(signo?: number) {
            proc.kill(signo);
          },
          killTree(signo?: number) {
            killProcessTree(proc.pid, signo ?? 9);
          },
          // Bun 下调用 unref() 防止测试运行器将子进程视为 "dangling process" 而误杀
          unref() {
            const p = proc as { unref?: () => void };
            if (typeof p.unref === "function") p.unref();
          },
        };
      },

      // output() - 执行命令并返回输出
      async output(): Promise<CommandOutput> {
        const proc = bun.spawn([command, ...(options?.args || [])], {
          cwd: options?.cwd,
          env: options?.env,
          stdin: mapStdio(options?.stdin) as "inherit" | "pipe" | undefined,
          stdout: mapStdio(options?.stdout) as
            | "inherit"
            | "pipe"
            | undefined,
          stderr: mapStdio(options?.stderr) as
            | "inherit"
            | "pipe"
            | undefined,
        });

        const exitCode = await proc.exited;
        // 【Why】H4：读 arrayBuffer 后判字节长度，超限抛 OUTPUT_SIZE_EXCEEDED 防 OOM
        // （Bun 已在 arrayBuffer 期间全量缓冲，此处为后置防御 + 错误信号）
        const maxBytes = options?.maxOutputBytes ?? DEFAULT_OUTPUT_MAX_BYTES;
        const stdout = proc.stdout
          ? new Uint8Array(await new Response(proc.stdout).arrayBuffer())
          : new Uint8Array();
        const stderr = proc.stderr
          ? new Uint8Array(await new Response(proc.stderr).arrayBuffer())
          : new Uint8Array();
        if (maxBytes > 0) {
          if (stdout.length > maxBytes || stderr.length > maxBytes) {
            throw new RuntimeAdapterError(
              "OUTPUT_SIZE_EXCEEDED",
              $tr("error.outputSizeExceeded", { maxBytes: String(maxBytes) }),
            );
          }
        }

        return {
          code: exitCode,
          success: exitCode === 0,
          stdout,
          stderr,
          signal: null,
        };
      },
    };
  }

  if (IS_NODE) {
    /** Node spawn 的 stdio 数组：undefined 归一为 "pipe"（Node 默认） */
    const nodeStdio = (
      v: "inherit" | "piped" | "null" | undefined,
    ): "inherit" | "pipe" | "ignore" => mapStdio(v) ?? "pipe";

    return {
      // spawn() - 启动进程并返回子进程句柄（Node 用 node:child_process.spawn）
      spawn(): SpawnedProcess {
        const proc = nodeChildProcess.spawn(
          command,
          options?.args ?? [],
          {
            cwd: options?.cwd,
            env: options?.env,
            stdio: [
              nodeStdio(options?.stdin),
              nodeStdio(options?.stdout),
              nodeStdio(options?.stderr),
            ],
          },
        );

        // 【Why 在 spawn 时立即挂 status】短命子进程可能在调用方 await child.status
        // 之前就 exit；若每次 getter 才 once("exit")，会错过事件并永久挂起。
        const statusPromise = new Promise<CommandOutput>((resolve, reject) => {
          const finish = (
            code: number | null,
            signal: NodeJS.Signals | null,
          ) => {
            resolve({
              code,
              success: code === 0,
              stdout: new Uint8Array(),
              stderr: new Uint8Array(),
              signal: signal ?? null,
            });
          };
          // 已退出（极快进程）：同步完成，避免丢事件
          if (proc.exitCode !== null || proc.signalCode !== null) {
            finish(proc.exitCode, proc.signalCode);
            return;
          }
          proc.once("error", reject);
          proc.once("exit", (code, signal) => finish(code, signal));
        });

        return {
          get stdin() {
            const s = proc.stdin;
            return s ? nodeWritableToWeb(s) : null;
          },
          get stdout() {
            const s = proc.stdout;
            return s ? nodeReadableToWeb(s) : null;
          },
          get stderr() {
            const s = proc.stderr;
            return s ? nodeReadableToWeb(s) : null;
          },
          get pid() {
            return proc.pid ?? 0;
          },
          get status(): Promise<CommandOutput> {
            return statusPromise;
          },
          kill(signo?: number) {
            proc.kill(signo ?? 9);
          },
          killTree(signo?: number) {
            if (proc.pid) killProcessTree(proc.pid, signo ?? 9);
          },
          unref() {
            proc.unref?.();
          },
        };
      },

      // output() - 执行命令并返回输出
      async output(): Promise<CommandOutput> {
        // output 默认不占 stdin 管道，避免子进程因未 close stdin 而挂起
        const proc = nodeChildProcess.spawn(
          command,
          options?.args ?? [],
          {
            cwd: options?.cwd,
            env: options?.env,
            stdio: [
              options?.stdin !== undefined
                ? nodeStdio(options.stdin)
                : "ignore",
              nodeStdio(options?.stdout),
              nodeStdio(options?.stderr),
            ],
          },
        );

        const exitPromise = new Promise<{
          code: number | null;
          signal: string | null;
        }>((resolve, reject) => {
          proc.once("error", reject);
          proc.once(
            "exit",
            (code, signal) => resolve({ code, signal: signal ?? null }),
          );
        });

        // 并发收集 stdout/stderr，避免大输出下管道缓冲背压死锁
        // 【Why】H4：传 maxOutputBytes 限制单流字节数，超限 collectNodeReadable 抛 OUTPUT_SIZE_EXCEEDED
        const maxBytes = options?.maxOutputBytes ?? DEFAULT_OUTPUT_MAX_BYTES;
        const [stdout, stderr] = await Promise.all([
          collectNodeReadable(proc.stdout, maxBytes),
          collectNodeReadable(proc.stderr, maxBytes),
        ]);

        const { code, signal } = await exitPromise;
        return {
          code,
          success: code === 0,
          stdout,
          stderr,
          signal,
        };
      },
    };
  }

  throw new Error($tr("error.unsupportedRuntime"));
}

/**
 * 同步执行命令并获取输出
 * @param command 命令名称
 * @param args 命令参数
 * @param options 命令选项
 * @returns 命令输出（字符串）
 * @throws 如果命令执行失败，抛出错误
 *
 * @example
 * ```typescript
 * import { execCommandSync } from "@dreamer/runtime-adapter";
 * try {
 *   const output = execCommandSync("echo", ["Hello"]);
 *   console.log(output); // "Hello"
 * } catch {
 *   console.log("命令执行失败");
 * }
 * ```
 */
export function execCommandSync(
  command: string,
  args: string[] = [],
  options?: { cwd?: string; env?: Record<string, string> },
): string {
  const deno = getDeno();
  if (deno) {
    // Deno 使用 Command.outputSync()
    const Command = deno.Command;
    const cmd = new Command(command, {
      args,
      cwd: options?.cwd,
      env: options?.env,
      stdout: "piped",
      stderr: "piped",
    });
    const output = cmd.outputSync();
    if (!output.success) {
      const errorMsg = new TextDecoder().decode(output.stderr);
      throw new Error(
        $tr("error.commandFailed", {
          command,
          args: args.join(" "),
          errorMsg,
        }),
      );
    }
    return new TextDecoder().decode(output.stdout);
  }

  if (IS_BUN || IS_NODE) {
    // Bun/Node 均支持 Node.js 兼容的 child_process，使用同步 API
    try {
      const result = nodeChildProcess.execFileSync(command, args, {
        cwd: options?.cwd,
        env: options?.env,
        encoding: "utf-8",
        stdio: "pipe",
      });
      return typeof result === "string" ? result : String(result);
    } catch (error: unknown) {
      // 若是运行时“同步 API 不可用”类错误则直接抛出（Bun 可能抛中英文，用 i18n 键检测）
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      const rethrow1En = $tr("error.bunRethrowSubstring1", undefined, "en-US");
      const rethrow1Zh = $tr("error.bunRethrowSubstring1", undefined, "zh-CN");
      const rethrow2En = $tr("error.bunRethrowSubstring2", undefined, "en-US");
      const rethrow2Zh = $tr("error.bunRethrowSubstring2", undefined, "zh-CN");
      if (
        errorMessage.includes(rethrow1En) ||
        errorMessage.includes(rethrow1Zh) ||
        errorMessage.includes(rethrow2En) ||
        errorMessage.includes(rethrow2Zh)
      ) {
        throw error;
      }
      // 否则是命令执行错误
      const stderr = (error as { stderr?: { toString(): string } })?.stderr
        ?.toString();
      const errorMsg = stderr || errorMessage;
      throw new Error(
        $tr("error.commandFailed", {
          command,
          args: args.join(" "),
          errorMsg,
        }),
      );
    }
  }

  throw new Error($tr("error.unsupportedRuntime"));
}
