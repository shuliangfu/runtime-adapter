/**
 * @fileoverview 网络 API 测试
 */

import { describe, expect, it } from "@dreamer/test";
import { isWsOriginAllowed, serve, type ServeHandle } from "../src/network.ts";

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
        { host: "127.0.0.1", port: 0 },
        () => new Response("OK"),
      );
      expect(handle).toBeTruthy();
      await handle.shutdown();
    });
  });

  describe("handle.finished", () => {
    it("shutdown 后 finished 应 resolve", async () => {
      const handle = await serve(
        { port: 0 },
        () => new Response("OK"),
      );
      let resolved = false;
      const finished = handle.finished.then(() => {
        resolved = true;
      });
      expect(resolved).toBe(false);
      await handle.shutdown();
      await Promise.race([
        finished,
        new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error("finished 未在 shutdown 后 resolve")),
            5000,
          );
        }),
      ]);
      expect(resolved).toBe(true);
    });
  });
});

describe("WebSocket Origin 校验", () => {
  it("无 Origin 应放行（非浏览器客户端）", () => {
    expect(isWsOriginAllowed(null, "localhost:3000")).toBe(true);
    expect(isWsOriginAllowed(undefined, "localhost:3000")).toBe(true);
    expect(isWsOriginAllowed("", "localhost:3000")).toBe(true);
  });

  it("allowedOrigins Set 精确匹配，未列出的 Origin 拒绝，无 Origin 仍放行", () => {
    const allowed = new Set(["http://a.example", "null"]);
    expect(isWsOriginAllowed("http://a.example", "victim.example", allowed))
      .toBe(true);
    expect(isWsOriginAllowed("null", "victim.example", allowed)).toBe(true);
    expect(isWsOriginAllowed("http://evil.example", "victim.example", allowed))
      .toBe(false);
    expect(isWsOriginAllowed(null, "victim.example", allowed)).toBe(true);
  });

  it("未配置 allowedOrigins 时默认同源校验不变", () => {
    expect(isWsOriginAllowed("http://localhost:3000", "localhost:3000")).toBe(
      true,
    );
    expect(isWsOriginAllowed("http://localhost", "localhost")).toBe(true);
    expect(isWsOriginAllowed("http://evil.example", "localhost:3000")).toBe(
      false,
    );
    expect(isWsOriginAllowed("null", "localhost:3000")).toBe(false);
    expect(isWsOriginAllowed("http://localhost:3000", null)).toBe(false);
  });
});
