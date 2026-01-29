/**
 * @fileoverview 信号处理 API 测试
 */

import { describe, expect, it } from "@dreamer/test";
import { addSignalListener, removeSignalListener } from "../src/signal.ts";

describe("信号处理 API", () => {
  describe("addSignalListener", () => {
    it("应该添加信号监听器", () => {
      const handler = () => {};
      expect(() => {
        addSignalListener("SIGTERM", handler);
        removeSignalListener("SIGTERM", handler);
      }).not.toThrow();
    });
  });

  describe("removeSignalListener", () => {
    it("应该移除信号监听器", () => {
      const handler = () => {};
      addSignalListener("SIGINT", handler);
      expect(() => {
        removeSignalListener("SIGINT", handler);
      }).not.toThrow();
    });
  });
});
