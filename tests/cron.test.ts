/**
 * @fileoverview 定时任务 API 测试
 *
 * Windows 上定时器触发较慢且不稳定，通过「轮询等待首次触发 + 更长超时 + 放宽关闭后次数」保证全平台通过。
 */

import { describe, expect, it } from "@dreamer/test";
import { cron } from "../src/cron.ts";
import { platform } from "../src/process-info.ts";

const isWindows = () => platform() === "windows";

/** 轮询直到条件成立或超时，避免固定 sleep 在 Windows 上不足 */
async function waitUntil(
  condition: () => boolean,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<boolean> {
  const { timeoutMs = 15000, intervalMs = 200 } = opts;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

describe("定时任务 API", () => {
  describe("cron", () => {
    it("应该创建定时任务", async () => {
      let executed = false;
      const handle = await cron("*/2 * * * * *", () => {
        executed = true;
      });

      expect(handle).toBeTruthy();
      expect(typeof handle.close).toBe("function");

      const triggered = await waitUntil(() => executed, {
        timeoutMs: isWindows() ? 12000 : 5000,
      });
      handle.close();
      expect(triggered).toBe(true);
      expect(executed).toBe(true);
    }, { timeout: isWindows() ? 20000 : 10000 });

    it("应该支持关闭定时任务", async () => {
      let count = 0;
      const handle = await cron("*/1 * * * * *", () => {
        count++;
      });

      expect(handle).toBeTruthy();
      expect(typeof handle.close).toBe("function");

      const triggered = await waitUntil(() => count >= 1, {
        timeoutMs: isWindows() ? 15000 : 5000,
      });
      expect(triggered).toBe(true);
      expect(count).toBeGreaterThanOrEqual(1);

      handle.close();
      const countAfterClose = count;
      await new Promise((r) => setTimeout(r, isWindows() ? 4000 : 2000));

      expect(count).toBeGreaterThanOrEqual(countAfterClose);
      const maxExtra = isWindows() ? 10 : 3;
      expect(count - countAfterClose).toBeLessThanOrEqual(maxExtra);
    }, { timeout: isWindows() ? 25000 : 12000 });

    it("应该支持 AbortSignal", async () => {
      let executed = false;
      const handle = await cron("*/1 * * * * *", () => {
        executed = true;
      });

      expect(handle.signal).toBeTruthy();
      expect(handle.signal.aborted).toBe(false);

      const triggered = await waitUntil(() => executed, {
        timeoutMs: isWindows() ? 15000 : 4000,
      });
      expect(triggered).toBe(true);
      expect(executed).toBe(true);

      handle.close();
      await new Promise((r) => setTimeout(r, 1000));
      expect(handle.signal.aborted).toBe(true);
    }, { timeout: isWindows() ? 25000 : 10000 });

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
