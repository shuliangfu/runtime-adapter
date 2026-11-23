/**
 * Concurrent WebSocket upgrades on the same path must not share one adapter.
 */

import { describe, expect, it } from "@dreamer/test";
import { serve, type ServeHandle, upgradeWebSocket } from "../src/network.ts";

async function serveWithSystemPort(
  handler: (
    req: Request,
  ) => Response | Promise<Response> | Promise<Response | undefined> | undefined,
): Promise<{ handle: ServeHandle; port: number }> {
  const handle = await serve({ port: 0 }, handler);
  const port = handle.port;
  if (!port || port === 0) {
    throw new Error("系统未分配端口");
  }
  return { handle, port };
}

function createWebSocketClient(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onopen = () => resolve(ws);
    ws.onerror = (error) => reject(error);
  });
}

function waitForMessage(ws: WebSocket, timeout = 5000): Promise<MessageEvent> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("等待消息超时"));
    }, timeout);
    ws.onmessage = (event) => {
      clearTimeout(timer);
      resolve(event);
    };
  });
}

describe("并发同路径 WebSocket 升级", () => {
  it("同一路径两条连接应各自独立回显", async () => {
    const { handle, port } = await serveWithSystemPort((request: Request) => {
      const { socket, response } = upgradeWebSocket(request);
      // Node 的 ws 包发出的 MessageEvent 与全局 MessageEvent 不同源，
      // instanceof 为 false；用 data 字段判断即可，三端一致。
      socket.addEventListener("message", (event) => {
        const data = (event as MessageEvent).data;
        if (data !== undefined) {
          socket.send(`echo:${data}`);
        }
      });
      if (response === undefined) {
        return undefined;
      }
      return response;
    });

    let a: WebSocket | undefined;
    let b: WebSocket | undefined;
    try {
      [a, b] = await Promise.all([
        createWebSocketClient(`ws://127.0.0.1:${port}/ws`),
        createWebSocketClient(`ws://127.0.0.1:${port}/ws`),
      ]);
      const pa = waitForMessage(a);
      const pb = waitForMessage(b);
      a.send("A");
      b.send("B");
      const [ma, mb] = await Promise.all([pa, pb]);
      expect(String(ma.data)).toBe("echo:A");
      expect(String(mb.data)).toBe("echo:B");
    } finally {
      try {
        a?.close();
      } catch { /* ignore */ }
      try {
        b?.close();
      } catch { /* ignore */ }
      await handle.shutdown();
    }
  }, {
    sanitizeOps: false,
    sanitizeResources: false,
  });
});
