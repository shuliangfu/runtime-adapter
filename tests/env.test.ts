/**
 * @fileoverview 环境变量 API 测试
 */

import { afterAll, describe, expect, it } from "@dreamer/test";
import { deleteEnv, getEnv, getEnvAll, hasEnv, setEnv } from "../src/env.ts";

describe("环境变量 API", () => {
  const TEST_KEY = "TEST_RUNTIME_ADAPTER_ENV";
  const TEST_VALUE = "test-value-123";

  describe("setEnv", () => {
    it("应该设置环境变量", () => {
      setEnv(TEST_KEY, TEST_VALUE);
      expect(getEnv(TEST_KEY)).toBe(TEST_VALUE);
    });
  });

  describe("getEnv", () => {
    it("应该获取已设置的环境变量", () => {
      setEnv(TEST_KEY, TEST_VALUE);
      const value = getEnv(TEST_KEY);
      expect(value).toBe(TEST_VALUE);
    });

    it("应该返回 undefined（如果环境变量不存在）", () => {
      const value = getEnv("NON_EXISTENT_KEY_12345");
      expect(value).toBeUndefined();
    });
  });

  describe("hasEnv", () => {
    it("应该返回 true（如果环境变量存在）", () => {
      setEnv(TEST_KEY, TEST_VALUE);
      expect(hasEnv(TEST_KEY)).toBe(true);
    });

    it("应该返回 false（如果环境变量不存在）", () => {
      expect(hasEnv("NON_EXISTENT_KEY_12345")).toBe(false);
    });
  });

  describe("deleteEnv", () => {
    it("应该删除环境变量", () => {
      setEnv(TEST_KEY, TEST_VALUE);
      expect(hasEnv(TEST_KEY)).toBe(true);

      deleteEnv(TEST_KEY);
      expect(hasEnv(TEST_KEY)).toBe(false);
      expect(getEnv(TEST_KEY)).toBeUndefined();
    });

    it("应该安全地删除不存在的环境变量", () => {
      expect(() => {
        deleteEnv("NON_EXISTENT_KEY_12345");
      }).not.toThrow();
    });
  });

  describe("getEnvAll", () => {
    it("应该返回所有环境变量的对象", () => {
      const allEnv = getEnvAll();
      expect(typeof allEnv).toBe("object");
      expect(allEnv).not.toBeNull();
    });

    it("应该包含已设置的环境变量", () => {
      setEnv(TEST_KEY, TEST_VALUE);
      const allEnv = getEnvAll();
      expect(allEnv[TEST_KEY]).toBe(TEST_VALUE);
    });
  });

  // 清理测试环境变量
  afterAll(() => {
    deleteEnv(TEST_KEY);
  });
});
