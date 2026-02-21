/**
 * @fileoverview 定时任务 API 测试
 */

import { describe, expect, it } from "@dreamer/test";
import { cron } from "../src/cron.ts";

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
      // 使用秒级 cron 表达式（每 1 秒执行一次）
      const handle = await cron("*/1 * * * * *", () => {
        count++;
      });

      // 等待执行几次（缩短等待时间，避免超时）
      await new Promise((resolve) => setTimeout(resolve, 2000));

      handle.close();

      // 关闭后再等待，计数不应再明显增加（Windows/Bun 下 node-cron 可能在 stop 前已调度一次，允许最多多 1 次）
      const countAfterClose = count;
      await new Promise((resolve) => setTimeout(resolve, 2000));
      expect(count).toBeGreaterThanOrEqual(countAfterClose);
      expect(count - countAfterClose).toBeLessThanOrEqual(1);
    }, { timeout: 10000 }); // 设置测试超时时间为 10 秒

    it("应该支持 AbortSignal", async () => {
      let executed = false;

      // 不需要在外面创建 AbortController，handle 会返回 signal
      // 使用秒级 cron 表达式（每 1 秒执行一次）
      const handle = await cron(
        "*/1 * * * * *",
        () => {
          executed = true;
        },
      );

      // 等待足够长的时间确保任务执行（至少 2 秒以确保执行一次）
      await new Promise((resolve) => setTimeout(resolve, 2000));
      expect(executed).toBe(true);

      // 通过 handle.signal 访问 signal，然后使用 close() 来取消
      // 或者可以直接调用 handle.close()
      expect(handle.signal).toBeTruthy();
      expect(handle.signal.aborted).toBe(false);

      // 取消任务
      handle.close();

      // 等待一段时间，检查 signal 是否已取消
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
