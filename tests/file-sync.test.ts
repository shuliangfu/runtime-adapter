/**
 * @fileoverview 文件系统同步 API 测试
 */

import { afterAll, describe, expect, it } from "@dreamer/test";
import {
  existsSync,
  isDirectorySync,
  isFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readTextFileSync,
  realPathSync,
  removeSync,
  statSync,
  writeFileSync,
  writeTextFileSync,
} from "../src/file.ts";

describe("文件系统同步 API", () => {
  const TEST_DIR = "./tests/data";
  const TEST_FILE = `${TEST_DIR}/test-sync.txt`;
  const TEST_CONTENT = "Hello, Sync API!";
  const TEST_BINARY = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"

  afterAll(async () => {
    // 清理测试文件
    try {
      const { remove } = await import("../src/file.ts");
      await remove(TEST_DIR, { recursive: true });
    } catch {
      // 忽略清理错误
    }
  });

  describe("mkdirSync", () => {
    it("应该同步创建目录", () => {
      mkdirSync(TEST_DIR, { recursive: true });
      const info = statSync(TEST_DIR);
      expect(info.isDirectory).toBe(true);
    });

    it("应该支持递归创建目录", () => {
      const nestedDir = `${TEST_DIR}/nested/deep`;
      mkdirSync(nestedDir, { recursive: true });
      const info = statSync(nestedDir);
      expect(info.isDirectory).toBe(true);
    });
  });

  describe("writeTextFileSync", () => {
    it("应该同步写入文本文件", () => {
      mkdirSync(TEST_DIR, { recursive: true });
      writeTextFileSync(TEST_FILE, TEST_CONTENT);
      const content = readTextFileSync(TEST_FILE);
      expect(content).toBe(TEST_CONTENT);
    });
  });

  describe("readTextFileSync", () => {
    it("应该同步读取文本文件", () => {
      mkdirSync(TEST_DIR, { recursive: true });
      writeTextFileSync(TEST_FILE, TEST_CONTENT);
      const content = readTextFileSync(TEST_FILE);
      expect(content).toBe(TEST_CONTENT);
    });
  });

  describe("writeFileSync", () => {
    it("应该同步写入二进制文件", () => {
      mkdirSync(TEST_DIR, { recursive: true });
      writeFileSync(TEST_FILE, TEST_BINARY);
      const content = readFileSync(TEST_FILE);
      expect(content).toEqual(TEST_BINARY);
    });
  });

  describe("readFileSync", () => {
    it("应该同步读取二进制文件", () => {
      mkdirSync(TEST_DIR, { recursive: true });
      writeFileSync(TEST_FILE, TEST_BINARY);
      const content = readFileSync(TEST_FILE);
      expect(content).toEqual(TEST_BINARY);
    });
  });

  describe("statSync", () => {
    it("应该同步获取文件信息", () => {
      mkdirSync(TEST_DIR, { recursive: true });
      writeTextFileSync(TEST_FILE, TEST_CONTENT);
      const info = statSync(TEST_FILE);
      expect(info.isFile).toBe(true);
      expect(info.size).toBeGreaterThan(0);
    });

    it("应该同步获取目录信息", () => {
      mkdirSync(TEST_DIR, { recursive: true });
      const info = statSync(TEST_DIR);
      expect(info.isDirectory).toBe(true);
    });
  });

  describe("removeSync", () => {
    it("应该同步删除文件", () => {
      mkdirSync(TEST_DIR, { recursive: true });
      writeTextFileSync(TEST_FILE, TEST_CONTENT);
      removeSync(TEST_FILE);
      expect(existsSync(TEST_FILE)).toBe(false);
    });

    it("应该同步删除目录", () => {
      const testDir = `${TEST_DIR}/remove-test`;
      mkdirSync(testDir, { recursive: true });
      removeSync(testDir);
      expect(existsSync(testDir)).toBe(false);
    });
  });

  describe("existsSync", () => {
    it("应该检查文件是否存在", () => {
      mkdirSync(TEST_DIR, { recursive: true });
      writeTextFileSync(TEST_FILE, TEST_CONTENT);
      expect(existsSync(TEST_FILE)).toBe(true);
      expect(existsSync("/nonexistent/file")).toBe(false);
    });

    it("应该检查目录是否存在", () => {
      mkdirSync(TEST_DIR, { recursive: true });
      expect(existsSync(TEST_DIR)).toBe(true);
      expect(existsSync("/nonexistent/dir")).toBe(false);
    });
  });

  describe("isFileSync", () => {
    it("应该检查路径是否为文件", () => {
      mkdirSync(TEST_DIR, { recursive: true });
      writeTextFileSync(TEST_FILE, TEST_CONTENT);
      expect(isFileSync(TEST_FILE)).toBe(true);
      expect(isFileSync(TEST_DIR)).toBe(false);
      expect(isFileSync("/nonexistent/file")).toBe(false);
    });
  });

  describe("isDirectorySync", () => {
    it("应该检查路径是否为目录", () => {
      mkdirSync(TEST_DIR, { recursive: true });
      expect(isDirectorySync(TEST_DIR)).toBe(true);
      expect(isDirectorySync(TEST_FILE)).toBe(false);
      expect(isDirectorySync("/nonexistent/dir")).toBe(false);
    });
  });

  describe("readdirSync", () => {
    it("应该同步读取目录内容", () => {
      mkdirSync(TEST_DIR, { recursive: true });
      writeTextFileSync(TEST_FILE, TEST_CONTENT);
      const entries = readdirSync(TEST_DIR);
      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBeGreaterThan(0);
      const fileEntry = entries.find((e) => e.name === "test-sync.txt");
      expect(fileEntry).toBeDefined();
      if (fileEntry) {
        expect(fileEntry.isFile).toBe(true);
      }
    });
  });

  describe("realPathSync", () => {
    it("应该同步解析真实路径", () => {
      mkdirSync(TEST_DIR, { recursive: true });
      const realPath = realPathSync(TEST_DIR);
      expect(typeof realPath).toBe("string");
      expect(realPath.length).toBeGreaterThan(0);
    });
  });
});
