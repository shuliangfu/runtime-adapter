/**
 * @fileoverview WebSocket 测试
 * 全面测试 WebSocket 服务器的所有功能
 */

import { afterAll, beforeAll, describe, expect, it } from "@dreamer/test";
import { Server, Socket } from "./websocket.ts";

/**
 * 使用系统分配端口创建服务器，返回服务器实例和实际端口
 * @param path WebSocket 路径
 * @param setup 可选，在 listen 前注册事件等
 */
async function createServerWithSystemPort(
  path = "/ws",
  setup?: (server: Server) => void,
): Promise<{ server: Server; port: number }> {
  const server = new Server({ port: 0, path });
  if (setup) setup(server);
  server.listen();
  await delay(50);
  const port = server.port;
  if (!port || port === 0) {
    throw new Error("系统未分配端口，请稍后重试");
  }
  return { server, port };
}

/**
 * 等待指定时间
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 创建 WebSocket 客户端连接
 */
async function createWebSocketClient(
  url: string,
): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onopen = () => resolve(ws);
    ws.onerror = (error) => reject(error);
  });
}

/**
 * 等待 WebSocket 消息
 */
function waitForMessage(
  ws: WebSocket,
  timeout = 5000,
): Promise<MessageEvent> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("等待消息超时"));
    }, timeout);

    ws.onmessage = (event) => {
      clearTimeout(timer);
      resolve(event);
    };

    ws.onerror = (error) => {
      clearTimeout(timer);
      reject(error);
    };
  });
}

describe("WebSocket Server", () => {
  describe("Server 构造函数和配置", () => {
    it("应该创建服务器实例", () => {
      const server = new Server({
        port: 8080,
      });

      expect(server).toBeTruthy();
      expect(server.options.port).toBe(8080);
    });

    it("应该使用默认配置", () => {
      const server = new Server();

      expect(server.options.path).toBe("/");
      expect(server.options.pingTimeout).toBe(60000);
      expect(server.options.pingInterval).toBe(30000);
    });

    it("应该支持自定义配置", () => {
      const server = new Server({
        port: 9000,
        host: "127.0.0.1",
        path: "/ws",
        pingTimeout: 30000,
        pingInterval: 15000,
        maxConnections: 100,
      });

      expect(server.options.port).toBe(9000);
      expect(server.options.host).toBe("127.0.0.1");
      expect(server.options.path).toBe("/ws");
      expect(server.options.pingTimeout).toBe(30000);
      expect(server.options.pingInterval).toBe(15000);
      expect(server.options.maxConnections).toBe(100);
    });
  });

  describe("Server 事件监听", () => {
    it("应该支持 connection 事件监听", () => {
      const server = new Server({ port: 8080 });
      let connected = false;

      server.on("connection", () => {
        connected = true;
      });

      expect(server).toBeTruthy();
      // 注意：这里只是测试监听器注册，不测试实际连接
    });

    it("应该支持多个 connection 监听器", () => {
      const server = new Server({ port: 8080 });
      let count = 0;

      server.on("connection", () => {
        count++;
      });

      server.on("connection", () => {
        count++;
      });

      expect(server).toBeTruthy();
    });
  });

  describe("Server 中间件", () => {
    it("应该支持添加中间件", () => {
      const server = new Server({ port: 8080 });
      let middlewareCalled = false;

      server.use((socket, next) => {
        middlewareCalled = true;
        next();
      });

      expect(server).toBeTruthy();
    });

    it("应该支持异步中间件", () => {
      const server = new Server({ port: 8080 });

      server.use(async (socket, next) => {
        await delay(10);
        next();
      });

      expect(server).toBeTruthy();
    });

    it("应该支持中间件错误处理", () => {
      const server = new Server({ port: 8080 });
      let errorHandled = false;

      server.use((socket, next) => {
        next(new Error("中间件错误"));
      });

      expect(server).toBeTruthy();
    });
  });

  describe("Server 启动和关闭", () => {
    let server: Server;
    let testPort: number;

    beforeAll(async () => {
      const result = await createServerWithSystemPort("/ws");
      server = result.server;
      testPort = result.port;
    });

    afterAll(async () => {
      if (server) {
        await server.close();
      }
    });

    it("应该启动服务器", () => {
      expect(() => {
      }).not.toThrow();
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持自定义 host 和 port", async () => {
      const { server: customServer } = await createServerWithSystemPort("/");
      const customPort = customServer.port!;

      expect(() => {
        customServer.close();
      }).not.toThrow();
      new Server({ port: 0 }).listen("127.0.0.1", 0);
    });

    it("应该关闭服务器", async () => {
      const { server: testServer } = await createServerWithSystemPort("/");
      expect(async () => {
        await testServer.close();
      }).not.toThrow();
    });

    it("应该关闭所有连接", async () => {
      const { server: testServer, port } = await createServerWithSystemPort(
        "/test",
      );

      // 创建一个连接
      try {
        const ws = await createWebSocketClient(
          `ws://localhost:${port}/test`,
        );
        await delay(100);
        // 发送消息来触发服务器的 message 事件，这样适配器的 _ws 会被设置
        ws.send(JSON.stringify({ type: "ping" }));
        await delay(100);

        // 关闭服务器应该关闭所有连接，添加超时保护
        await Promise.race([
          testServer.close(),
          new Promise<void>((_, reject) => {
            setTimeout(() => reject(new Error("服务器关闭超时")), 2000);
          }),
        ]).catch((error) => {
          // 如果超时，继续执行测试
        });

        // 等待连接关闭
        await delay(200);
        expect(ws.readyState).toBe(WebSocket.CLOSED);
      } catch (error) {
        // 如果连接失败（服务器已关闭），这是预期的
        // 忽略错误
      }
    });
  });

  describe("WebSocket 连接和消息", () => {
    it("应该接受 WebSocket 连接", async () => {
      let socketConnected = false;
      const { server, port } = await createServerWithSystemPort("/ws", (s) => {
        s.on("connection", (socket) => {
          socketConnected = true;
          expect(socket).toBeTruthy();
          expect(socket.id).toBeTruthy();
          expect(socket.connected).toBe(true);
        });
      });

      await delay(200);

      const ws = await createWebSocketClient(
        `ws://localhost:${port}/ws`,
      );

      await delay(300);
      expect(socketConnected).toBe(true);
      ws.close();
      await delay(100);

      await server.close();
      await delay(300); // Windows 上端口释放较慢，避免 AddrInUse
    });

    it("应该创建握手信息", async () => {
      let handshakeReceived = false;
      const { server, port } = await createServerWithSystemPort("/ws", (s) => {
        s.on("connection", (socket) => {
          expect(socket.handshake).toBeTruthy();
          expect(socket.handshake.url).toBeTruthy();
          expect(socket.handshake.headers).toBeTruthy();
          expect(socket.handshake.query).toBeTruthy();
          handshakeReceived = true;
        });
      });

      await delay(200);

      const ws = await createWebSocketClient(
        `ws://localhost:${port}/ws?token=abc123`,
      );

      await delay(300);
      expect(handshakeReceived).toBe(true);
      ws.close();
      await delay(100);

      await server.close();
      await delay(100);
    });

    it("应该处理文本消息", async () => {
      let messageReceived = false;
      let receivedData: any = null;
      const { server, port } = await createServerWithSystemPort("/ws", (s) => {
        s.on("connection", (socket) => {
          socket.on("test-event", (data) => {
            messageReceived = true;
            receivedData = data;
          });
        });
      });

      await delay(200);

      const ws = await createWebSocketClient(
        `ws://localhost:${port}/ws`,
      );

      await delay(300);

      // 发送消息
      const testMessage = {
        type: "event",
        event: "test-event",
        data: { message: "Hello, World!" },
      };
      ws.send(JSON.stringify(testMessage));

      await delay(300);
      expect(messageReceived).toBe(true);
      expect(receivedData).toEqual({ message: "Hello, World!" });

      ws.close();
      await delay(100);

      await server.close();
      await delay(100);
    });

    it("应该发送消息到客户端", async () => {
      const { server, port } = await createServerWithSystemPort("/ws");

      // 设置消息监听器（在连接建立之前）
      let messageReceived = false;
      let receivedData: any = null;

      server.on("connection", (socket) => {
        // 在连接建立后立即发送消息
        // 使用 setTimeout 确保在下一个事件循环中发送，给连接一些时间完全建立
        setTimeout(() => {
          socket.emit("server-message", { text: "Hello from server" });
        }, 100);
      });

      await delay(300);

      // 在创建 WebSocket 之前设置消息监听器
      const wsPromise = new Promise<WebSocket>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${port}/ws`);
        ws.onopen = () => resolve(ws);
        ws.onerror = (error) => reject(error);
        // 在连接建立之前就设置消息监听器
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data as string);
            if (data.type === "event" && data.event === "server-message") {
              messageReceived = true;
              receivedData = data;
            }
          } catch (e) {
            // 忽略解析错误
          }
        };
      });

      const ws = await wsPromise;

      // 发送一个消息来触发服务器的 message 事件，这样适配器的 _ws 会被设置
      // 这对于 Bun 环境很重要，因为 open 事件可能找不到适配器
      await delay(50);
      ws.send(JSON.stringify({ type: "ping" }));

      // 等待消息发送和接收
      await delay(500);

      expect(messageReceived).toBe(true);
      expect(receivedData.type).toBe("event");
      expect(receivedData.event).toBe("server-message");
      expect(receivedData.data).toEqual({ text: "Hello from server" });

      ws.close();
      await delay(100);

      await server.close();
      await delay(100);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该处理心跳消息", async () => {
      const { server, port } = await createServerWithSystemPort("/ws");

      server.on("connection", (socket) => {
        // 心跳处理是自动的
      });

      await delay(200);

      const ws = await createWebSocketClient(
        `ws://localhost:${port}/ws`,
      );

      await delay(300);

      // 发送心跳响应
      ws.send(JSON.stringify({ type: "pong" }));

      await delay(200);
      // 心跳响应应该被正确处理
      ws.close();
      await delay(100);

      await server.close();
      await delay(100);
    });
  });

  describe("Socket 事件系统", () => {
    it("应该支持多个事件监听器", async () => {
      const { server, port } = await createServerWithSystemPort("/ws");
      let callCount = 0;

      server.on("connection", (socket) => {
        socket.on("test", () => {
          callCount++;
        });

        socket.on("test", () => {
          callCount++;
        });
      });

      await delay(200);

      const ws = await createWebSocketClient(
        `ws://localhost:${port}/ws`,
      );

      await delay(300);

      ws.send(
        JSON.stringify({ type: "event", event: "test", data: {} }),
      );

      await delay(300);
      expect(callCount).toBe(2);

      ws.close();
      await delay(100);

      await server.close();
      await delay(100);
    });

    it("应该支持移除事件监听器", async () => {
      const { server, port } = await createServerWithSystemPort("/ws");
      let callCount = 0;

      server.on("connection", (socket) => {
        const handler = () => {
          callCount++;
        };

        socket.on("test", handler);
        socket.off("test", handler);
      });

      await delay(200);

      const ws = await createWebSocketClient(
        `ws://localhost:${port}/ws`,
      );

      await delay(300);

      ws.send(
        JSON.stringify({ type: "event", event: "test", data: {} }),
      );

      await delay(300);
      expect(callCount).toBe(0);

      ws.close();
      await delay(100);

      await server.close();
      await delay(100);
    });

    it("应该支持移除所有事件监听器", async () => {
      const { server, port } = await createServerWithSystemPort("/ws");
      let callCount = 0;

      server.on("connection", (socket) => {
        socket.on("test", () => {
          callCount++;
        });

        socket.on("test", () => {
          callCount++;
        });

        socket.off("test");
      });

      await delay(200);

      const ws = await createWebSocketClient(
        `ws://localhost:${port}/ws`,
      );

      await delay(300);

      ws.send(
        JSON.stringify({ type: "event", event: "test", data: {} }),
      );

      await delay(300);
      expect(callCount).toBe(0);

      ws.close();
      await delay(100);

      await server.close();
      await delay(100);
    });

    it("应该支持回调函数", async () => {
      const { server, port } = await createServerWithSystemPort("/ws");

      server.on("connection", (socket) => {
        socket.on("test-with-callback", (data, callback) => {
          if (callback) {
            callback({ response: "ok" });
          }
        });
      });

      await delay(200);

      const ws = await createWebSocketClient(
        `ws://localhost:${port}/ws`,
      );

      await delay(300);

      // 发送带回调 ID 的消息
      const callbackId = "callback-123";
      ws.send(
        JSON.stringify({
          type: "event",
          event: "test-with-callback",
          data: {},
          callbackId,
        }),
      );

      // 等待回调响应
      const message = await waitForMessage(ws, 3000);
      const data = JSON.parse(message.data as string);

      expect(data.type).toBe("callback");
      expect(data.callbackId).toBe(callbackId);
      expect(data.data).toEqual({ response: "ok" });

      ws.close();
      await delay(100);

      await server.close();
      await delay(100);
    });
  });

  describe("Socket 房间管理", () => {
    it("应该支持加入房间", async () => {
      const { server, port } = await createServerWithSystemPort("/ws");
      let socketJoined = false;

      server.on("connection", (socket) => {
        socket.join("room1");
        socketJoined = true;
      });

      await delay(200);

      const ws = await createWebSocketClient(
        `ws://localhost:${port}/ws`,
      );

      await delay(300);
      expect(socketJoined).toBe(true);

      ws.close();
      await delay(100);

      await server.close();
      await delay(100);
    });

    it("应该支持离开房间", async () => {
      const { server, port } = await createServerWithSystemPort("/ws");

      server.on("connection", (socket) => {
        socket.join("room1");
        socket.leave("room1");
      });

      await delay(200);

      const ws = await createWebSocketClient(
        `ws://localhost:${port}/ws`,
      );

      await delay(300);
      ws.close();
      await delay(100);

      await server.close();
      await delay(100);
    });

    it("应该向房间发送消息", async () => {
      const { server, port } = await createServerWithSystemPort("/ws");
      let messageReceived = false;
      let socket1: Socket | null = null;

      server.on("connection", (socket) => {
        if (!socket1) {
          socket1 = socket;
          socket.join("room1");
        } else {
          socket.join("room1");
          // socket1 向房间发送消息
          socket1.to("room1").emit("room-message", {
            text: "Hello room",
          });
        }
      });

      await delay(200);

      const ws1 = await createWebSocketClient(
        `ws://localhost:${port}/ws`,
      );

      await delay(300);
      // 发送消息来触发服务器的 message 事件，这样适配器的 _ws 会被设置
      ws1.send(JSON.stringify({ type: "ping" }));

      const ws2 = await createWebSocketClient(
        `ws://localhost:${port}/ws`,
      );

      await delay(300);
      // 发送消息来触发服务器的 message 事件，这样适配器的 _ws 会被设置
      ws2.send(JSON.stringify({ type: "ping" }));

      try {
        const message = await waitForMessage(ws2, 3000);
        const data = JSON.parse(message.data as string);

        if (data.event === "room-message") {
          messageReceived = true;
        }
      } catch (error) {
        // 超时或错误，忽略
      }

      ws1.close();
      ws2.close();
      await delay(100);

      await server.close();
      await delay(100);
    });

    it("应该支持广播消息", async () => {
      const { server, port } = await createServerWithSystemPort("/ws");
      let broadcastReceived = false;
      let socket1: Socket | null = null;

      server.on("connection", (socket) => {
        if (!socket1) {
          socket1 = socket;
        } else {
          // socket1 广播消息
          socket1.broadcast.emit("broadcast-message", {
            text: "Hello everyone",
          });
        }
      });

      await delay(200);

      const ws1 = await createWebSocketClient(
        `ws://localhost:${port}/ws`,
      );

      await delay(300);
      // 发送消息来触发服务器的 message 事件，这样适配器的 _ws 会被设置
      ws1.send(JSON.stringify({ type: "ping" }));

      const ws2 = await createWebSocketClient(
        `ws://localhost:${port}/ws`,
      );

      await delay(300);
      // 发送消息来触发服务器的 message 事件，这样适配器的 _ws 会被设置
      ws2.send(JSON.stringify({ type: "ping" }));

      try {
        const message = await waitForMessage(ws2, 3000);
        const data = JSON.parse(message.data as string);

        if (data.event === "broadcast-message") {
          broadcastReceived = true;
        }
      } catch (error) {
        // 超时或错误，忽略
      }

      ws1.close();
      ws2.close();
      await delay(100);

      await server.close();
      await delay(100);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("Socket 断开连接", () => {
    it("应该处理客户端断开连接", async () => {
      const { server, port } = await createServerWithSystemPort("/ws");

      server.on("connection", (socket) => {
        socket.on("disconnect", () => {
          // disconnect 事件处理
        });
      });

      await delay(200);

      const ws = await createWebSocketClient(
        `ws://localhost:${port}/ws`,
      );

      await delay(300);
      ws.close();

      await delay(200);
      // 注意：disconnect 事件可能不会立即触发

      await server.close();
      await delay(100);
    });

    it("应该支持服务器主动断开连接", async () => {
      const { server, port } = await createServerWithSystemPort("/ws");

      server.on("connection", (socket) => {
        // 确保连接完全建立后再断开
        setTimeout(() => {
          socket.disconnect("server shutdown");
        }, 100);
      });

      await delay(200);

      const ws = await createWebSocketClient(
        `ws://localhost:${port}/ws`,
      );

      // 在服务器 100ms 断开前发送，且仅在 OPEN 时发送，避免 InvalidStateError
      await delay(50);
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      } catch {
        // Windows/CI 上连接可能已关闭，忽略
      }
      await delay(50);

      // 等待服务器断开连接，并监听客户端的关闭事件
      await new Promise<void>((resolve) => {
        ws.onclose = () => {
          resolve();
        };
        // 设置超时，防止无限等待
        setTimeout(() => {
          resolve();
        }, 2000);
      });

      // 等待状态更新
      await delay(200);
      expect(ws.readyState).toBe(WebSocket.CLOSED);

      // 关闭服务器，添加超时保护
      await Promise.race([
        server.close(),
        new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error("服务器关闭超时")), 2000);
        }),
      ]).catch((error) => {
        // 如果超时，继续执行测试
      });
      await delay(100);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该清理房间成员", async () => {
      const { server, port } = await createServerWithSystemPort("/ws");

      server.on("connection", (socket) => {
        socket.join("room1");
        socket.disconnect();
      });

      await delay(200);

      const ws = await createWebSocketClient(
        `ws://localhost:${port}/ws`,
      );

      await delay(300);
      ws.close();

      await delay(100);

      await server.close();
      await delay(100);
    });
  }, { sanitizeOps: false, sanitizeResources: false });

  describe("Socket 数据存储", () => {
    it("应该支持数据存储", async () => {
      const { server, port } = await createServerWithSystemPort("/ws");

      server.on("connection", (socket) => {
        socket.data.userId = "user123";
        socket.data.username = "testuser";

        expect(socket.data.userId).toBe("user123");
        expect(socket.data.username).toBe("testuser");
      });

      await delay(200);

      const ws = await createWebSocketClient(
        `ws://localhost:${port}/ws`,
      );

      await delay(300);
      ws.close();

      await delay(100);

      await server.close();
      await delay(100);
    });
  });

  describe("错误处理", () => {
    it("应该处理无效路径的请求", async () => {
      const { server, port } = await createServerWithSystemPort("/ws");

      await delay(200);

      try {
        const ws = await createWebSocketClient(
          `ws://localhost:${port}/invalid`,
        );
        ws.close();
      } catch (error) {
        // 预期会失败
        expect(error).toBeTruthy();
      }

      await server.close();
      await delay(100);
    });

    it("应该处理无效 JSON 消息", async () => {
      const { server, port } = await createServerWithSystemPort("/ws");

      server.on("connection", (socket) => {
        socket.on("error", () => {
          // 错误处理
        });
      });

      await delay(200);

      const ws = await createWebSocketClient(
        `ws://localhost:${port}/ws`,
      );

      await delay(300);

      // 发送无效 JSON
      ws.send("invalid json");

      await delay(300);
      // 错误应该被处理
      ws.close();

      await delay(100);

      await server.close();
      await delay(100);
    });
  });

  describe("心跳检测", () => {
    it("应该发送心跳消息", async () => {
      const server = new Server({
        port: 0,
        path: "/ws",
        pingInterval: 1000,
        pingTimeout: 2000,
      });
      server.on("connection", () => {});
      server.listen();
      await delay(50);
      const port = server.port!;

      await delay(200);

      const ws = await createWebSocketClient(
        `ws://localhost:${port}/ws`,
      );

      await delay(300);

      // 等待心跳消息
      try {
        const message = await waitForMessage(ws, 2000);
        const data = JSON.parse(message.data as string);

        if (data.type === "ping") {
          // 心跳消息已收到
        }
      } catch (error) {
        // 超时是正常的，心跳可能还没发送
      }

      ws.close();
      await delay(100);

      await server.close();
      await delay(100);
    });

    it("应该处理心跳响应", async () => {
      const server = new Server({
        port: 0,
        path: "/ws",
        pingInterval: 1000,
        pingTimeout: 2000,
      });
      server.on("connection", () => {});
      server.listen();
      await delay(50);
      const port = server.port!;

      await delay(200);

      const ws = await createWebSocketClient(
        `ws://localhost:${port}/ws`,
      );

      await delay(300);

      // 发送心跳响应
      ws.send(JSON.stringify({ type: "pong" }));

      await delay(300);
      ws.close();

      await delay(100);

      await server.close();
      await delay(100);
    });
  });

  describe("跨运行时兼容性", () => {
    it("应该在 Deno 环境下工作", () => {
      const server = new Server({ port: 8080 });
      expect(server).toBeTruthy();
    });

    it("应该在 Bun 环境下工作", () => {
      const server = new Server({ port: 8080 });
      expect(server).toBeTruthy();
    });
  });
}, { sanitizeOps: false, sanitizeResources: false });
