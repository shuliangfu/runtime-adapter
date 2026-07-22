/**
 * Node 平台系统信息 API 冒烟测试（Phase A6）
 *
 * 验证 system-info.ts 的 Node 分支：getSystemInfo/getMemoryInfo/getLoadAverage 等。
 * 仅在 Node 上生效：describe 内 `if (!IS_NODE) return` 早返回。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { IS_NODE } from "../../src/detect.ts";
import {
  getCpuUsage,
  getLoadAverage,
  getMemoryInfo,
  getMemoryInfoSync,
  getSystemInfo,
  getSystemInfoSync,
} from "../../src/system-info.ts";

describe("Node 系统信息 API 冒烟", () => {
  if (!IS_NODE) return;

  it("getSystemInfo 应返回有效的主机名/平台/架构", async () => {
    const info = await getSystemInfo();
    assert.ok(
      info.hostname && info.hostname !== "unknown",
      `hostname=${info.hostname}`,
    );
    assert.ok(
      info.platform && info.platform !== "unknown",
      `platform=${info.platform}`,
    );
    assert.ok(info.arch && info.arch !== "unknown", `arch=${info.arch}`);
    assert.ok(typeof info.uptime === "number" && info.uptime >= 0);
    // cpus 可选，但有应 > 0
    if (info.cpus !== undefined) {
      assert.ok(info.cpus > 0, `cpus=${info.cpus}`);
    }
  });

  it("getSystemInfoSync 应同步返回系统信息", () => {
    const info = getSystemInfoSync();
    assert.ok(info.hostname && info.hostname !== "unknown");
    assert.ok(info.platform && info.platform !== "unknown");
  });

  it("getMemoryInfo 应返回 total>0", async () => {
    const mem = await getMemoryInfo();
    assert.ok(typeof mem.total === "number");
    assert.ok(mem.total > 0, `total=${mem.total}`);
    assert.ok(mem.usagePercent >= 0 && mem.usagePercent <= 100);
  });

  it("getMemoryInfoSync 应同步返回内存信息", () => {
    const mem = getMemoryInfoSync();
    assert.ok(typeof mem.total === "number");
    assert.ok(mem.total > 0, `total=${mem.total}`);
  });

  it("getCpuUsage 应返回 0-100 的使用率", async () => {
    const cpu = await getCpuUsage(50);
    assert.ok(cpu.usagePercent >= 0 && cpu.usagePercent <= 100);
    assert.ok(cpu.userPercent >= 0 && cpu.userPercent <= 100);
    assert.ok(cpu.systemPercent >= 0 && cpu.systemPercent <= 100);
  });

  it("getLoadAverage 不应抛出（Windows 返回 undefined 可接受）", async () => {
    const load = await getLoadAverage();
    if (load !== undefined) {
      assert.ok(typeof load.load1 === "number");
      assert.ok(typeof load.load5 === "number");
      assert.ok(typeof load.load15 === "number");
    }
  });
});
