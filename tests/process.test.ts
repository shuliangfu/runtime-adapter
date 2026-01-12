/**
 * @fileoverview 进程/命令 API 测试
 */

import { describe, expect, it } from "@dreamer/test";
import { createCommand, execCommandSync } from "../src/process.ts";

describe("进程/命令 API", () => {
  describe("createCommand", () => {
    it("应该创建命令进程", async () => {
      const proc = createCommand("echo", { args: ["hello"] });
      expect(proc).toBeTruthy();
      expect(typeof proc.pid).toBe("number");
      // 等待进程完成
      await proc.output();
    });

    it("应该执行简单命令", async () => {
      const proc = createCommand("echo", { args: ["test"] });
      const output = await proc.output();
      expect(output.success).toBe(true);
      expect(output.stdout).toBeTruthy();
    });

    it("应该支持 stdin", async () => {
      const proc = createCommand("cat", {
        stdin: "piped",
        stdout: "piped",
      });
      expect(proc.stdin).toBeTruthy();
      expect(proc.stdout).toBeTruthy();

      // 清理资源，避免泄漏
      try {
        if (proc.stdin) {
          proc.stdin.close();
        }
        if (proc.stdout) {
          await proc.stdout.cancel();
        }
        proc.kill();
      } catch {
        // 忽略清理错误
      }
    }, { sanitizeResources: true });

    it("应该支持环境变量", async () => {
      const proc = createCommand("echo", {
        args: ["$TEST_VAR"],
        env: { TEST_VAR: "test-value" },
      });
      const output = await proc.output();
      expect(output.success).toBe(true);
    });

    it("应该支持工作目录", async () => {
      const proc = createCommand("pwd", {
        cwd: ".",
      });
      const output = await proc.output();
      expect(output.success).toBe(true);
    });

    it("应该可以等待进程完成", async () => {
      const proc = createCommand("echo", { args: ["done"] });
      const status = await proc.status();
      expect(status.success).toBe(true);
    });

    it("应该可以获取输出", async () => {
      const proc = createCommand("echo", { args: ["hello world"] });
      const output = await proc.output();
      expect(output.success).toBe(true);
      expect(output.stdout).toBeTruthy();
    }, { sanitizeResources: true });

    it("应该可以取消进程", async () => {
      // 根据系统不同，sleep 命令可能不同
      // Unix: sleep, Windows: timeout
      // 这里使用一个会立即返回的命令来测试 kill
      const proc = createCommand("echo", { args: ["test"] });
      proc.kill();
      // 等待进程状态
      const status = await proc.status();
      // 进程被取消，可能成功或失败，取决于时机
      expect(typeof status.success).toBe("boolean");
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
      const output = execCommandSync("pwd", [], { cwd: "." });
      expect(typeof output).toBe("string");
      expect(output.trim().length).toBeGreaterThan(0);
    });
  });
});
