/**
 * @fileoverview 网络 API 测试
 */

import { describe, expect, it } from "@dreamer/test";
import { serve, type ServeHandle } from "../src/network.ts";

describe("网络 API", () => {
  describe("serve", () => {
    it("应该启动 HTTP 服务器", async () => {
      const handle = await serve(
        { port: 0 }, // 使用随机端口
        () => new Response("Hello, World!"),
      );
      expect(handle).toBeTruthy();
      expect(typeof handle.port).toBe("number");
      expect(handle.port).toBeGreaterThan(0);

      // 测试服务器响应
      const response = await fetch(`http://localhost:${handle.port}`);
      const text = await response.text();
      expect(text).toBe("Hello, World!");

      await handle.shutdown();
    });

    it("应该处理不同的请求路径", async () => {
      const handle = await serve(
        { port: 0 },
        (req) => {
          const url = new URL(req.url);
          if (url.pathname === "/test") {
            return new Response("Test Path");
          }
          return new Response("Default");
        },
      );

      const response1 = await fetch(`http://localhost:${handle.port}/test`);
      expect(await response1.text()).toBe("Test Path");

      const response2 = await fetch(`http://localhost:${handle.port}/other`);
      expect(await response2.text()).toBe("Default");

      await handle.shutdown();
    });

    it("应该支持 POST 请求", async () => {
      const handle = await serve(
        { port: 0 },
        async (req) => {
          if (req.method === "POST") {
            const body = await req.text();
            return new Response(`Received: ${body}`);
          }
          return new Response("Not POST");
        },
      );

      const response = await fetch(`http://localhost:${handle.port}`, {
        method: "POST",
        body: "test data",
      });
      const text = await response.text();
      expect(text).toBe("Received: test data");

      await handle.shutdown();
    });

    it("应该可以关闭服务器", async () => {
      const handle = await serve(
        { port: 0 },
        () => new Response("OK"),
      );

      await handle.shutdown();

      // 服务器关闭后，请求应该失败
      try {
        await fetch(`http://localhost:${handle.port}`);
        expect.fail("请求应该失败");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it("应该支持自定义主机名", async () => {
      const handle = await serve(
        { hostname: "127.0.0.1", port: 0 },
        () => new Response("OK"),
      );
      expect(handle).toBeTruthy();
      await handle.shutdown();
    });
  });
});
