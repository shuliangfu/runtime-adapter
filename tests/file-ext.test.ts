/**
 * @fileoverview 文件扩展功能测试
 */

import { describe, expect, it } from "@dreamer/test";
import {
  exists,
  isDirectory,
  isFile,
  mkdir,
  readTextFile,
  remove,
  truncate,
  writeTextFile,
} from "../src/file.ts";

const TEST_DIR = "./tests/data";

describe("文件扩展功能", () => {
  describe("exists", () => {
    it("应该检查文件是否存在", async () => {
      await mkdir(TEST_DIR, { recursive: true });
      const testFile = `${TEST_DIR}/exists-test.txt`;
      try {
        await writeTextFile(testFile, "test");
        expect(await exists(testFile)).toBe(true);
        expect(await exists("/nonexistent/file")).toBe(false);
      } finally {
        await remove(testFile).catch(() => {});
      }
    });
  });

  describe("isFile", () => {
    it("应该检查路径是否为文件", async () => {
      await mkdir(TEST_DIR, { recursive: true });
      const testFile = `${TEST_DIR}/isfile-test.txt`;
      try {
        await writeTextFile(testFile, "test");
        expect(await isFile(testFile)).toBe(true);
        expect(await isFile("/nonexistent/file")).toBe(false);
      } finally {
        await remove(testFile).catch(() => {});
      }
    });
  });

  describe("isDirectory", () => {
    it("应该检查路径是否为目录", async () => {
      await mkdir(TEST_DIR, { recursive: true });
      const testFile = `${TEST_DIR}/isdir-test.txt`;
      try {
        await writeTextFile(testFile, "test");
        expect(await isDirectory(testFile)).toBe(false);
        expect(await isDirectory(TEST_DIR)).toBe(true);
      } finally {
        await remove(testFile).catch(() => {});
      }
    });
  });

  describe("truncate", () => {
    it("应该截断文件", async () => {
      await mkdir(TEST_DIR, { recursive: true });
      const testFile = `${TEST_DIR}/truncate-test.txt`;
      try {
        await writeTextFile(testFile, "Hello, World!");
        await truncate(testFile, 5);
        const content = await readTextFile(testFile);
        expect(content.length).toBeLessThanOrEqual(5);
      } finally {
        await remove(testFile).catch(() => {});
      }
    });
  });
});
