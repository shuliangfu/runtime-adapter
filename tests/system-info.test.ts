/**
 * @fileoverview 系统信息 API 测试
 */

import { describe, expect, it } from "@dreamer/test";
import {
  getCpuUsage,
  getDiskUsage,
  getLoadAverage,
  getLoadAverageSync,
  getMemoryInfo,
  getMemoryInfoSync,
  getSystemInfo,
  getSystemInfoSync,
  getSystemStatus,
} from "../src/system-info.ts";

describe("系统信息 API", () => {
  describe("getMemoryInfo", () => {
    it("应该返回内存信息", async () => {
      const memory = await getMemoryInfo();
      expect(typeof memory.total).toBe("number");
      expect(typeof memory.available).toBe("number");
      expect(typeof memory.used).toBe("number");
      expect(typeof memory.free).toBe("number");
      expect(typeof memory.usagePercent).toBe("number");
      expect(memory.usagePercent).toBeGreaterThanOrEqual(0);
      expect(memory.usagePercent).toBeLessThanOrEqual(100);
    });

    it("应该返回有效的内存使用率", async () => {
      const memory = await getMemoryInfo();
      if (memory.total > 0) {
        expect(memory.used).toBeLessThanOrEqual(memory.total);
        expect(memory.available).toBeLessThanOrEqual(memory.total);
        expect(memory.free).toBeLessThanOrEqual(memory.total);
      }
    });
  });

  describe("getCpuUsage", () => {
    it("应该返回 CPU 使用率", async () => {
      const cpu = await getCpuUsage();
      expect(typeof cpu.usagePercent).toBe("number");
      expect(typeof cpu.userPercent).toBe("number");
      expect(typeof cpu.systemPercent).toBe("number");
      expect(cpu.usagePercent).toBeGreaterThanOrEqual(0);
      expect(cpu.usagePercent).toBeLessThanOrEqual(100);
      expect(cpu.userPercent).toBeGreaterThanOrEqual(0);
      expect(cpu.userPercent).toBeLessThanOrEqual(100);
      expect(cpu.systemPercent).toBeGreaterThanOrEqual(0);
      expect(cpu.systemPercent).toBeLessThanOrEqual(100);
    });

    it("应该支持自定义采样间隔", async () => {
      const cpu = await getCpuUsage(200);
      expect(typeof cpu.usagePercent).toBe("number");
    });
  });

  describe("getLoadAverage", () => {
    it("应该返回系统负载或 undefined", async () => {
      const load = await getLoadAverage();
      if (load) {
        expect(typeof load.load1).toBe("number");
        expect(typeof load.load5).toBe("number");
        expect(typeof load.load15).toBe("number");
        expect(load.load1).toBeGreaterThanOrEqual(0);
        expect(load.load5).toBeGreaterThanOrEqual(0);
        expect(load.load15).toBeGreaterThanOrEqual(0);
      }
      // Windows 上可能返回 undefined，这是正常的
    });
  });

  describe("getDiskUsage", () => {
    it("应该返回磁盘使用信息", async () => {
      const disk = await getDiskUsage(".");
      expect(typeof disk.total).toBe("number");
      expect(typeof disk.used).toBe("number");
      expect(typeof disk.available).toBe("number");
      expect(typeof disk.usagePercent).toBe("number");
      expect(disk.usagePercent).toBeGreaterThanOrEqual(0);
      expect(disk.usagePercent).toBeLessThanOrEqual(100);
    });

    it("应该支持自定义路径", async () => {
      const disk = await getDiskUsage("/");
      expect(typeof disk.total).toBe("number");
    });
  });

  describe("getSystemInfo", () => {
    it("应该返回系统信息", async () => {
      const info = await getSystemInfo();
      expect(typeof info.hostname).toBe("string");
      expect(typeof info.platform).toBe("string");
      expect(typeof info.arch).toBe("string");
      expect(typeof info.uptime).toBe("number");
      expect(info.uptime).toBeGreaterThanOrEqual(0);
      if (info.cpus !== undefined) {
        expect(typeof info.cpus).toBe("number");
        expect(info.cpus).toBeGreaterThan(0);
      }
    });

    it("应该返回有效的平台信息", async () => {
      const info = await getSystemInfo();
      expect(info.hostname).not.toBe("");
      expect(["linux", "darwin", "windows", "unknown"]).toContain(
        info.platform,
      );
    });
  });

  describe("getSystemStatus", () => {
    it("应该返回完整的系统状态", async () => {
      const status = await getSystemStatus();
      expect(status.system).toBeDefined();
      expect(status.memory).toBeDefined();
      expect(status.cpu).toBeDefined();
      expect(typeof status.system.hostname).toBe("string");
      expect(typeof status.memory.usagePercent).toBe("number");
      expect(typeof status.cpu.usagePercent).toBe("number");
    });

    it("应该支持自定义参数", async () => {
      const status = await getSystemStatus(200, "/");
      expect(status.system).toBeDefined();
      expect(status.memory).toBeDefined();
      expect(status.cpu).toBeDefined();
      if (status.disk) {
        expect(typeof status.disk.total).toBe("number");
      }
    });
  });

  describe("getMemoryInfoSync", () => {
    it("应该同步返回内存信息", () => {
      const memory = getMemoryInfoSync();
      expect(typeof memory.total).toBe("number");
      expect(typeof memory.available).toBe("number");
      expect(typeof memory.used).toBe("number");
      expect(typeof memory.free).toBe("number");
      expect(typeof memory.usagePercent).toBe("number");
      expect(memory.usagePercent).toBeGreaterThanOrEqual(0);
      expect(memory.usagePercent).toBeLessThanOrEqual(100);
    });

    it("应该返回有效的内存使用率", () => {
      const memory = getMemoryInfoSync();
      if (memory.total > 0) {
        expect(memory.used).toBeLessThanOrEqual(memory.total);
        expect(memory.available).toBeLessThanOrEqual(memory.total);
        expect(memory.free).toBeLessThanOrEqual(memory.total);
      }
    });
  });

  describe("getLoadAverageSync", () => {
    it("应该同步返回系统负载或 undefined", () => {
      const load = getLoadAverageSync();
      if (load) {
        expect(typeof load.load1).toBe("number");
        expect(typeof load.load5).toBe("number");
        expect(typeof load.load15).toBe("number");
        expect(load.load1).toBeGreaterThanOrEqual(0);
        expect(load.load5).toBeGreaterThanOrEqual(0);
        expect(load.load15).toBeGreaterThanOrEqual(0);
      }
      // Windows 上可能返回 undefined，这是正常的
    });
  });

  describe("getSystemInfoSync", () => {
    it("应该同步返回系统信息", () => {
      const info = getSystemInfoSync();
      expect(typeof info.hostname).toBe("string");
      expect(typeof info.platform).toBe("string");
      expect(typeof info.arch).toBe("string");
      expect(typeof info.uptime).toBe("number");
      expect(info.uptime).toBeGreaterThanOrEqual(0);
      if (info.cpus !== undefined) {
        expect(typeof info.cpus).toBe("number");
        expect(info.cpus).toBeGreaterThan(0);
      }
    });

    it("应该返回有效的平台信息", () => {
      const info = getSystemInfoSync();
      expect(info.hostname).not.toBe("");
      expect(["linux", "darwin", "windows", "unknown"]).toContain(
        info.platform,
      );
    });
  });
});
