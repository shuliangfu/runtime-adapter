/**
 * @fileoverview 文件扩展功能测试
 */

import { describe, expect, it } from "@dreamer/test";
import {
  exists,
  isDirectory,
  isFile,
  makeTempFile,
  readTextFile,
  remove,
  truncate,
  writeTextFile,
} from "../src/file.ts";

describe("文件扩展功能", () => {
  describe("exists", () => {
    it("应该检查文件是否存在", async () => {
      const tempFile = await makeTempFile({ prefix: "test-" });
      try {
        expect(await exists(tempFile)).toBe(true);
        expect(await exists("/nonexistent/file")).toBe(false);
      } finally {
        await remove(tempFile);
      }
    });
  });

  describe("isFile", () => {
    it("应该检查路径是否为文件", async () => {
      const tempFile = await makeTempFile({ prefix: "test-" });
      try {
        expect(await isFile(tempFile)).toBe(true);
        expect(await isFile("/nonexistent/file")).toBe(false);
      } finally {
        await remove(tempFile);
      }
    });
  });

  describe("isDirectory", () => {
    it("应该检查路径是否为目录", async () => {
      const tempFile = await makeTempFile({ prefix: "test-" });
      try {
        expect(await isDirectory(tempFile)).toBe(false);
      } finally {
        await remove(tempFile);
      }
    });
  });

  describe("truncate", () => {
    it("应该截断文件", async () => {
      const tempFile = await makeTempFile({ prefix: "test-" });
      try {
        await writeTextFile(tempFile, "Hello, World!");
        await truncate(tempFile, 5);
        const content = await readTextFile(tempFile);
        expect(content.length).toBeLessThanOrEqual(5);
      } finally {
        await remove(tempFile);
      }
    });
  });
});
