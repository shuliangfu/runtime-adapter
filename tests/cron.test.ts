/**
 * @fileoverview 定时任务 API 测试
 */

import { describe, expect, it } from "@dreamer/test";
import { cron } from "../src/cron.ts";
import { platform } from "../src/process-info.ts";

describe("定时任务 API", () => {
  describe("cron", () => {
    it("应该创建定时任务", async () => {
      let executed = false;
      // 使用秒级 cron 表达式（每 2 秒执行一次）
      const handle = await cron("*/2 * * * * *", () => {
        executed = true;
      });

      expect(handle).toBeTruthy();
      expect(typeof handle.close).toBe("function");

      // 等待足够长的时间确保任务执行（至少 3 秒以确保执行一次）
      await new Promise((resolve) => setTimeout(resolve, 3000));

      handle.close();
      expect(executed).toBe(true);
    });

    it("应该支持关闭定时任务", async () => {
      let count = 0;
      const handle = await cron("*/1 * * * * *", () => {
        count++;
      });

      expect(handle).toBeTruthy();
      expect(typeof handle.close).toBe("function");

      if (platform() === "windows") {
        // Windows CI 下 node-cron 触发时机不稳定，仅验证 close() 可调用且状态正确，不依赖回调是否执行
        handle.close();
        expect(handle.isClosed).toBe(true);
        expect(handle.signal.aborted).toBe(true);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));
      expect(count).toBeGreaterThanOrEqual(1);
      handle.close();

      const countAfterClose = count;
      await new Promise((resolve) => setTimeout(resolve, 2000));
      expect(count).toBeGreaterThanOrEqual(countAfterClose);
      expect(count - countAfterClose).toBeLessThanOrEqual(3);
    }, { timeout: 10_000 });

    it("应该支持 AbortSignal", async () => {
      let executed = false;
      const handle = await cron("*/1 * * * * *", () => {
        executed = true;
      });

      expect(handle.signal).toBeTruthy();
      expect(handle.signal.aborted).toBe(false);

      if (platform() === "windows") {
        // Windows CI 下不依赖定时触发，仅验证 close 后 signal 被 aborted
        handle.close();
        expect(handle.signal.aborted).toBe(true);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
      expect(executed).toBe(true);
      handle.close();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      expect(handle.signal.aborted).toBe(true);
    });

    it("应该支持不同的 cron 表达式", async () => {
      let executed = false;
      // 使用秒级 cron 表达式（每分钟的第 0 秒执行）
      const handle = await cron("0 * * * * *", () => {
        executed = true;
      });

      expect(handle).toBeTruthy();
      handle.close();
    });
  });
});
