/**
 * @fileoverview 文件哈希 API 测试
 */

import { describe, expect, it } from "@dreamer/test";
import { mkdir, remove, writeTextFile } from "../src/file.ts";
import { hash, hashFile, hashFileSync, hashSync } from "../src/hash.ts";

const TEST_DIR = "./tests/data";

describe("文件哈希 API", () => {
  describe("hash", () => {
    it("应该计算字符串的哈希值", async () => {
      const hashValue = await hash("Hello, World!");
      expect(typeof hashValue).toBe("string");
      expect(hashValue.length).toBeGreaterThan(0);
    });

    it("应该计算二进制数据的哈希值", async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const hashValue = await hash(data);
      expect(typeof hashValue).toBe("string");
      expect(hashValue.length).toBeGreaterThan(0);
    });

    it("应该使用不同的算法", async () => {
      const sha256 = await hash("test", "SHA-256");
      const sha512 = await hash("test", "SHA-512");
      expect(sha256).not.toBe(sha512);
      expect(sha512.length).toBeGreaterThan(sha256.length);
    });
  });

  describe("hashFile", () => {
    it("应该计算文件的哈希值", async () => {
      await mkdir(TEST_DIR, { recursive: true });
      const testFile = `${TEST_DIR}/hash-test.txt`;
      try {
        await writeTextFile(testFile, "Hello, World!");
        const hashValue = await hashFile(testFile);
        expect(typeof hashValue).toBe("string");
        expect(hashValue.length).toBeGreaterThan(0);
      } finally {
        await remove(testFile).catch(() => {});
      }
    });

    it("应该对相同内容产生相同的哈希", async () => {
      await mkdir(TEST_DIR, { recursive: true });
      const testFile1 = `${TEST_DIR}/hash-test-1.txt`;
      const testFile2 = `${TEST_DIR}/hash-test-2.txt`;
      try {
        await writeTextFile(testFile1, "Same content");
        await writeTextFile(testFile2, "Same content");
        const hash1 = await hashFile(testFile1);
        const hash2 = await hashFile(testFile2);
        expect(hash1).toBe(hash2);
      } finally {
        await remove(testFile1).catch(() => {});
        await remove(testFile2).catch(() => {});
      }
    });
  });

  describe("hashSync", () => {
    it("应该同步计算字符串的哈希值", () => {
      const hashValue = hashSync("Hello, World!");
      expect(typeof hashValue).toBe("string");
      expect(hashValue.length).toBeGreaterThan(0);
    });

    it("应该同步计算二进制数据的哈希值", () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const hashValue = hashSync(data);
      expect(typeof hashValue).toBe("string");
      expect(hashValue.length).toBeGreaterThan(0);
    });

    it("应该使用不同的算法", () => {
      const sha256 = hashSync("test", "SHA-256");
      const sha512 = hashSync("test", "SHA-512");
      expect(sha256).not.toBe(sha512);
      expect(sha512.length).toBeGreaterThan(sha256.length);
    });
  });

  describe("hashFileSync", () => {
    it("应该同步计算文件的哈希值", async () => {
      await mkdir(TEST_DIR, { recursive: true });
      const testFile = `${TEST_DIR}/hash-sync-test.txt`;
      try {
        await writeTextFile(testFile, "Hello, World!");
        const hashValue = hashFileSync(testFile);
        expect(typeof hashValue).toBe("string");
        expect(hashValue.length).toBeGreaterThan(0);
      } finally {
        await remove(testFile).catch(() => {});
      }
    });

    it("应该对相同内容产生相同的哈希", async () => {
      await mkdir(TEST_DIR, { recursive: true });
      const testFile1 = `${TEST_DIR}/hash-sync-test-1.txt`;
      const testFile2 = `${TEST_DIR}/hash-sync-test-2.txt`;
      try {
        await writeTextFile(testFile1, "Same content");
        await writeTextFile(testFile2, "Same content");
        const hash1 = hashFileSync(testFile1);
        const hash2 = hashFileSync(testFile2);
        expect(hash1).toBe(hash2);
      } finally {
        await remove(testFile1).catch(() => {});
        await remove(testFile2).catch(() => {});
      }
    });
  });
});
