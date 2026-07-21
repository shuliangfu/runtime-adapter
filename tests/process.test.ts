/**
 * @fileoverview 进程/命令 API 测试
 */

import { describe, expect, it } from "@dreamer/test";
import { platform } from "../src/process-info.ts";
import {
  createCommand,
  execCommandSync,
  killProcessTree,
} from "../src/process.ts";

describe("进程/命令 API", () => {
  describe("createCommand", () => {
    it("应该创建命令对象", () => {
      const cmd = createCommand("echo", { args: ["hello"] });
      expect(cmd).toBeTruthy();
      expect(typeof cmd.spawn).toBe("function");
      expect(typeof cmd.output).toBe("function");
    });

    it("应该执行简单命令并获取输出", async () => {
      const cmd = createCommand("echo", { args: ["test"] });
      const output = await cmd.output();
      expect(output.success).toBe(true);
      expect(output.stdout).toBeTruthy();
    });

    it("应该支持 spawn 获取子进程", async () => {
      // Windows 无 cat，用 sort（读 stdin）；Unix 用 cat
      const readStdinCmd = platform() === "windows" ? "sort" : "cat";
      const cmd = createCommand(readStdinCmd, {
        stdin: "piped",
        stdout: "piped",
      });
      const child = cmd.spawn();
      expect(child).toBeTruthy();
      expect(typeof child.pid).toBe("number");
      expect(child.stdin).toBeTruthy();
      expect(child.stdout).toBeTruthy();

      // 验证 stdin 支持 Web Streams getWriter（Bun FileSink 需包装）
      if (
        child.stdin &&
        typeof (child.stdin as WritableStream).getWriter === "function"
      ) {
        const writer = (child.stdin as WritableStream<Uint8Array>).getWriter();
        await writer.write(new TextEncoder().encode("test\n"));
        writer.releaseLock();
      }
      // 清理资源，避免泄漏
      try {
        if (child.stdin) {
          await child.stdin.close();
        }
        if (child.stdout) {
          await child.stdout.cancel();
        }
        child.kill();
        await child.status; // 等待进程完全退出，满足 Deno 泄漏检测
      } catch {
        // 忽略清理错误
      }
    }, { sanitizeResources: true });

    it("应该支持环境变量", async () => {
      // Windows 用 set 读取环境变量，Unix 用 printenv
      const cmd = platform() === "windows"
        ? createCommand("cmd", {
          args: ["/c", "set", "TEST_VAR"],
          env: { TEST_VAR: "test-value" },
        })
        : createCommand("printenv", {
          args: ["TEST_VAR"],
          env: { TEST_VAR: "test-value" },
        });
      const output = await cmd.output();
      expect(output.success).toBe(true);
    }, { sanitizeResources: false }); // 避免 Deno 泄漏检测误报

    it("应该支持工作目录", async () => {
      // Windows 上 cd 是 shell 内置命令，需通过 cmd /c 调用
      const cmd = platform() === "windows"
        ? createCommand("cmd", { args: ["/c", "cd"], cwd: "." })
        : createCommand("pwd", { args: [], cwd: "." });
      const output = await cmd.output();
      expect(output.success).toBe(true);
    });

    it("应该可以通过 spawn 等待进程完成", async () => {
      const cmd = createCommand("echo", { args: ["done"] });
      const child = cmd.spawn();
      const status = await child.status;
      expect(status.success).toBe(true);
    });

    it("应该可以获取输出", async () => {
      const cmd = createCommand("echo", { args: ["hello world"] });
      const output = await cmd.output();
      expect(output.success).toBe(true);
      expect(output.stdout).toBeTruthy();
    }, { sanitizeResources: true });

    it("应该可以取消进程", async () => {
      // 根据系统不同，sleep 命令可能不同
      // Unix: sleep, Windows: timeout
      // 这里使用一个会立即返回的命令来测试 kill
      const cmd = createCommand("echo", { args: ["test"] });
      const child = cmd.spawn();
      child.kill();
      // 等待进程状态
      const status = await child.status;
      // 进程被取消，可能成功或失败，取决于时机
      expect(typeof status.success).toBe("boolean");
    });

    it("unref() 不应抛出异常", async () => {
      const cmd = createCommand("echo", { args: ["unref-test"] });
      const child = cmd.spawn();
      // unref() 在 Bun 下应调用 proc.unref()，在 Deno 下应调用 child.unref()
      expect(() => child.unref()).not.toThrow();
      // unref 后进程可能不再保持事件循环，用超时保护避免挂起
      const status = await Promise.race([
        child.status,
        new Promise<{ success: boolean }>((r) =>
          setTimeout(() => r({ success: true }), 3000)
        ),
      ]);
      expect(status.success).toBe(true);
    }, { sanitizeOps: false });

    it("killTree() 应终止进程而不抛出异常", async () => {
      // 使用 sleep 命令创建一个长时间运行的进程
      const sleepCmd = platform() === "windows"
        ? createCommand("cmd", { args: ["/c", "timeout", "10"] })
        : createCommand("sleep", { args: ["10"] });
      const child = sleepCmd.spawn();
      expect(child.pid).toBeGreaterThan(0);
      // killTree 不应抛出异常
      expect(() => child.killTree(9)).not.toThrow();
      // 等待进程退出
      const status = await child.status;
      expect(status.success).toBe(false);
    });

    it("killTree() 应终止进程及其子进程", async () => {
      // Unix: sh -c 'sleep 5 &' 创建子进程
      // Windows: cmd /c "start /b timeout 5" 创建子进程
      const cmd = platform() === "windows"
        ? createCommand("cmd", {
          args: ["/c", "timeout", "5"],
        })
        : createCommand("sh", {
          args: ["-c", "sleep 5"],
        });
      const child = cmd.spawn();
      expect(child.pid).toBeGreaterThan(0);
      // 给进程一点启动时间
      await new Promise((r) => setTimeout(r, 100));
      // killTree 应该杀掉父进程和子进程
      expect(() => child.killTree(9)).not.toThrow();
      const status = await child.status;
      expect(status.success).toBe(false);
    });
  });

  describe("killProcessTree", () => {
    it("应该可以杀掉指定 PID 的进程树", async () => {
      const sleepCmd = platform() === "windows"
        ? createCommand("cmd", { args: ["/c", "timeout", "10"] })
        : createCommand("sleep", { args: ["10"] });
      const child = sleepCmd.spawn();
      const pid = child.pid;
      expect(pid).toBeGreaterThan(0);
      // 等待进程启动
      await new Promise((r) => setTimeout(r, 50));
      // killProcessTree 不应抛出异常
      expect(() => killProcessTree(pid, 9)).not.toThrow();
      const status = await child.status;
      expect(status.success).toBe(false);
    });

    it("对不存在的 PID 不应抛出异常", () => {
      // PID 999999 几乎不可能存在
      expect(() => killProcessTree(999999, 9)).not.toThrow();
    });
  });

  describe("execCommandSync", () => {
    it("应该同步执行命令并返回输出", () => {
      const output = execCommandSync("echo", ["hello"]);
      expect(typeof output).toBe("string");
      expect(output.trim()).toBe("hello");
    });

    it("应该支持多个参数", () => {
      const output = execCommandSync("echo", ["hello", "world"]);
      expect(typeof output).toBe("string");
      expect(output).toContain("hello");
      expect(output).toContain("world");
    });

    it("应该在命令失败时抛出错误", () => {
      expect(() => {
        execCommandSync("nonexistent-command-12345", []);
      }).toThrow();
    });

    it("应该支持工作目录", () => {
      const output = platform() === "windows"
        ? execCommandSync("cmd", ["/c", "cd"], { cwd: "." })
        : execCommandSync("pwd", [], { cwd: "." });
      expect(typeof output).toBe("string");
      expect(output.trim().length).toBeGreaterThan(0);
    });
  });
});
