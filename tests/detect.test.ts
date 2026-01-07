/**
 * @fileoverview 运行时检测模块测试
 */

import { describe, expect, it } from "@dreamer/test";
import {
  detectRuntime,
  IS_BUN,
  IS_DENO,
  RUNTIME,
  type Runtime,
} from "../src/detect.ts";

describe("运行时检测", () => {
  describe("detectRuntime", () => {
    it("应该返回有效的运行时类型", () => {
      const runtime = detectRuntime();
      expect(["deno", "bun", "unknown"]).toContain(runtime);
    });

    it("应该返回 Runtime 类型", () => {
      const runtime: Runtime = detectRuntime();
      expect(typeof runtime).toBe("string");
    });
  });

  describe("RUNTIME", () => {
    it("应该是有效的运行时值", () => {
      expect(["deno", "bun"]).toContain(RUNTIME);
    });

    it("应该是 Runtime 类型", () => {
      const runtime: Runtime = RUNTIME;
      expect(typeof runtime).toBe("string");
    });
  });

  describe("IS_DENO", () => {
    it("应该是布尔值", () => {
      expect(typeof IS_DENO).toBe("boolean");
    });
  });

  describe("IS_BUN", () => {
    it("应该是布尔值", () => {
      expect(typeof IS_BUN).toBe("boolean");
    });
  });

  describe("运行时环境检查", () => {
    it("应该在 Deno 或 Bun 环境下正常运行", () => {
      // 如果代码能执行到这里，说明运行时检查通过了
      expect(IS_DENO || IS_BUN).toBe(true);
    });
  });
});
