/**
 * Node 平台网络 API 冒烟测试（Phase A8）
 *
 * 验证 network.ts 的 Node 分支：serve（HTTP 往返 + POST body）、connect（TCP echo）、
 * upgradeWebSocket（WS 升级双向通信）。仅在 Node 上生效：describe 内 `if (!IS_NODE) return` 早返回。
 */
import assert from "node:assert/strict";
import * as net from "node:net";
import { describe, it } from "node:test";
import { IS_NODE } from "../../src/detect.ts";
import { connect, serve, upgradeWebSocket } from "../../src/network.ts";

const enc = new TextEncoder();
const dec = new TextDecoder();

describe("Node 网络 API 冒烟", () => {
  if (!IS_NODE) return;

  it("serve + fetch HTTP 往返", async () => {
    const handle = serve({ port: 0 }, () => new Response("hello"));
    await new Promise((r) => setTimeout(r, 100));
    const port = handle.port!;
    const res = await fetch(`http://localhost:${port}/`);
    assert.equal(await res.text(), "hello");
    await handle.shutdown();
  });

  it("serve POST body 往返", async () => {
    const handle = serve({ port: 0 }, async (req) => {
      const body = await req.text();
      return new Response(`echo:${body}`);
    });
    await new Promise((r) => setTimeout(r, 100));
    const port = handle.port!;
    const res = await fetch(`http://localhost:${port}/`, {
      method: "POST",
      body: "ping",
    });
    assert.equal(await res.text(), "echo:ping");
    await handle.shutdown();
  });

  it("connect TCP echo 往返", async () => {
    const echoServer = net.createServer((sock) => sock.pipe(sock));
    await new Promise<void>((r) => echoServer.listen(0, "127.0.0.1", r));
    const echoPort = (echoServer.address() as net.AddressInfo).port;

    const conn = await connect({ host: "127.0.0.1", port: echoPort });
    const writer = conn.writable.getWriter();
    await writer.write(enc.encode("ping"));
    const reader = conn.readable.getReader();
    const { value } = await reader.read();
    assert.equal(dec.decode(value), "ping");
    conn.close();
    echoServer.close();
  });

  it("WebSocket 升级往返", async () => {
    const handle = serve({ port: 0 }, (req) => {
      const url = new URL(req.url);
      if (url.pathname === "/ws") {
        const { socket } = upgradeWebSocket(req);
        socket.addEventListener("open", () => {
          setTimeout(() => socket.send("hello from server"), 50);
        });
        return undefined;
      }
      return new Response("ok");
    });
    await new Promise((r) => setTimeout(r, 150));
    const port = handle.port!;

    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => ws.send("hello from client");
      ws.onmessage = (ev: MessageEvent) => {
        if (ev.data === "hello from server") resolve();
      };
      ws.onerror = () => reject(new Error("WS error"));
      setTimeout(() => reject(new Error("WS timeout")), 5000);
    });
    ws.close();
    await handle.shutdown();
  });
});
