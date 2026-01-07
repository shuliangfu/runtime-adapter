/**
 * 进程/命令 API 适配模块
 * 提供统一的进程和命令执行接口，兼容 Deno 和 Bun
 */

import { IS_BUN, IS_DENO } from "./detect.ts";

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
 * 命令进程句柄
 */
export interface CommandProcess {
  readonly stdin: WritableStream<Uint8Array> | null;
  readonly stdout: ReadableStream<Uint8Array> | null;
  readonly stderr: ReadableStream<Uint8Array> | null;
  readonly pid: number;
  status(): Promise<CommandOutput>;
  output(): Promise<CommandOutput>;
  kill(signo?: number): void;
  spawn(): CommandProcess;
  abort(): void;
}

/**
 * 创建命令对象
 * @param command 命令名称
 * @param options 命令选项
 * @returns 命令对象
 */
export function createCommand(
  command: string,
  options?: CommandOptions,
): CommandProcess {
  if (IS_DENO) {
    const cmd = new (globalThis as any).Deno.Command(command, {
      args: options?.args,
      cwd: options?.cwd,
      env: options?.env,
      stdin: options?.stdin,
      stdout: options?.stdout,
      stderr: options?.stderr,
    });

    // 创建子进程
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
      async status() {
        const status = await child.status;
        return {
          code: status.code,
          success: status.success,
          stdout: new Uint8Array(),
          stderr: new Uint8Array(),
          signal: status.signal,
        };
      },
      async output() {
        const output = await cmd.output();
        return {
          code: output.code,
          success: output.success,
          stdout: output.stdout,
          stderr: output.stderr,
          signal: output.signal,
        };
      },
      kill(signo?: number) {
        child.kill(signo);
      },
      spawn() {
        return createCommand(command, options);
      },
      abort() {
        child.kill();
      },
    };
  }

  if (IS_BUN) {
    // Bun 使用 Bun.spawn
    const proc = (globalThis as any).Bun.spawn([
      command,
      ...(options?.args || []),
    ], {
      cwd: options?.cwd,
      env: options?.env,
      stdin: options?.stdin === "piped" ? "pipe" : options?.stdin,
      stdout: options?.stdout === "piped" ? "pipe" : options?.stdout,
      stderr: options?.stderr === "piped" ? "pipe" : options?.stderr,
    });

    return {
      get stdin() {
        return proc.stdin || null;
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
      async status() {
        const exitCode = await proc.exited;
        return {
          code: exitCode,
          success: exitCode === 0,
          stdout: new Uint8Array(),
          stderr: new Uint8Array(),
          signal: null,
        };
      },
      async output() {
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
      kill(signo?: number) {
        proc.kill(signo);
      },
      spawn() {
        return createCommand(command, options);
      },
      abort() {
        proc.kill();
      },
    };
  }

  throw new Error("不支持的运行时环境");
}
