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
  if (IS_DENO) {
    // Deno 使用 Command.outputSync()
    const cmd = new (globalThis as any).Deno.Command(command, {
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
      // Bun 中可以直接使用 require（在全局作用域中可用）
      const childProcess = (typeof require !== "undefined" && require) ||
        (globalThis as any).require;

      if (!childProcess) {
        throw new Error("Bun 环境中 require 不可用");
      }

      const cp = childProcess("child_process");
      if (cp && typeof cp.execFileSync === "function") {
        const result = cp.execFileSync(command, args, {
          cwd: options?.cwd,
          env: options?.env,
          encoding: "utf-8",
          stdio: "pipe",
        });
        return typeof result === "string" ? result : result.toString();
      }
      throw new Error("Bun 环境中 child_process.execFileSync 不可用");
    } catch (error: any) {
      // 如果是我们抛出的错误，直接抛出
      if (
        error.message && (
          error.message.includes("require 不可用") ||
          error.message.includes("execFileSync 不可用")
        )
      ) {
        throw error;
      }
      // 否则是命令执行错误
      const errorMsg = error?.stderr?.toString() || error?.message ||
        String(error);
      throw new Error(
        `命令执行失败: ${command} ${args.join(" ")}\n${errorMsg}`,
      );
    }
  }

  throw new Error("不支持的运行时环境");
}
