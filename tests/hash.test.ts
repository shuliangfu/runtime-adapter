/**
 * @fileoverview 文件哈希 API 测试
 */

import { describe, expect, it } from "@dreamer/test";
import { hash, hashFile } from "../src/hash.ts";
import { makeTempFile, remove, writeTextFile } from "../src/file.ts";

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
      const tempFile = await makeTempFile({ prefix: "test-" });
      try {
        await writeTextFile(tempFile, "Hello, World!");
        const hashValue = await hashFile(tempFile);
        expect(typeof hashValue).toBe("string");
        expect(hashValue.length).toBeGreaterThan(0);
      } finally {
        await remove(tempFile);
      }
    });

    it("应该对相同内容产生相同的哈希", async () => {
      const tempFile1 = await makeTempFile({ prefix: "test-" });
      const tempFile2 = await makeTempFile({ prefix: "test-" });
      try {
        await writeTextFile(tempFile1, "Same content");
        await writeTextFile(tempFile2, "Same content");
        const hash1 = await hashFile(tempFile1);
        const hash2 = await hashFile(tempFile2);
        expect(hash1).toBe(hash2);
      } finally {
        await remove(tempFile1);
        await remove(tempFile2);
      }
    });
  });
});
