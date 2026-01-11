/**
 * @fileoverview 进程信息 API 测试
 */

import { describe, expect, it } from "@dreamer/test";
import { arch, pid, platform, version } from "../src/process-info.ts";

describe("进程信息 API", () => {
  describe("pid", () => {
    it("应该返回进程 ID", () => {
      const processId = pid();
      expect(typeof processId).toBe("number");
      expect(processId).toBeGreaterThan(0);
    });
  });

  describe("platform", () => {
    it("应该返回平台类型", () => {
      const plat = platform();
      expect(["linux", "darwin", "windows", "unknown"]).toContain(plat);
    });
  });

  describe("arch", () => {
    it("应该返回 CPU 架构", () => {
      const architecture = arch();
      expect(["x86_64", "aarch64", "arm64", "unknown"]).toContain(architecture);
    });
  });

  describe("version", () => {
    it("应该返回运行时版本信息", () => {
      const ver = version();
      expect(typeof ver).toBe("object");
      expect(ver.runtime).toMatch(/^(deno|bun)$/);
      expect(typeof ver.version).toBe("string");
      expect(ver.version).not.toBe("");
    });
  });
});
