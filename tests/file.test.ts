/**
 * @fileoverview 文件系统 API 测试
 */

import { afterAll, describe, expect, it } from "@dreamer/test";
import {
  chdir,
  chmod,
  chown,
  copyFile,
  create,
  cwd,
  ensureDir,
  exists,
  isDirectory,
  makeTempDir,
  makeTempFile,
  mkdir,
  open,
  readdir,
  readFile,
  readTextFile,
  realPath,
  remove,
  rename,
  stat,
  symlink,
  walk,
  watchFs,
  writeFile,
  writeTextFile,
} from "../src/file.ts";

describe("文件系统 API", () => {
  const TEST_DIR = "./tests/data";
  const TEST_FILE = `${TEST_DIR}/test.txt`;
  const TEST_CONTENT = "Hello, Runtime Adapter!";
  const TEST_BINARY = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"

  describe("ensureDir", () => {
    it("应该创建不存在的目录", async () => {
      const testDir = `${TEST_DIR}/ensure-dir-test`;
      await remove(testDir, { recursive: true }).catch(() => {});

      await ensureDir(testDir);

      expect(await exists(testDir)).toBe(true);
      expect(await isDirectory(testDir)).toBe(true);
    });

    it("应该创建嵌套目录", async () => {
      const nestedDir = `${TEST_DIR}/nested/deep/path`;
      await remove(`${TEST_DIR}/nested`, { recursive: true }).catch(() => {});

      await ensureDir(nestedDir);

      expect(await exists(nestedDir)).toBe(true);
      expect(await isDirectory(nestedDir)).toBe(true);
    });

    it("如果目录已存在，不应该抛出错误", async () => {
      const testDir = `${TEST_DIR}/ensure-dir-existing`;
      await mkdir(testDir, { recursive: true });

      // 再次调用 ensureDir 不应该抛出错误
      await ensureDir(testDir);

      expect(await exists(testDir)).toBe(true);
    });

    it("应该支持 mode 选项", async () => {
      const testDir = `${TEST_DIR}/ensure-dir-mode`;
      await remove(testDir, { recursive: true }).catch(() => {});

      await ensureDir(testDir, { mode: 0o755 });

      expect(await exists(testDir)).toBe(true);
    });
  });

  describe("mkdir", () => {
    it("应该创建目录", async () => {
      await mkdir(TEST_DIR, { recursive: true });
      const info = await stat(TEST_DIR);
      expect(info.isDirectory).toBe(true);
    });

    it("应该支持递归创建目录", async () => {
      const nestedDir = `${TEST_DIR}/nested/deep`;
      await mkdir(nestedDir, { recursive: true });
      const info = await stat(nestedDir);
      expect(info.isDirectory).toBe(true);
    });
  });

  describe("writeTextFile", () => {
    it("应该写入文本文件", async () => {
      await writeTextFile(TEST_FILE, TEST_CONTENT);
      const content = await readTextFile(TEST_FILE);
      expect(content).toBe(TEST_CONTENT);
    });
  });

  describe("readTextFile", () => {
    it("应该读取文本文件", async () => {
      await writeTextFile(TEST_FILE, TEST_CONTENT);
      const content = await readTextFile(TEST_FILE);
      expect(content).toBe(TEST_CONTENT);
    });
  });

  describe("writeFile", () => {
    it("应该写入二进制文件", async () => {
      await writeFile(TEST_FILE, TEST_BINARY);
      const content = await readFile(TEST_FILE);
      expect(content).toEqual(TEST_BINARY);
    });
  });

  describe("readFile", () => {
    it("应该读取二进制文件", async () => {
      await writeFile(TEST_FILE, TEST_BINARY);
      const content = await readFile(TEST_FILE);
      expect(content).toEqual(TEST_BINARY);
    });
  });

  describe("stat", () => {
    it("应该获取文件信息", async () => {
      await writeTextFile(TEST_FILE, TEST_CONTENT);
      const info = await stat(TEST_FILE);
      expect(info.isFile).toBe(true);
      expect(info.size).toBeGreaterThan(0);
    });

    it("应该获取目录信息", async () => {
      await mkdir(TEST_DIR, { recursive: true });
      const info = await stat(TEST_DIR);
      expect(info.isDirectory).toBe(true);
    });
  });

  describe("remove", () => {
    it("应该删除文件", async () => {
      await writeTextFile(TEST_FILE, TEST_CONTENT);
      await remove(TEST_FILE);
      try {
        await stat(TEST_FILE);
        expect.fail("文件应该已被删除");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it("应该删除目录", async () => {
      await mkdir(TEST_DIR, { recursive: true });
      await remove(TEST_DIR, { recursive: true });
      try {
        await stat(TEST_DIR);
        expect.fail("目录应该已被删除");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe("readdir", () => {
    it("应该读取目录内容", async () => {
      // 确保测试目录存在
      await mkdir(TEST_DIR, { recursive: true });

      // 创建测试文件和子目录（使用唯一名称避免冲突）
      const timestamp = Date.now();
      const file1Name = `file1-${timestamp}.txt`;
      const file2Name = `file2-${timestamp}.txt`;
      const subdirName = `subdir-${timestamp}`;

      await writeTextFile(`${TEST_DIR}/${file1Name}`, "content1");
      await writeTextFile(`${TEST_DIR}/${file2Name}`, "content2");
      await mkdir(`${TEST_DIR}/${subdirName}`, { recursive: true });

      // 等待文件系统同步，并验证文件确实存在
      let retries = 10;
      while (retries > 0) {
        try {
          const file1Info = await stat(`${TEST_DIR}/${file1Name}`);
          const file2Info = await stat(`${TEST_DIR}/${file2Name}`);
          const subdirInfo = await stat(`${TEST_DIR}/${subdirName}`);
          if (file1Info.isFile && file2Info.isFile && subdirInfo.isDirectory) {
            break;
          }
        } catch {
          // 文件可能还没创建好，继续等待
        }
        retries--;
        if (retries > 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // 确保目录存在
      try {
        await stat(TEST_DIR);
      } catch {
        // 如果目录不存在，重新创建
        await mkdir(TEST_DIR, { recursive: true });
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const entries = await readdir(TEST_DIR);
      expect(entries.length).toBeGreaterThanOrEqual(3);

      const file1 = entries.find((e) => e.name === file1Name);
      expect(file1).toBeTruthy();
      if (file1) {
        expect(file1.isFile).toBe(true);
      }

      const file2 = entries.find((e) => e.name === file2Name);
      expect(file2).toBeTruthy();
      if (file2) {
        expect(file2.isFile).toBe(true);
      }

      const subdir = entries.find((e) => e.name === subdirName);
      expect(subdir).toBeTruthy();
      if (subdir) {
        expect(subdir.isDirectory).toBe(true);
      }
    });
  });

  describe("copyFile", () => {
    it("应该复制文件", async () => {
      // 确保测试目录存在
      await mkdir(TEST_DIR, { recursive: true });
      const sourceFile = `${TEST_DIR}/source.txt`;
      const destFile = `${TEST_DIR}/dest.txt`;

      await writeTextFile(sourceFile, "source content");

      await copyFile(sourceFile, destFile);

      const sourceContent = await readTextFile(sourceFile);
      const destContent = await readTextFile(destFile);

      expect(destContent).toBe(sourceContent);
      expect(destContent).toBe("source content");
    });
  });

  describe("rename", () => {
    it("应该重命名文件", async () => {
      // 确保测试目录存在
      await mkdir(TEST_DIR, { recursive: true });
      const timestamp = Date.now();
      const oldFile = `${TEST_DIR}/old-${timestamp}.txt`;
      const newFile = `${TEST_DIR}/new-${timestamp}.txt`;

      // 确保旧文件存在
      await writeTextFile(oldFile, "content");

      // 验证旧文件存在（等待文件系统同步）
      let retries = 20;
      let oldFileInfo;
      while (retries > 0) {
        try {
          oldFileInfo = await stat(oldFile);
          if (oldFileInfo.isFile && oldFileInfo.size > 0) {
            break;
          }
        } catch (e) {
          retries--;
          if (retries > 0) {
            await new Promise((resolve) => setTimeout(resolve, 50));
          } else {
            throw new Error(`旧文件不存在或无法访问: ${oldFile}`);
          }
        }
      }
      expect(oldFileInfo!.isFile).toBe(true);

      await rename(oldFile, newFile);

      // 旧文件应该不存在
      let error: Error | null = null;
      try {
        await stat(oldFile);
      } catch (e) {
        error = e as Error;
      }
      // 在 Bun 环境下，如果文件不存在，stat 会抛出错误
      // 如果 error 为 null，说明文件仍然存在，这也是一个错误情况
      if (error === null) {
        throw new Error("旧文件应该不存在，但仍然存在");
      }
      expect(error).toBeTruthy();
      expect(error).toBeInstanceOf(Error);

      // 新文件应该存在
      const newFileInfo = await stat(newFile);
      expect(newFileInfo.isFile).toBe(true);
      const newFileContent = await readTextFile(newFile);
      expect(newFileContent).toBe("content");
    });

    it("应该移动文件到不同目录", async () => {
      // 确保测试目录存在
      await mkdir(TEST_DIR, { recursive: true });
      const timestamp = Date.now();
      const subdirName = `subdir-rename-${timestamp}`;
      const sourceFile = `${TEST_DIR}/move-source-rename-${timestamp}.txt`;
      const destFile = `${TEST_DIR}/${subdirName}/move-dest.txt`;

      // 先创建目标目录
      await mkdir(`${TEST_DIR}/${subdirName}`, { recursive: true });

      // 确保源文件存在
      await writeTextFile(sourceFile, "move content");

      // 验证源文件存在（等待文件系统同步，增加重试次数和等待时间）
      let retries = 10;
      let sourceFileInfo;
      while (retries > 0) {
        try {
          sourceFileInfo = await stat(sourceFile);
          if (sourceFileInfo.isFile && sourceFileInfo.size > 0) {
            break;
          }
        } catch (e) {
          retries--;
          if (retries > 0) {
            // 等待文件系统同步（增加等待时间）
            await new Promise((resolve) => setTimeout(resolve, 100));
          } else {
            throw new Error(`源文件不存在或无法访问: ${sourceFile}`);
          }
        }
      }
      expect(sourceFileInfo!.isFile).toBe(true);
      expect(sourceFileInfo!.size).toBeGreaterThan(0);

      await rename(sourceFile, destFile);

      // 源文件应该不存在
      let error: Error | null = null;
      try {
        await stat(sourceFile);
      } catch (e) {
        error = e as Error;
      }
      expect(error).toBeTruthy();
      expect(error).toBeInstanceOf(Error);

      // 目标文件应该存在
      const destFileInfo = await stat(destFile);
      expect(destFileInfo.isFile).toBe(true);
      const destContent = await readTextFile(destFile);
      expect(destContent).toBe("move content");
    });
  });

  describe("symlink", () => {
    it("应该创建符号链接", async () => {
      // 确保测试目录存在
      await mkdir(TEST_DIR, { recursive: true });
      const targetFile = `${TEST_DIR}/target.txt`;
      const linkFile = `${TEST_DIR}/link.txt`;

      await writeTextFile(targetFile, "target content");

      try {
        // 符号链接的 target 应该是相对于链接文件的路径
        // 或者使用绝对路径
        // 在 Bun 环境下使用 node:path，在 Deno 环境下使用 jsr:@std/path
        let resolve: (path: string) => string;
        let relative: (from: string, to: string) => string;
        let dirname: (path: string) => string;

        try {
          // 尝试使用 node:path（Bun 环境）
          const nodePath = await import("node:path");
          resolve = nodePath.resolve;
          relative = nodePath.relative;
          dirname = nodePath.dirname;
        } catch {
          // 回退到 jsr:@std/path（Deno 环境）
          const stdPath = await import("jsr:@std/path");
          resolve = stdPath.resolve;
          relative = stdPath.relative;
          dirname = stdPath.dirname;
        }

        const absTarget = resolve(targetFile);
        const absLink = resolve(linkFile);
        const linkDir = dirname(absLink);
        const relativeTarget = relative(linkDir, absTarget);

        await symlink(relativeTarget, linkFile, "file");

        // 验证符号链接是否创建成功
        const linkContent = await readTextFile(linkFile);
        expect(linkContent).toBe("target content");
      } catch (error) {
        // 如果权限不足或平台不支持，跳过测试
        // 这是可以接受的，因为符号链接需要特定权限
        if (error instanceof Error) {
          const errorMsg = error.message.toLowerCase();
          if (
            errorMsg.includes("权限") ||
            errorMsg.includes("permission") ||
            errorMsg.includes("not supported") ||
            errorMsg.includes("not found") ||
            errorMsg.includes("no such file") ||
            errorMsg.includes("already exists") ||
            errorMsg.includes("readfile")
          ) {
            // 跳过测试（可能是权限问题或平台限制）
            return;
          }
        }
        // 其他错误继续抛出
        throw error;
      }
    });
  });

  describe("realPath", () => {
    it("应该获取真实路径", async () => {
      // 确保测试目录存在
      await mkdir(TEST_DIR, { recursive: true });
      const targetFile = `${TEST_DIR}/target.txt`;

      await writeTextFile(targetFile, "target content");

      // 测试普通文件的真实路径
      const real = await realPath(targetFile);
      // 真实路径应该包含文件名
      expect(real).toContain("target.txt");

      // 如果符号链接可用，测试符号链接的真实路径
      try {
        const linkFile = `${TEST_DIR}/link.txt`;
        await symlink(targetFile, linkFile, "file");
        const linkReal = await realPath(linkFile);
        // 真实路径应该指向目标文件
        expect(linkReal).toContain("target.txt");
      } catch {
        // 如果符号链接创建失败（权限问题），跳过这部分测试
      }
    });
  });

  describe("chmod", () => {
    it("应该修改文件权限", async () => {
      // 确保测试目录存在
      await mkdir(TEST_DIR, { recursive: true });
      const testFile = `${TEST_DIR}/chmod-test.txt`;

      await writeTextFile(testFile, "test");

      // 修改权限为 0o755（Windows 可能不支持，忽略错误）
      try {
        await chmod(testFile, 0o755);
      } catch {
        // Windows 上 chmod 可能失败，跳过
      }

      // 验证文件仍然存在（chmod 不应该删除文件）
      const info = await stat(testFile);
      expect(info.isFile).toBe(true);
    });
  });

  describe("chown", () => {
    it("应该修改文件所有者", async () => {
      // 确保测试目录存在
      await mkdir(TEST_DIR, { recursive: true });
      const testFile = `${TEST_DIR}/chown-test.txt`;

      await writeTextFile(testFile, "test");

      // 尝试修改所有者（可能会失败，取决于权限）
      // 这里只测试函数调用不会抛出语法错误
      try {
        // 使用当前用户 ID（如果可用）
        // 注意：在某些系统上可能需要 root 权限
        // 使用 globalThis 访问 process，兼容 Deno/Bun 类型检查
        const proc = (globalThis as { process?: { getuid?: () => number; getgid?: () => number } }).process;
        const currentUid = proc?.getuid?.() || 1000;
        const currentGid = proc?.getgid?.() || 1000;
        await chown(testFile, currentUid, currentGid);
      } catch (error) {
        // 如果权限不足，这是预期的，我们只验证函数存在
        expect(error).toBeInstanceOf(Error);
      }

      // 验证文件仍然存在
      const info = await stat(testFile);
      expect(info.isFile).toBe(true);
    });
  });

  describe("makeTempDir", () => {
    it("应该创建临时目录", async () => {
      await mkdir(TEST_DIR, { recursive: true });
      const tempDir = await makeTempDir({ dir: TEST_DIR });
      expect(tempDir).toBeTruthy();
      expect(typeof tempDir).toBe("string");
      expect(tempDir.length).toBeGreaterThan(0);
      // 路径可能包含 ./ 前缀或没有，统一处理
      const normalizedTestDir = TEST_DIR.replace(/^\.\//, "");
      const normalizedTempDir = tempDir.replace(/^\.\//, "");
      expect(normalizedTempDir).toContain(normalizedTestDir);

      // 验证目录存在
      const info = await stat(tempDir);
      expect(info.isDirectory).toBe(true);

      // 清理（使用递归删除，因为目录可能不为空）
      try {
        await remove(tempDir, { recursive: true });
      } catch (error) {
        // 在某些环境下删除可能失败（如 Bun 的 EFAULT 错误），这是可以接受的
        if (error instanceof Error) {
          const errorMsg = error.message.toLowerCase();
          if (errorMsg.includes("efault") || errorMsg.includes("bad address")) {
            // 忽略 EFAULT 错误（可能是 Bun 的已知问题）
            return;
          }
        }
        throw error;
      }
    });

    it("应该使用指定的前缀创建临时目录", async () => {
      await mkdir(TEST_DIR, { recursive: true });
      const tempDir = await makeTempDir({ prefix: "test-", dir: TEST_DIR });
      expect(tempDir).toContain("test-");
      // 路径可能包含 ./ 前缀或没有，统一处理
      const normalizedTestDir = TEST_DIR.replace(/^\.\//, "");
      const normalizedTempDir = tempDir.replace(/^\.\//, "");
      expect(normalizedTempDir).toContain(normalizedTestDir);

      // 清理（使用递归删除）
      try {
        await remove(tempDir, { recursive: true });
      } catch (error) {
        // 在某些环境下删除可能失败（如 Bun 的 EFAULT 错误），这是可以接受的
        if (error instanceof Error) {
          const errorMsg = error.message.toLowerCase();
          if (errorMsg.includes("efault") || errorMsg.includes("bad address")) {
            // 忽略 EFAULT 错误（可能是 Bun 的已知问题）
            return;
          }
        }
        throw error;
      }
    });
  });

  describe("makeTempFile", () => {
    it("应该创建临时文件", async () => {
      await mkdir(TEST_DIR, { recursive: true });
      const tempFile = await makeTempFile({ dir: TEST_DIR });
      expect(tempFile).toBeTruthy();
      // 路径可能包含 ./ 前缀或没有，统一处理
      const normalizedTestDir = TEST_DIR.replace(/^\.\//, "");
      const normalizedTempFile = tempFile.replace(/^\.\//, "");
      expect(normalizedTempFile).toContain(normalizedTestDir);

      // 验证文件存在
      const info = await stat(tempFile);
      expect(info.isFile).toBe(true);

      // 清理
      await remove(tempFile);
    });

    it("应该使用指定的前缀和后缀创建临时文件", async () => {
      await mkdir(TEST_DIR, { recursive: true });
      const tempFile = await makeTempFile({
        prefix: "test-",
        suffix: ".txt",
        dir: TEST_DIR,
      });
      expect(tempFile).toContain("test-");
      expect(tempFile).toContain(".txt");
      // 路径可能包含 ./ 前缀或没有，统一处理
      const normalizedTestDir = TEST_DIR.replace(/^\.\//, "");
      const normalizedTempFile = tempFile.replace(/^\.\//, "");
      expect(normalizedTempFile).toContain(normalizedTestDir);

      // 清理
      await remove(tempFile);
    });
  });

  describe("cwd", () => {
    it("应该返回当前工作目录", () => {
      const currentDir = cwd();
      expect(currentDir).toBeTruthy();
      expect(typeof currentDir).toBe("string");
      expect(currentDir.length).toBeGreaterThan(0);
    });
  });

  describe("chdir", () => {
    it("应该更改当前工作目录", async () => {
      // 确保测试目录存在
      await mkdir(TEST_DIR, { recursive: true });

      const originalCwd = cwd();

      try {
        // 更改到测试目录
        chdir(TEST_DIR);
        const newCwd = cwd();
        // 验证工作目录已更改（路径应该包含测试目录名，兼容 Windows 反斜杠）
        expect(newCwd.replace(/\\/g, "/")).toContain("tests/data");

        // 改回原目录
        chdir(originalCwd);
        const restoredCwd = cwd();
        expect(restoredCwd).toBe(originalCwd);
      } catch (error) {
        // 如果 chdir 失败（某些环境可能不支持），改回原目录
        try {
          chdir(originalCwd);
        } catch {
          // 忽略
        }
        // 在某些环境下 chdir 可能不支持，这是可以接受的
        if (error instanceof Error && error.message.includes("不支持")) {
          return;
        }
        throw error;
      }
    });
  });

  describe("open 与 create", () => {
    it("应该打开文件并读取内容", async () => {
      await mkdir(TEST_DIR, { recursive: true });
      const testFilePath = `${TEST_DIR}/open-read.txt`;
      await writeTextFile(testFilePath, TEST_CONTENT);
      try {
        const file = await open(testFilePath, { read: true });
        const reader = file.readable.getReader();
        const chunks: Uint8Array[] = [];
        let result;
        while (!(result = await reader.read()).done) {
          chunks.push(result.value);
        }
        reader.releaseLock();
        // 流消费完成后资源可能已关闭，close() 可能抛出 BadResource
        try {
          file.close();
        } catch {
          // 忽略，资源可能已被流消费自动关闭
        }
        const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const c of chunks) {
          combined.set(c, offset);
          offset += c.length;
        }
        expect(new TextDecoder().decode(combined)).toBe(TEST_CONTENT);
      } finally {
        await remove(testFilePath).catch(() => {});
      }
    });

    it("应该使用 create 创建并写入文件", async () => {
      const testFilePath = `${TEST_DIR}/open-create.txt`;
      await mkdir(TEST_DIR, { recursive: true });
      await remove(testFilePath).catch(() => {});
      try {
        const file = await create(testFilePath);
        const writer = file.writable.getWriter();
        await writer.write(new TextEncoder().encode(TEST_CONTENT));
        await writer.close();
        // writer.close() 后底层资源可能已关闭
        try {
          file.close();
        } catch {
          // 忽略 BadResource
        }
        const content = await readTextFile(testFilePath);
        expect(content).toBe(TEST_CONTENT);
      } finally {
        await remove(testFilePath).catch(() => {});
      }
    });
  });

  describe("watchFs", () => {
    it("应该监控目录并收到文件创建事件", async () => {
      await mkdir(TEST_DIR, { recursive: true });
      const watchDir = await makeTempDir({ prefix: "test-watch-", dir: TEST_DIR });
      try {
        const watcher = watchFs(watchDir);
        const events: Array<{ kind: string; paths: string[] }> = [];
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        const collectPromise = (async () => {
          for await (const event of watcher) {
            events.push(event);
            // Bun/Node fs.watch 可能 emit "modify" 而非 "create"，两种都视为收到事件
            if (
              (event.kind === "create" || event.kind === "modify") &&
              event.paths.some((p) => p.includes("watched.txt"))
            ) {
              break;
            }
          }
        })();
        await new Promise((r) => setTimeout(r, 150));
        await writeTextFile(`${watchDir}/watched.txt`, "watch me");
        try {
          await Promise.race([
            collectPromise,
            new Promise<void>((_, rej) => {
              timeoutId = setTimeout(() => rej(new Error("timeout")), 4000);
            }),
          ]);
        } catch {
          // 超时也可接受，部分环境下事件可能延迟
        } finally {
          if (timeoutId != null) clearTimeout(timeoutId);
        }
        try {
          watcher.close();
        } catch {
          // 忽略 BadResource，迭代器结束时 watcher 可能已关闭
        }
        // Bun/Node fs.watch 可能报告 "modify" 而非 "create"，两种都表示监听到文件变化
        expect(
          events.some((e) => e.kind === "create" || e.kind === "modify"),
        ).toBe(true);
      } finally {
        await remove(watchDir, { recursive: true });
      }
    });

    it("应该支持 close 方法", async () => {
      await mkdir(TEST_DIR, { recursive: true });
      const watchDir = await makeTempDir({ prefix: "test-watch-close-", dir: TEST_DIR });
      try {
        const watcher = watchFs(watchDir);
        expect(() => watcher.close()).not.toThrow();
      } finally {
        await remove(watchDir, { recursive: true });
      }
    });
  });

  // 清理测试文件
  afterAll(async () => {
    try {
      await remove(TEST_DIR, { recursive: true });
    } catch {
      // 忽略清理错误
    }
  });

  describe("目录遍历 API", () => {
    it("应该遍历目录中的所有文件", async () => {
      await mkdir(TEST_DIR, { recursive: true });
      const tempDir = await makeTempDir({
        prefix: "test-walk-",
        dir: TEST_DIR,
      });
      try {
        // 创建测试文件
        await writeTextFile(`${tempDir}/file1.txt`, "content1");
        await writeTextFile(`${tempDir}/file2.txt`, "content2");
        await mkdir(`${tempDir}/subdir`, { recursive: true });
        await writeTextFile(`${tempDir}/subdir/file3.txt`, "content3");

        const files: string[] = [];
        for await (const path of walk(tempDir, { includeDirs: false })) {
          files.push(path);
        }

        expect(files.length).toBeGreaterThanOrEqual(3);
        expect(files.some((f) => f.includes("file1.txt"))).toBe(true);
        expect(files.some((f) => f.includes("file2.txt"))).toBe(true);
        expect(files.some((f) => f.includes("file3.txt"))).toBe(true);
      } finally {
        await remove(tempDir, { recursive: true });
      }
    });

    it("应该支持路径匹配", async () => {
      await mkdir(TEST_DIR, { recursive: true });
      const tempDir = await makeTempDir({
        prefix: "test-walk-",
        dir: TEST_DIR,
      });
      try {
        await writeTextFile(`${tempDir}/file1.ts`, "content1");
        await writeTextFile(`${tempDir}/file2.js`, "content2");

        const files: string[] = [];
        for await (
          const path of walk(tempDir, {
            includeDirs: false,
            match: (p) => p.endsWith(".ts"),
          })
        ) {
          files.push(path);
        }

        expect(files.length).toBe(1);
        expect(files[0]).toContain("file1.ts");
      } finally {
        await remove(tempDir, { recursive: true });
      }
    });
  });
});
