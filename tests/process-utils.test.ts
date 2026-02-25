/**
 * @fileoverview 进程工具 API 测试
 *
 * args() 的 Bun.argv 优先、slice(2) 及 Windows 下 --build 传递等行为，
 * 由 dweb 的 integration 构建测试与 CI (test-windows-bun) 覆盖。
 */

import { describe, expect, it } from "@dreamer/test";
import { IS_BUN } from "../src/detect.ts";
import { args, exit } from "../src/process-utils.ts";

describe("进程工具 API", () => {
  describe("args", () => {
    it("应返回命令行参数数组", () => {
      const arguments_ = args();
      expect(Array.isArray(arguments_)).toBe(true);
    });

    it("多次调用应返回一致且不抛错", () => {
      const a = args();
      const b = args();
      expect(Array.isArray(a)).toBe(true);
      expect(Array.isArray(b)).toBe(true);
      expect(a).toEqual(b);
    });

    it("Bun 下应返回数组且不抛错（Bun.argv 优先逻辑由 dweb CI Windows Bun 覆盖）", () => {
      if (!IS_BUN) return;
      const arguments_ = args();
      expect(Array.isArray(arguments_)).toBe(true);
    });
  });

  describe("exit", () => {
    it("应该退出程序（无法直接测试，但函数应该存在）", () => {
      expect(typeof exit).toBe("function");
      // 注意：exit 函数会终止程序，无法直接测试
    });
  });
});
