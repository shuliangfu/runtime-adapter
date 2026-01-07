/**
 * @fileoverview 终端 API 测试
 */

import { describe, expect, it } from "@dreamer/test";
import {
  getStderr,
  getStdout,
  isStderrTerminal,
  isTerminal,
} from "../src/terminal.ts";

describe("终端 API", () => {
  describe("isTerminal", () => {
    it("应该返回布尔值", () => {
      const result = isTerminal();
      expect(typeof result).toBe("boolean");
    });
  });

  describe("isStderrTerminal", () => {
    it("应该返回布尔值", () => {
      const result = isStderrTerminal();
      expect(typeof result).toBe("boolean");
    });
  });

  describe("getStdout", () => {
    it("应该返回 WritableStream", () => {
      const stdout = getStdout();
      expect(stdout).toBeInstanceOf(WritableStream);
    });

    it("应该可以写入数据", async () => {
      const stdout = getStdout();
      const writer = stdout.getWriter();
      await writer.write(new TextEncoder().encode("test"));
      writer.releaseLock();
    });
  });

  describe("getStderr", () => {
    it("应该返回 WritableStream", () => {
      const stderr = getStderr();
      expect(stderr).toBeInstanceOf(WritableStream);
    });

    it("应该可以写入数据", async () => {
      const stderr = getStderr();
      const writer = stderr.getWriter();
      await writer.write(new TextEncoder().encode("test"));
      writer.releaseLock();
    });
  });
});
