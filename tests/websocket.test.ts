/**
 * @fileoverview WebSocket API 测试
 */

import { describe, expect, it } from "@dreamer/test";
import { IS_BUN, IS_DENO } from "../src/detect.ts";
import { serve, upgradeWebSocket } from "../src/network.ts";

/**
 * 获取可用端口
 */
function getAvailablePort(): number {
  return 30000 + Math.floor(Math.random() * 30000);
}

/**
 * 创建 WebSocket 客户端连接
 */
function createWebSocketClient(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onopen = () => resolve(ws);
    ws.onerror = (error) => reject(error);
  });
}

/**
 * 等待消息
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
  });
}

describe("WebSocket API", () => {
  describe("upgradeWebSocket", () => {
    it("应该升级 WebSocket 连接（Deno）", async () => {
      if (!IS_DENO) {
        console.log("跳过 Deno 特定测试");
        return;
      }

      const testPort = getAvailablePort();
      let serverHandle: any = null;

      try {
        serverHandle = serve(
          { port: testPort },
          async (request: Request) => {
            const url = new URL(request.url);
            if (url.pathname === "/ws") {
              try {
                const { socket, response } = upgradeWebSocket(request);

                // 测试 socket 的基本属性
                expect(socket).toBeDefined();
                expect(socket.readyState).toBeDefined();
                expect(typeof socket.readyState).toBe("number");

                // 测试 addEventListener
                let messageReceived = false;
                socket.addEventListener("message", (event) => {
                  // 类型守卫：确保是 MessageEvent
                  if (event instanceof MessageEvent) {
                    messageReceived = true;
                    expect(event.data).toBe("Hello from client");
                  }
                });

                // 在连接建立后发送消息
                socket.addEventListener("open", () => {
                  // 连接建立后，等待更长时间确保客户端也准备好了
                  setTimeout(() => {
                    socket.send("Hello from server");
                  }, 300);
                });

                // 必须立即返回 response，不能等待
                // 在 Bun 环境下，response 为 undefined，让 Bun 自动处理响应
                if (response === undefined) {
                  return undefined; // Bun 会自动处理 WebSocket 升级响应
                }
                return response;
              } catch (error) {
                console.error("WebSocket 升级失败:", error);
                return new Response("WebSocket upgrade failed", {
                  status: 500,
                });
              }
            }
            return new Response("Not Found", { status: 404 });
          },
        );

        // 等待服务器启动
        await new Promise((resolve) => setTimeout(resolve, 200));

        // 创建客户端连接
        const ws = await createWebSocketClient(`ws://localhost:${testPort}/ws`);

        // 等待连接建立
        await new Promise((resolve) => setTimeout(resolve, 300));

        // 设置消息监听器（在连接建立之前）
        let serverMessageReceived = false;
        ws.onmessage = (event) => {
          if (event.data === "Hello from server") {
            serverMessageReceived = true;
          }
        };

        // 发送消息
        ws.send("Hello from client");

        // 等待服务器消息（增加等待时间，确保服务器消息已发送）
        await new Promise((resolve) => setTimeout(resolve, 800));
        expect(serverMessageReceived).toBe(true);

        ws.close();
        await new Promise((resolve) => setTimeout(resolve, 100));
      } finally {
        if (serverHandle) {
          await serverHandle.shutdown();
        }
      }
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该升级 WebSocket 连接（Bun）", async () => {
      if (!IS_BUN) {
        console.log("跳过 Bun 特定测试");
        return;
      }

      const testPort = getAvailablePort();
      let serverHandle: any = null;

      try {
        serverHandle = serve(
          { port: testPort },
          async (request: Request) => {
            const url = new URL(request.url);
            if (url.pathname === "/ws") {
              try {
                const { socket, response } = upgradeWebSocket(request);

                // 测试 socket 的基本属性
                expect(socket).toBeDefined();
                expect(socket.readyState).toBeDefined();
                expect(typeof socket.readyState).toBe("number");

                // 测试 addEventListener（Bun 环境下应该通过适配器支持）
                let messageReceived = false;
                socket.addEventListener("message", (event) => {
                  // 类型守卫：确保是 MessageEvent
                  if (event instanceof MessageEvent) {
                    messageReceived = true;
                    expect(event.data).toBe("Hello from client");
                  }
                });

                // 在连接建立后发送消息
                socket.addEventListener("open", () => {
                  // 连接建立后，等待一小段时间确保连接完全就绪
                  setTimeout(() => {
                    socket.send("Hello from server");
                  }, 200);
                });

                // 在 Bun 环境下，response 为 undefined，让 Bun 自动处理响应
                // 在 Deno 环境下，返回 response
                if (response === undefined) {
                  return undefined; // Bun 会自动处理 WebSocket 升级响应
                }
                return response;
              } catch (error) {
                console.error("WebSocket 升级失败:", error);
                return new Response("WebSocket upgrade failed", {
                  status: 500,
                });
              }
            }
            return new Response("Not Found", { status: 404 });
          },
        );

        // 等待服务器启动
        await new Promise((resolve) => setTimeout(resolve, 200));

        // 创建客户端连接
        const ws = await createWebSocketClient(`ws://localhost:${testPort}/ws`);

        // 等待连接建立
        await new Promise((resolve) => setTimeout(resolve, 200));

        // 发送消息
        ws.send("Hello from client");

        // 设置消息监听器（在连接建立之前）
        let serverMessageReceived = false;
        ws.onmessage = (event) => {
          if (event.data === "Hello from server") {
            serverMessageReceived = true;
          }
        };

        // 等待服务器消息（增加等待时间，确保服务器消息已发送）
        await new Promise((resolve) => setTimeout(resolve, 800));
        expect(serverMessageReceived).toBe(true);

        ws.close();
        await new Promise((resolve) => setTimeout(resolve, 100));
      } finally {
        if (serverHandle) {
          await serverHandle.shutdown();
        }
      }
    });

    it("应该支持 addEventListener API", async () => {
      const testPort = getAvailablePort();
      let serverHandle: any = null;

      try {
        serverHandle = serve(
          { port: testPort },
          async (request: Request) => {
            const url = new URL(request.url);
            if (url.pathname === "/ws") {
              try {
                const { socket, response } = upgradeWebSocket(request);

                // 测试 addEventListener
                const events: string[] = [];
                socket.addEventListener("message", () => {
                  events.push("message");
                });
                socket.addEventListener("close", () => {
                  events.push("close");
                });
                socket.addEventListener("error", () => {
                  events.push("error");
                });

                // 在连接建立后发送消息
                // 使用标志避免重复发送
                let messageSent = false;
                const sendMessage = () => {
                  if (messageSent) return;
                  messageSent = true;
                  // 增加延迟，确保客户端连接完全建立并准备好接收消息
                  setTimeout(() => {
                    try {
                      if (socket.readyState === WebSocket.OPEN) {
                        socket.send("test");
                      }
                    } catch (e) {
                      console.error("服务器发送消息失败:", e);
                    }
                  }, 500);
                };

                // 使用 addEventListener("open", ...) 确保在连接完全建立后发送
                socket.addEventListener("open", sendMessage);

                // 如果 socket 已经处于 OPEN 状态，open 事件可能不会触发
                // 所以我们需要直接发送消息（使用延迟确保客户端准备好）
                if (socket.readyState === WebSocket.OPEN) {
                  sendMessage();
                }

                // 必须立即返回 response，不能等待
                // 在 Bun 环境下，response 为 undefined，让 Bun 自动处理响应
                if (response === undefined) {
                  return undefined; // Bun 会自动处理 WebSocket 升级响应
                }
                return response;
              } catch (error) {
                console.error("WebSocket 升级失败:", error);
                return new Response("WebSocket upgrade failed", {
                  status: 500,
                });
              }
            }
            return new Response("Not Found", { status: 404 });
          },
        );

        // 等待服务器启动
        await new Promise((resolve) => setTimeout(resolve, 200));

        // 创建客户端连接
        const ws = await createWebSocketClient(`ws://localhost:${testPort}/ws`);

        // 立即设置消息监听器（在连接建立之前）
        let testMessageReceived = false;
        ws.onmessage = (event) => {
          if (event.data === "test") {
            testMessageReceived = true;
          }
        };

        // 等待连接建立（服务器在连接建立后 500ms 发送消息）
        await new Promise((resolve) => setTimeout(resolve, 800));

        // 发送消息（触发服务器的 message 事件）
        ws.send("test");

        // 等待服务器消息（增加等待时间，确保服务器消息已发送）
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // 验证是否收到消息
        expect(testMessageReceived).toBe(true);

        ws.close();
        await new Promise((resolve) => setTimeout(resolve, 100));
      } finally {
        if (serverHandle) {
          await serverHandle.shutdown();
        }
      }
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该支持 send 方法", async () => {
      const testPort = getAvailablePort();
      let serverHandle: any = null;

      try {
        serverHandle = serve(
          { port: testPort },
          async (request: Request) => {
            const url = new URL(request.url);
            if (url.pathname === "/ws") {
              try {
                const { socket, response } = upgradeWebSocket(request);

                // 在连接建立后发送消息
                // 使用标志避免重复发送
                let messagesSent = false;
                const sendMessages = () => {
                  if (messagesSent) return;
                  messagesSent = true;
                  // 等待一小段时间确保连接完全就绪
                  setTimeout(() => {
                    // 测试发送文本消息
                    try {
                      if (socket.readyState === WebSocket.OPEN) {
                        socket.send("text message");
                      }
                    } catch (e) {
                      console.error("发送第一条消息失败:", e);
                    }

                    // 稍后发送第二条消息（增加延迟，确保第一条消息先到达）
                    setTimeout(() => {
                      try {
                        if (socket.readyState === WebSocket.OPEN) {
                          socket.send(
                            JSON.stringify({ type: "test", data: "hello" }),
                          );
                        }
                      } catch (e) {
                        console.error("发送第二条消息失败:", e);
                      }
                    }, 400);
                  }, 400);
                };

                // 使用 addEventListener("open", ...) 确保在连接完全建立后发送
                socket.addEventListener("open", sendMessages);

                // 如果 socket 已经处于 OPEN 状态，open 事件可能不会触发
                // 所以我们需要直接发送消息
                if (socket.readyState === WebSocket.OPEN) {
                  sendMessages();
                }

                // 在收到第一条消息时也发送（作为备选，处理 open 事件未触发的情况）
                socket.addEventListener("message", () => {
                  if (!messagesSent) {
                    sendMessages();
                  }
                });

                // 必须立即返回 response，不能等待
                // 在 Bun 环境下，response 为 undefined，让 Bun 自动处理响应
                if (response === undefined) {
                  return undefined; // Bun 会自动处理 WebSocket 升级响应
                }
                return response;
              } catch (error) {
                console.error("WebSocket 升级失败:", error);
                return new Response("WebSocket upgrade failed", {
                  status: 500,
                });
              }
            }
            return new Response("Not Found", { status: 404 });
          },
        );

        // 等待服务器启动
        await new Promise((resolve) => setTimeout(resolve, 200));

        // 创建客户端连接
        const ws = await createWebSocketClient(`ws://localhost:${testPort}/ws`);

        // 立即设置消息监听器（在连接建立之前），确保不会错过任何消息
        const messages: string[] = [];
        ws.onmessage = (event) => {
          messages.push(event.data as string);
        };

        // 等待连接建立
        await new Promise((resolve) => setTimeout(resolve, 600));

        // 发送消息触发服务器的 message 事件（这样服务器才会发送消息）
        ws.send("trigger");

        // 等待消息（增加超时时间，确保两条消息都能收到）
        // 服务器在收到消息后 400ms 发送第一条，800ms 发送第二条，所以需要等待至少 1200ms
        await new Promise((resolve) => setTimeout(resolve, 1800));

        // 验证收到的消息
        expect(messages.length).toBeGreaterThanOrEqual(1);
        expect(messages).toContain("text message");

        // 检查是否有 JSON 消息
        const jsonMessage = messages.find((msg) => {
          try {
            const data = JSON.parse(msg);
            return data.type === "test" && data.data === "hello";
          } catch {
            return false;
          }
        });
        expect(jsonMessage).toBeDefined();

        ws.close();
        await new Promise((resolve) => setTimeout(resolve, 100));
      } finally {
        if (serverHandle) {
          await serverHandle.shutdown();
        }
      }
    });

    it("应该支持 close 方法", async () => {
      const testPort = getAvailablePort();
      let serverHandle: any = null;

      try {
        serverHandle = serve(
          { port: testPort },
          async (request: Request) => {
            const url = new URL(request.url);
            if (url.pathname === "/ws") {
              try {
                const { socket, response } = upgradeWebSocket(request);

                // 在连接建立后关闭连接
                // 使用标志避免重复关闭
                let closed = false;
                const closeConnection = () => {
                  if (closed) return;
                  closed = true;
                  // 等待一小段时间确保连接完全建立
                  setTimeout(() => {
                    try {
                      if (socket.readyState === WebSocket.OPEN) {
                        socket.close(1000, "Normal closure");
                      }
                    } catch (e) {
                      console.error("关闭连接失败:", e);
                    }
                  }, 300);
                };

                // 使用 addEventListener("open", ...) 确保在连接完全建立后关闭
                socket.addEventListener("open", closeConnection);

                // 如果 socket 已经处于 OPEN 状态，open 事件可能不会触发
                // 所以我们需要直接关闭
                if (socket.readyState === WebSocket.OPEN) {
                  closeConnection();
                }

                // 在收到第一条消息时也关闭（作为备选，处理 open 事件未触发的情况）
                socket.addEventListener("message", () => {
                  if (!closed) {
                    closeConnection();
                  }
                });

                // 必须立即返回 response，不能等待
                // 在 Bun 环境下，response 为 undefined，让 Bun 自动处理响应
                if (response === undefined) {
                  return undefined; // Bun 会自动处理 WebSocket 升级响应
                }
                return response;
              } catch (error) {
                console.error("WebSocket 升级失败:", error);
                return new Response("WebSocket upgrade failed", {
                  status: 500,
                });
              }
            }
            return new Response("Not Found", { status: 404 });
          },
        );

        // 等待服务器启动
        await new Promise((resolve) => setTimeout(resolve, 200));

        // 创建客户端连接
        const ws = await createWebSocketClient(`ws://localhost:${testPort}/ws`);

        // 等待连接建立
        await new Promise((resolve) => setTimeout(resolve, 600));

        // 发送消息触发服务器的 message 事件（这样服务器才会关闭连接）
        ws.send("trigger");

        // 等待服务器关闭连接（服务器在收到消息后 300ms 关闭）
        // 我们需要等待足够的时间让服务器处理消息并关闭连接
        await new Promise((resolve) => setTimeout(resolve, 800));

        // 验证连接已关闭
        // 注意：在 Bun 环境下，可能需要更多时间让关闭事件传播
        expect(ws.readyState).toBe(WebSocket.CLOSED);

        ws.close();
        await new Promise((resolve) => setTimeout(resolve, 100));
      } finally {
        if (serverHandle) {
          // 添加超时保护，避免 shutdown() 卡住
          try {
            await Promise.race([
              serverHandle.shutdown(),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("shutdown timeout")), 2000)
              ),
            ]);
          } catch (error) {
            // 即使超时也继续，不影响测试结果
          }
        }
      }
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该返回正确的 WebSocketAdapter 类型（Bun）", async () => {
      if (!IS_BUN) {
        console.log("跳过 Bun 特定测试");
        return;
      }

      const testPort = getAvailablePort();
      let serverHandle: any = null;

      try {
        serverHandle = serve(
          { port: testPort },
          async (request: Request) => {
            const url = new URL(request.url);
            if (url.pathname === "/ws") {
              try {
                const { socket, response } = upgradeWebSocket(request);

                // 验证 socket 不是空对象
                expect(socket).toBeDefined();
                expect(socket).not.toEqual({});
                expect(typeof socket).toBe("object");

                // 验证 socket 有 addEventListener 方法
                expect(typeof (socket as any).addEventListener).toBe(
                  "function",
                );
                expect(typeof (socket as any).send).toBe("function");
                expect(typeof (socket as any).close).toBe("function");
                expect(typeof (socket as any).readyState).toBe("number");

                // 验证可以调用 addEventListener
                let testCalled = false;
                (socket as any).addEventListener("message", () => {
                  testCalled = true;
                });
                expect(typeof (socket as any).addEventListener).toBe(
                  "function",
                );

                // 验证对象属性（应该不是空对象）
                const keys = Object.keys(socket);
                const prototypeKeys = Object.getOwnPropertyNames(
                  Object.getPrototypeOf(socket),
                );
                expect(keys.length + prototypeKeys.length).toBeGreaterThan(0);

                if (response === undefined) {
                  return undefined;
                }
                return response;
              } catch (error) {
                console.error("WebSocket 升级失败:", error);
                return new Response("WebSocket upgrade failed", {
                  status: 500,
                });
              }
            }
            return new Response("Not Found", { status: 404 });
          },
        );

        await new Promise((resolve) => setTimeout(resolve, 200));

        const ws = await createWebSocketClient(`ws://localhost:${testPort}/ws`);
        await new Promise((resolve) => setTimeout(resolve, 100));
        ws.close();
        await new Promise((resolve) => setTimeout(resolve, 100));
      } finally {
        if (serverHandle) {
          try {
            await Promise.race([
              serverHandle.shutdown(),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("shutdown timeout")), 2000)
              ),
            ]);
          } catch (error) { /* ignore */ }
        }
      }
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });
});
