/**
 * @fileoverview 路径操作 API 测试
 */

import { describe, expect, it } from "@dreamer/test";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  isRelative,
  join,
  normalize,
  relative,
  resolve,
} from "../src/path.ts";

describe("路径操作 API", () => {
  describe("join", () => {
    it("应该拼接多个路径片段", () => {
      expect(join("dir", "subdir", "file.txt")).toBe("dir/subdir/file.txt");
    });

    it("应该处理单个路径", () => {
      expect(join("file.txt")).toBe("file.txt");
    });

    it("应该处理空参数", () => {
      expect(join()).toBe(".");
    });

    it("应该处理空字符串", () => {
      // Node.js 的 join("", "file.txt") 返回 "file.txt"（空字符串被忽略）
      // 我们的实现也忽略空字符串
      expect(join("", "file.txt")).toBe("file.txt");
      // join("dir", "") 在 Node.js 中返回 "dir"
      expect(join("dir", "")).toBe("dir");
    });

    it("应该处理绝对路径", () => {
      expect(join("/", "dir", "file.txt")).toBe("/dir/file.txt");
      expect(join("/dir", "file.txt")).toBe("/dir/file.txt");
    });

    it("应该规范化多个斜杠", () => {
      // Node.js 的 join 会规范化多个斜杠
      // 我们的实现也会规范化（单个路径也会规范化）
      expect(join("dir//subdir///file.txt")).toBe("dir/subdir/file.txt");
      expect(join("dir/", "/subdir", "/file.txt")).toBe("dir/subdir/file.txt");
    });

    it("应该处理相对路径", () => {
      expect(join(".", "file.txt")).toBe("./file.txt");
      expect(join("..", "file.txt")).toBe("../file.txt");
    });

    it("应该处理 Windows 风格的路径（如果传入）", () => {
      // Windows 兼容：反斜杠会转为正斜杠，输出统一为 Unix 风格
      expect(join("dir\\subdir", "file.txt")).toBe("dir/subdir/file.txt");
    });

    it("应该处理末尾斜杠", () => {
      expect(join("dir/", "file.txt")).toBe("dir/file.txt");
      expect(join("dir", "/file.txt")).toBe("dir/file.txt");
    });
  });

  describe("dirname", () => {
    it("应该返回目录名", () => {
      expect(dirname("/path/to/file.txt")).toBe("/path/to");
      expect(dirname("path/to/file.txt")).toBe("path/to");
    });

    it("应该处理根目录", () => {
      expect(dirname("/file.txt")).toBe("/");
      // 根目录的 dirname 在 Node.js 中返回 "/"，我们的实现也返回 "/"
      const rootDirname = dirname("/");
      expect(rootDirname).toBe("/");
    });

    it("应该处理当前目录", () => {
      expect(dirname("file.txt")).toBe(".");
      expect(dirname(".")).toBe(".");
    });

    it("应该处理末尾斜杠", () => {
      // dirname 会移除末尾斜杠后再处理
      // Node.js 的 dirname("/path/to/") 返回 "/path"（因为末尾斜杠被移除后变成 "/path/to"，然后取 dirname）
      // 我们的实现也遵循相同逻辑
      expect(dirname("/path/to/")).toBe("/path");
      expect(dirname("path/to/")).toBe("path");
      expect(dirname("/")).toBe("/");
    });

    it("应该处理相对路径", () => {
      expect(dirname("../file.txt")).toBe("..");
      expect(dirname("./file.txt")).toBe(".");
    });
  });

  describe("basename", () => {
    it("应该返回文件名", () => {
      expect(basename("/path/to/file.txt")).toBe("file.txt");
      expect(basename("path/to/file.txt")).toBe("file.txt");
      expect(basename("file.txt")).toBe("file.txt");
    });

    it("应该移除扩展名（如果提供）", () => {
      expect(basename("/path/to/file.txt", ".txt")).toBe("file");
      expect(basename("file.txt", ".txt")).toBe("file");
      expect(basename("file.txt", "txt")).toBe("file.");
    });

    it("应该处理没有扩展名的文件", () => {
      expect(basename("/path/to/file")).toBe("file");
      expect(basename("file")).toBe("file");
    });

    it("应该处理末尾斜杠", () => {
      // basename 会移除末尾斜杠后再处理
      expect(basename("/path/to/")).toBe("to");
      // 根目录的情况：Node.js 返回空字符串，我们的实现也返回空字符串
      const rootBasename = basename("/");
      expect(rootBasename === "" || rootBasename === "/").toBe(true);
    });

    it("应该处理多个点号", () => {
      expect(basename("file.min.js", ".js")).toBe("file.min");
      expect(basename("file.min.js", ".min.js")).toBe("file");
    });

    it("应该处理不匹配的扩展名", () => {
      expect(basename("file.txt", ".js")).toBe("file.txt");
    });
  });

  describe("extname", () => {
    it("应该返回扩展名", () => {
      expect(extname("/path/to/file.txt")).toBe(".txt");
      expect(extname("file.txt")).toBe(".txt");
      expect(extname("file.min.js")).toBe(".js");
    });

    it("应该处理没有扩展名的文件", () => {
      expect(extname("/path/to/file")).toBe("");
      expect(extname("file")).toBe("");
    });

    it("应该处理以点号开头的文件名", () => {
      expect(extname(".gitignore")).toBe("");
      expect(extname(".env")).toBe("");
    });

    it("应该处理多个点号", () => {
      expect(extname("file.min.js")).toBe(".js");
      expect(extname("file.tar.gz")).toBe(".gz");
    });

    it("应该处理末尾斜杠", () => {
      expect(extname("/path/to/")).toBe("");
    });
  });

  describe("resolve", () => {
    it("应该解析相对路径为绝对路径", () => {
      const result = resolve("dir", "file.txt");
      expect(result).toContain("dir/file.txt");
      expect(result).toMatch(/^\/.*dir\/file\.txt$/);
    });

    it("应该处理绝对路径", () => {
      const result = resolve("/absolute", "path", "file.txt");
      expect(result).toBe("/absolute/path/file.txt");
    });

    it("应该处理单个路径", () => {
      const result = resolve("file.txt");
      expect(result).toContain("file.txt");
    });

    it("应该处理空参数", () => {
      const result = resolve();
      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("应该处理相对路径片段", () => {
      const result = resolve(".", "file.txt");
      expect(result).toContain("file.txt");
    });

    it("应该处理多个路径片段", () => {
      const result = resolve("dir", "subdir", "file.txt");
      expect(result).toContain("dir/subdir/file.txt");
    });

    it("应该处理根路径", () => {
      const result = resolve("/", "file.txt");
      expect(result).toBe("/file.txt");
    });
  });

  describe("综合测试", () => {
    it("应该能够组合使用多个函数", () => {
      const filePath = "/path/to/file.txt";
      const dir = dirname(filePath);
      const name = basename(filePath);
      const ext = extname(filePath);
      const joined = join(dir, name);

      expect(dir).toBe("/path/to");
      expect(name).toBe("file.txt");
      expect(ext).toBe(".txt");
      expect(joined).toBe("/path/to/file.txt");
    });

    it("应该处理复杂的路径操作", () => {
      const basePath = "/project/src";
      const filePath = join(basePath, "components", "Button.tsx");
      const dir = dirname(filePath);
      const name = basename(filePath, ".tsx");
      const ext = extname(filePath);

      expect(filePath).toBe("/project/src/components/Button.tsx");
      expect(dir).toBe("/project/src/components");
      expect(name).toBe("Button");
      expect(ext).toBe(".tsx");
    });
  });

  describe("relative", () => {
    it("应该计算相对路径", () => {
      expect(relative("/path/to/from", "/path/to/to/file.txt")).toBe(
        "../to/file.txt",
      );
    });

    it("应该处理相同目录", () => {
      expect(relative("/path/to", "/path/to/file.txt")).toBe("file.txt");
    });

    it("应该处理相同路径", () => {
      expect(relative("/path/to/file.txt", "/path/to/file.txt")).toBe(".");
    });

    it("应该处理向上多级", () => {
      expect(relative("/path/to/deep/nested", "/path/to/file.txt")).toBe(
        "../../file.txt",
      );
    });

    it("应该处理向下多级", () => {
      expect(relative("/path/to", "/path/to/deep/nested/file.txt")).toBe(
        "deep/nested/file.txt",
      );
    });

    it("应该处理相对路径", () => {
      expect(relative("from", "to/file.txt")).toBe("../to/file.txt");
    });

    it("应该处理根目录", () => {
      expect(relative("/", "/file.txt")).toBe("file.txt");
      expect(relative("/path/to", "/")).toBe("../..");
    });

    it("应该处理 Windows 跨盘符（返回目标路径）", () => {
      // C:\a\b 与 D:\x\y 无法用相对路径表示，应返回 D:/x/y
      expect(relative("C:/a/b", "D:/x/y")).toBe("D:/x/y");
      expect(relative("C:\\a\\b", "D:\\x\\y")).toBe("D:/x/y");
    });
  });

  describe("normalize", () => {
    it("应该规范化路径", () => {
      expect(normalize("/path/to/../from/./file.txt")).toBe(
        "/path/from/file.txt",
      );
    });

    it("应该处理多个斜杠", () => {
      expect(normalize("/path//to///file.txt")).toBe("/path/to/file.txt");
    });

    it("应该处理当前目录", () => {
      expect(normalize("./file.txt")).toBe("file.txt");
      expect(normalize(".")).toBe(".");
    });

    it("应该处理上级目录", () => {
      expect(normalize("../file.txt")).toBe("../file.txt");
      expect(normalize("/path/to/../../file.txt")).toBe("/file.txt");
    });

    it("应该处理 Windows 路径", () => {
      expect(normalize("C:\\path\\to\\file.txt")).toBe("C:/path/to/file.txt");
    });
  });

  describe("isAbsolute", () => {
    it("应该识别 Unix 绝对路径", () => {
      expect(isAbsolute("/path/to/file")).toBe(true);
      expect(isAbsolute("/")).toBe(true);
    });

    it("应该识别 Windows 绝对路径", () => {
      expect(isAbsolute("C:/path/to/file")).toBe(true);
      expect(isAbsolute("C:\\path\\to\\file")).toBe(true);
    });

    it("应该识别相对路径", () => {
      expect(isAbsolute("./file")).toBe(false);
      expect(isAbsolute("../file")).toBe(false);
      expect(isAbsolute("file.txt")).toBe(false);
    });
  });

  describe("isRelative", () => {
    it("应该识别相对路径", () => {
      expect(isRelative("./file")).toBe(true);
      expect(isRelative("../file")).toBe(true);
      expect(isRelative("file.txt")).toBe(true);
    });

    it("应该识别绝对路径", () => {
      expect(isRelative("/path/to/file")).toBe(false);
      expect(isRelative("C:/path/to/file")).toBe(false);
    });
  });
});
