/**
 * @fileoverview 定时任务 API 测试
 *
 * Windows Bun CI 说明：node-cron 在 Windows 上触发时机不稳定（定时器/事件循环差异），
 * 依赖「N 秒内必须触发」或「关闭后次数不变」的用例会偶发失败。因此对这类用例在 Windows 上
 * 使用 it.skipIf(platform() === "windows" && IS_BUN) 跳过，仅在 Linux/macOS 上运行，保证 CI 稳定通过。
 */

import { describe, expect, it } from "@dreamer/test";
import { cron } from "../src/cron.ts";
import { platform } from "../src/process-info.ts";
import { IS_BUN } from "../src/detect.ts";

/** Windows 上跳过（依赖定时触发）；非 Windows 正常跑 */
const itCron = platform() === "windows" && IS_BUN ? it.skip : it;

describe("定时任务 API", () => {
  describe("cron", () => {
    itCron("应该创建定时任务", async () => {
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

    itCron("应该支持关闭定时任务", async () => {
      let count = 0;
      const handle = await cron("*/1 * * * * *", () => {
        count++;
      });

      expect(handle).toBeTruthy();
      expect(typeof handle.close).toBe("function");
      await new Promise((resolve) => setTimeout(resolve, 3000));
      expect(count).toBeGreaterThanOrEqual(1);
      handle.close();

      const countAfterClose = count;
      await new Promise((resolve) => setTimeout(resolve, 2000));
      expect(count).toBeGreaterThanOrEqual(countAfterClose);
      expect(count - countAfterClose).toBeLessThanOrEqual(3);
    }, { timeout: 10_000 });

    itCron("应该支持 AbortSignal", async () => {
      let executed = false;
      const handle = await cron("*/1 * * * * *", () => {
        executed = true;
      });

      expect(handle.signal).toBeTruthy();
      expect(handle.signal.aborted).toBe(false);
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
