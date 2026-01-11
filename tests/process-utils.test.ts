/**
 * @fileoverview 进程工具 API 测试
 */

import { describe, expect, it } from "@dreamer/test";
import { args, exit } from "../src/process-utils.ts";

describe("进程工具 API", () => {
  describe("args", () => {
    it("应该返回命令行参数数组", () => {
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
