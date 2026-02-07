/**
 * 进程/命令 API 适配模块
 * 提供统一的进程和命令执行接口，兼容 Deno 和 Bun
 */

import { IS_BUN } from "./detect.ts";
import { getBun, getDeno } from "./utils.ts";
// 静态导入 Node.js 模块（仅在 Bun 环境下使用）
import * as nodeChildProcess from "node:child_process";

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
 * 将 CommandOptions 的 stdio 值映射为 Bun 接受的格式
 * Bun 不接受字符串 "null"，需转为 null 或 "ignore"
 */
function mapBunStdio(
  v: "inherit" | "piped" | "null" | undefined,
): "inherit" | "pipe" | "ignore" | undefined {
  if (v === "null") return "ignore";
  if (v === "piped") return "pipe";
  return v;
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
 */
export interface SpawnedProcess {
  readonly stdin: WritableStream<Uint8Array> | null;
  readonly stdout: ReadableStream<Uint8Array> | null;
  readonly stderr: ReadableStream<Uint8Array> | null;
  readonly pid: number;
  /** 等待进程结束并返回状态（不读取 stdout/stderr） */
  readonly status: Promise<CommandOutput>;
  /** 终止进程 */
  kill(signo?: number): void;
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
          stdin: mapBunStdio(options?.stdin) as "inherit" | "pipe" | undefined,
          stdout: mapBunStdio(options?.stdout) as "inherit" | "pipe" | undefined,
          stderr: mapBunStdio(options?.stderr) as "inherit" | "pipe" | undefined,
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
        };
      },

      // output() - 执行命令并返回输出
      async output(): Promise<CommandOutput> {
        const proc = bun.spawn([command, ...(options?.args || [])], {
          cwd: options?.cwd,
          env: options?.env,
          stdin: mapBunStdio(options?.stdin) as "inherit" | "pipe" | undefined,
          stdout: mapBunStdio(options?.stdout) as "inherit" | "pipe" | undefined,
          stderr: mapBunStdio(options?.stderr) as "inherit" | "pipe" | undefined,
        });

        const exitCode = await proc.exited;
        const stdout = proc.stdout
          ? new Uint8Array(await new Response(proc.stdout).arrayBuffer())
          : new Uint8Array();
        const stderr = proc.stderr
          ? new Uint8Array(await new Response(proc.stderr).arrayBuffer())
          : new Uint8Array();

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

  throw new Error("不支持的运行时环境");
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
        `命令执行失败: ${command} ${args.join(" ")}\n${errorMsg}`,
      );
    }
    return new TextDecoder().decode(output.stdout);
  }

  if (IS_BUN) {
    // Bun 支持 Node.js 兼容的 child_process，使用同步 API
    try {
      const result = nodeChildProcess.execFileSync(command, args, {
        cwd: options?.cwd,
        env: options?.env,
        encoding: "utf-8",
        stdio: "pipe",
      });
      return typeof result === "string" ? result : String(result);
    } catch (error: unknown) {
      // 如果是我们抛出的错误，直接抛出
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      if (
        errorMessage.includes("require 不可用") ||
        errorMessage.includes("execFileSync 不可用")
      ) {
        throw error;
      }
      // 否则是命令执行错误
      const stderr = (error as { stderr?: { toString(): string } })?.stderr
        ?.toString();
      const errorMsg = stderr || errorMessage;
      throw new Error(
        `命令执行失败: ${command} ${args.join(" ")}\n${errorMsg}`,
      );
    }
  }

  throw new Error("不支持的运行时环境");
}
