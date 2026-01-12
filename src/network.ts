/**
 * 网络 API 适配模块
 * 提供统一的网络操作接口，兼容 Deno 和 Bun
 */

import { IS_BUN, IS_DENO } from "./detect.ts";

/**
 * HTTP 服务器选项
 */
export interface ServeOptions {
  port?: number;
  hostname?: string;
  onListen?: (params: { hostname: string; port: number }) => void;
}

/**
 * HTTP 服务器句柄
 */
export interface ServeHandle {
  finished: Promise<void>;
  shutdown(options?: { graceful?: boolean }): Promise<void>;
  /** 服务器端口号 */
  port?: number;
}

// Bun 环境下，存储 server 实例以便 upgradeWebSocket 使用
// 这是一个全局存储，用于在 serve() 和 upgradeWebSocket() 之间共享 server 实例
let bunServerInstance: any = null;

// Bun 环境下，存储待处理的 WebSocket 适配器
// 当 upgradeWebSocket 被调用时，我们存储适配器，然后在 websocket 处理器中设置实际的 WebSocket
const pendingBunAdapters = new Map<string, WebSocketAdapter>();

/**
 * WebSocket 适配器类
 * 在 Bun 环境下提供 addEventListener API，兼容 Deno 的 WebSocket API
 */
class WebSocketAdapter {
  private _ws: WebSocket | null = null;
  private listeners: Map<string, Set<(event: any) => void>> = new Map();
  private pendingOperations: Array<() => void> = [];
  // 存储所有已创建的适配器（用于 Bun 环境下的查找）
  public static allAdapters: Set<WebSocketAdapter> = new Set();

  constructor(ws?: WebSocket) {
    if (ws) {
      this._ws = ws;
      this.setupEventHandlers();
    }
    // 注册到所有适配器集合中（用于 Bun 环境下的查找）
    WebSocketAdapter.allAdapters.add(this);
  }

  /**
   * 设置实际的 WebSocket（用于 Bun 环境下后续替换）
   */
  setWebSocket(ws: WebSocket): void {
    this._ws = ws;
    this.setupEventHandlers();
    // 执行所有待处理的操作
    for (const op of this.pendingOperations) {
      op();
    }
    this.pendingOperations = [];
    // 触发 open 事件（如果适配器有监听器）
    this.emit("open", new Event("open"));
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    if (!this._ws) return;
    const ws = this._ws; // 保存引用，避免类型检查错误

    // 在 Bun 环境下，将 onmessage、onclose、onerror 转换为 addEventListener
    if (IS_BUN) {
      // 保存原始的 onmessage、onclose、onerror
      const originalOnMessage = ws.onmessage;
      const originalOnClose = ws.onclose;
      const originalOnError = ws.onerror;

      // 设置统一的处理器
      ws.onmessage = (event: MessageEvent) => {
        if (originalOnMessage) {
          originalOnMessage.call(ws, event);
        }
        this.emit("message", event);
      };

      ws.onclose = (event: CloseEvent) => {
        if (originalOnClose) {
          originalOnClose.call(ws, event);
        }
        this.emit("close", event);
      };

      ws.onerror = (event: Event) => {
        if (originalOnError) {
          originalOnError.call(ws, event);
        }
        this.emit("error", event);
      };
    }
  }

  /**
   * 添加事件监听器（兼容 Deno 和 Bun）
   */
  addEventListener(
    type: string,
    listener: (event: any) => void,
  ): void {
    if (IS_BUN) {
      // Bun 环境下，使用内部事件系统
      if (!this.listeners.has(type)) {
        this.listeners.set(type, new Set());
      }
      this.listeners.get(type)!.add(listener);
    } else {
      // Deno 环境下，直接使用原生 addEventListener
      if (this._ws) {
        this._ws.addEventListener(type, listener);
      }
    }
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(
    type: string,
    listener: (event: any) => void,
  ): void {
    if (IS_BUN) {
      const listeners = this.listeners.get(type);
      if (listeners) {
        listeners.delete(listener);
      }
    } else {
      if (this._ws) {
        // 检查是否是占位符 Proxy
        if (typeof this._ws.removeEventListener === "function") {
          this._ws.removeEventListener(type, listener);
        }
      }
    }
  }

  /**
   * 触发事件（Bun 环境下使用）
   */
  private emit(type: string, event: any): void {
    const listeners = this.listeners.get(type);
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  }

  /**
   * 发送消息
   */
  send(data: string | ArrayBuffer | Blob): void {
    if (this._ws) {
      // 检查 _ws 是否有 send 方法（避免占位符 Proxy 的问题）
      if (typeof this._ws.send === "function") {
        this._ws.send(data);
      } else {
        // 如果是占位符，将操作加入待处理队列
        this.pendingOperations.push(() => {
          if (this._ws && typeof this._ws.send === "function") {
            this._ws.send(data);
          }
        });
      }
    } else {
      // 如果 WebSocket 还未设置，将操作加入待处理队列
      this.pendingOperations.push(() => {
        if (this._ws && typeof this._ws.send === "function") {
          this._ws.send(data);
        }
      });
    }
  }

  /**
   * 关闭连接
   */
  close(code?: number, reason?: string): void {
    if (this._ws) {
      // 检查 _ws 是否有 close 方法（避免占位符 Proxy 的问题）
      if (typeof this._ws.close === "function") {
        this._ws.close(code, reason);
      } else {
        // 如果是占位符，将操作加入待处理队列
        this.pendingOperations.push(() => {
          if (this._ws && typeof this._ws.close === "function") {
            this._ws.close(code, reason);
          }
        });
      }
    } else {
      // 如果 WebSocket 还未设置，将操作加入待处理队列
      this.pendingOperations.push(() => {
        if (this._ws && typeof this._ws.close === "function") {
          this._ws.close(code, reason);
        }
      });
    }
  }

  /**
   * 获取 readyState
   */
  get readyState(): number {
    if (this._ws) {
      // 检查是否是占位符 Proxy（通过检查是否有 send 方法）
      if (typeof this._ws.send === "function") {
        return this._ws.readyState;
      }
      // 如果是占位符，返回 CONNECTING
      return WebSocket.CONNECTING;
    }
    return WebSocket.CONNECTING;
  }

  /**
   * 获取协议
   */
  get protocol(): string {
    if (this._ws) {
      // 检查是否是占位符 Proxy
      if (typeof this._ws.send === "function") {
        return this._ws.protocol;
      }
      return "";
    }
    return "";
  }

  /**
   * 获取 URL
   */
  get url(): string {
    if (this._ws) {
      // 检查是否是占位符 Proxy
      if (typeof this._ws.send === "function") {
        return this._ws.url;
      }
      return "";
    }
    return "";
  }
}

/**
 * WebSocket 升级选项
 */
export interface UpgradeWebSocketOptions {
  protocol?: string;
  idleTimeout?: number;
}

/**
 * WebSocket 升级结果
 */
export interface UpgradeWebSocketResult {
  socket: WebSocket | WebSocketAdapter;
  response?: Response; // 在 Bun 环境下为 undefined，让 Bun 自动处理响应
}

/**
 * TCP 连接选项
 */
export interface ConnectOptions {
  hostname: string;
  port: number;
  transport?: "tcp";
}

/**
 * TLS 连接选项
 */
export interface StartTlsOptions {
  hostname?: string;
  caCerts?: string[];
  alpnProtocols?: string[];
}

/**
 * TCP 连接句柄
 */
export interface TcpConn {
  readonly localAddr: { hostname: string; port: number; transport: string };
  readonly remoteAddr: { hostname: string; port: number; transport: string };
  readonly rid?: number; // 可选，Bun 可能没有
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;
  close(): void;
  closeWrite(): void | Promise<void>;
}

/**
 * 启动 HTTP 服务器
 * @param options 服务器选项
 * @param handler 请求处理器
 * @returns 服务器句柄
 */
export function serve(
  options:
    | ServeOptions
    | ((
      req: Request,
    ) =>
      | Response
      | Promise<Response>
      | Promise<Response | undefined>
      | undefined),
  handler?: (
    req: Request,
  ) => Response | Promise<Response> | Promise<Response | undefined> | undefined,
): ServeHandle {
  if (IS_DENO) {
    // Deno.serve 的签名
    if (typeof options === "function") {
      const handle = (globalThis as any).Deno.serve(options);
      // Deno.serve 返回的 handle 可能没有 port 属性，需要从 onListen 回调中获取
      // 但为了兼容性，我们尝试从 handle 中获取
      return {
        ...handle,
        port: (handle as any).port as number | undefined,
      };
    }

    // 处理 options 对象的情况
    const serveOptions = options as ServeOptions;
    let port: number | undefined = undefined;

    // 包装 onListen 回调来捕获 port
    const originalOnListen = serveOptions.onListen;
    const newOptions = {
      ...serveOptions,
      onListen: (params: { hostname: string; port: number }) => {
        port = params.port;
        if (originalOnListen) {
          originalOnListen(params);
        }
      },
    };

    const handle = (globalThis as any).Deno.serve(newOptions, handler!);

    // 如果 handle 已经有 port，直接使用
    if ((handle as any).port !== undefined) {
      port = (handle as any).port;
    }

    // 返回一个包装的 handle，确保 port 属性可用
    // 使用 getter 来延迟获取 port，因为服务器可能还没有启动
    return {
      ...handle,
      get port() {
        // 如果 port 已经通过 onListen 设置，直接返回
        if (port !== undefined) {
          return port;
        }
        // 否则尝试从 handle 获取（某些情况下可能立即可用）
        const handlePort = (handle as any).port;
        if (handlePort !== undefined) {
          port = handlePort;
          return port;
        }
        // 如果都没有，返回 undefined（服务器可能还在启动中）
        return undefined;
      },
    };
  }

  if (IS_BUN) {
    // Bun.serve 的签名不同
    const BunServe = (globalThis as any).Bun.serve;
    if (typeof options === "function") {
      const server = BunServe({
        fetch: (req: Request, server: any) => {
          // 保存 server 实例以便 upgradeWebSocket 使用
          bunServerInstance = server;
          return options(req);
        },
        websocket: {
          // websocket 处理器，用于设置实际的 WebSocket 到适配器
          message(ws: WebSocket, message: string | Uint8Array) {
            // 查找对应的适配器并触发消息事件
            // 从所有适配器中查找（因为可能已从 pendingBunAdapters 中移除）
            let adapter = Array.from(WebSocketAdapter.allAdapters).find(
              (a) => (a as any)._ws === ws,
            );
            // 如果没找到，尝试从 pendingBunAdapters 中查找（可能 _ws 还未设置）
            if (!adapter && pendingBunAdapters.size > 0) {
              // 尝试通过 ws.data.adapterId 查找
              const wsData = (ws as any).data;
              if (wsData?.adapterId) {
                adapter = pendingBunAdapters.get(wsData.adapterId);
              }
              // 如果还是没找到，使用第一个适配器
              if (!adapter) {
                adapter = Array.from(pendingBunAdapters.values())[0];
              }
              // 如果找到适配器但 _ws 还没有设置，现在设置它
              // 这样可以处理 open 事件没有被触发的情况
              if (
                adapter &&
                (!(adapter as any)._ws ||
                  typeof (adapter as any)._ws.send !== "function")
              ) {
                adapter.setWebSocket(ws);
                // 从 pending 中移除
                const wsUrl = ws.url || "";
                if (wsUrl && pendingBunAdapters.has(wsUrl)) {
                  pendingBunAdapters.delete(wsUrl);
                } else if (
                  wsData?.adapterId && pendingBunAdapters.has(wsData.adapterId)
                ) {
                  pendingBunAdapters.delete(wsData.adapterId);
                } else {
                  // 删除第一个匹配的适配器
                  for (const [key, value] of pendingBunAdapters.entries()) {
                    if (value === adapter) {
                      pendingBunAdapters.delete(key);
                      break;
                    }
                  }
                }
              }
            }
            if (adapter) {
              // 触发 message 事件
              (adapter as any).emit(
                "message",
                new MessageEvent("message", {
                  data: message,
                }),
              );
            }
          },
          open(ws: WebSocket) {
            // 查找对应的适配器并设置实际的 WebSocket
            let adapter: WebSocketAdapter | undefined;
            let matchedKey: string | undefined;

            // 首先尝试通过 ws.data.adapterId 从 pendingBunAdapters 中查找（Bun 的特性）
            const wsData = (ws as any).data;
            if (wsData?.adapterId) {
              adapter = pendingBunAdapters.get(wsData.adapterId);
              if (adapter) {
                matchedKey = wsData.adapterId;
              }
            }

            // 如果没找到，尝试通过 ws.url 从 pendingBunAdapters 中查找
            const wsUrl = ws.url || "";
            if (!adapter && wsUrl) {
              // 尝试精确匹配
              adapter = pendingBunAdapters.get(wsUrl);
              if (adapter) {
                matchedKey = wsUrl;
              }

              // 如果没找到，尝试匹配 URL 路径（忽略协议和查询参数）
              if (!adapter) {
                try {
                  const wsUrlObj = new URL(wsUrl);
                  // 将 ws:// 或 wss:// 转换为 http:// 或 https:// 进行匹配
                  const httpUrl = wsUrl.replace(/^ws:/, "http:").replace(
                    /^wss:/,
                    "https:",
                  );
                  adapter = pendingBunAdapters.get(httpUrl);
                  if (adapter) {
                    matchedKey = httpUrl;
                  }

                  // 如果还是没找到，尝试匹配路径
                  if (!adapter) {
                    for (const [key, value] of pendingBunAdapters.entries()) {
                      try {
                        const keyUrlObj = new URL(key);
                        if (
                          wsUrlObj.pathname === keyUrlObj.pathname &&
                          wsUrlObj.hostname === keyUrlObj.hostname &&
                          wsUrlObj.port === keyUrlObj.port
                        ) {
                          adapter = value;
                          matchedKey = key;
                          break;
                        }
                      } catch {
                        // 忽略无效的 URL
                      }
                    }
                  }
                } catch {
                  // 忽略无效的 URL
                }
              }
            }

            // 如果没找到，尝试查找第一个还没有设置实际 WebSocket 的适配器
            if (!adapter && pendingBunAdapters.size > 0) {
              const adapters = Array.from(pendingBunAdapters.values());
              adapter = adapters.find(
                (a) =>
                  !(a as any)._ws || typeof (a as any)._ws.send !== "function",
              );
              // 找到匹配的 key
              if (adapter) {
                for (const [key, value] of pendingBunAdapters.entries()) {
                  if (value === adapter) {
                    matchedKey = key;
                    break;
                  }
                }
              }
            }

            // 如果还是没找到，尝试从所有适配器中查找
            if (!adapter) {
              adapter = Array.from(WebSocketAdapter.allAdapters).find(
                (a) =>
                  !(a as any)._ws || typeof (a as any)._ws.send !== "function",
              );
            }

            if (adapter) {
              adapter.setWebSocket(ws);
              // 从 pending 中移除
              if (matchedKey) {
                pendingBunAdapters.delete(matchedKey);
              } else {
                // 如果没有匹配的 key，删除第一个匹配的适配器
                for (const [key, value] of pendingBunAdapters.entries()) {
                  if (value === adapter) {
                    pendingBunAdapters.delete(key);
                    break;
                  }
                }
              }
            }
          },
          close(ws: WebSocket, code?: number, reason?: string) {
            // 查找对应的适配器并触发关闭事件
            // 从所有适配器中查找（因为可能已从 pendingBunAdapters 中移除）
            let adapter = Array.from(WebSocketAdapter.allAdapters).find(
              (a) => (a as any)._ws === ws,
            );
            // 如果没找到，尝试从 pendingBunAdapters 中查找
            if (!adapter) {
              const wsData = (ws as any).data;
              if (wsData?.adapterId) {
                adapter = pendingBunAdapters.get(wsData.adapterId);
              }
              // 如果还是没找到，使用第一个适配器
              if (!adapter && pendingBunAdapters.size > 0) {
                adapter = Array.from(pendingBunAdapters.values())[0];
              }
            }
            if (adapter) {
              // 触发 close 事件
              (adapter as any).emit(
                "close",
                new CloseEvent("close", {
                  code: code || 1000,
                  reason: reason || "",
                }),
              );
            }
          },
        },
      });
      bunServerInstance = server;
      return {
        finished: new Promise(() => {}),
        port: server.port,
        shutdown() {
          bunServerInstance = null;
          return Promise.resolve(server.stop());
        },
      };
    }

    const server = BunServe({
      port: options.port ?? 3000,
      hostname: options.hostname ?? "0.0.0.0",
      fetch: (req: Request, server: any) => {
        // 保存 server 实例以便 upgradeWebSocket 使用
        bunServerInstance = server;
        return handler!(req);
      },
      websocket: {
        // websocket 处理器，用于设置实际的 WebSocket 到适配器
        message(ws: WebSocket, message: string | Uint8Array) {
          // 查找对应的适配器并触发消息事件
          // 先尝试通过 _ws 查找（已设置实际 WebSocket 的适配器）
          let adapter = Array.from(WebSocketAdapter.allAdapters).find(
            (a) => (a as any)._ws === ws,
          );
          // 如果没找到，尝试从 pendingBunAdapters 中查找（可能 _ws 还未设置）
          if (!adapter && pendingBunAdapters.size > 0) {
            // 尝试通过 ws.data.adapterId 查找
            const wsData = (ws as any).data;
            if (wsData?.adapterId) {
              adapter = pendingBunAdapters.get(wsData.adapterId);
            }
            // 如果还是没找到，使用第一个适配器
            if (!adapter) {
              adapter = Array.from(pendingBunAdapters.values())[0];
            }
            // 如果找到适配器但 _ws 还没有设置，现在设置它
            // 这样可以处理 open 事件没有被触发的情况
            if (
              adapter &&
              (!(adapter as any)._ws ||
                typeof (adapter as any)._ws.send !== "function")
            ) {
              adapter.setWebSocket(ws);
              // 从 pending 中移除
              const wsUrl = ws.url || "";
              if (wsUrl && pendingBunAdapters.has(wsUrl)) {
                pendingBunAdapters.delete(wsUrl);
              } else if (
                wsData?.adapterId && pendingBunAdapters.has(wsData.adapterId)
              ) {
                pendingBunAdapters.delete(wsData.adapterId);
              } else {
                // 删除第一个匹配的适配器
                for (const [key, value] of pendingBunAdapters.entries()) {
                  if (value === adapter) {
                    pendingBunAdapters.delete(key);
                    break;
                  }
                }
              }
            }
          }
          if (adapter) {
            // 触发 message 事件
            (adapter as any).emit(
              "message",
              new MessageEvent("message", {
                data: message,
              }),
            );
          }
        },
        open(ws: WebSocket) {
          // 查找对应的适配器并设置实际的 WebSocket
          let adapter: WebSocketAdapter | undefined;
          let matchedKey: string | undefined;

          // 首先尝试通过 ws.data.adapterId 从 pendingBunAdapters 中查找（Bun 的特性）
          const wsData = (ws as any).data;
          if (wsData?.adapterId) {
            adapter = pendingBunAdapters.get(wsData.adapterId);
            if (adapter) {
              matchedKey = wsData.adapterId;
            }
          }

          // 如果没找到，尝试通过 ws.url 从 pendingBunAdapters 中查找
          const wsUrl = ws.url || "";
          if (!adapter && wsUrl) {
            // 尝试精确匹配
            adapter = pendingBunAdapters.get(wsUrl);
            if (adapter) {
              matchedKey = wsUrl;
            }

            // 如果没找到，尝试匹配 URL 路径（忽略协议和查询参数）
            if (!adapter) {
              try {
                const wsUrlObj = new URL(wsUrl);
                // 将 ws:// 或 wss:// 转换为 http:// 或 https:// 进行匹配
                const httpUrl = wsUrl.replace(/^ws:/, "http:").replace(
                  /^wss:/,
                  "https:",
                );
                adapter = pendingBunAdapters.get(httpUrl);
                if (adapter) {
                  matchedKey = httpUrl;
                }

                // 如果还是没找到，尝试匹配路径
                if (!adapter) {
                  for (const [key, value] of pendingBunAdapters.entries()) {
                    try {
                      const keyUrlObj = new URL(key);
                      if (
                        wsUrlObj.pathname === keyUrlObj.pathname &&
                        wsUrlObj.hostname === keyUrlObj.hostname &&
                        wsUrlObj.port === keyUrlObj.port
                      ) {
                        adapter = value;
                        matchedKey = key;
                        break;
                      }
                    } catch {
                      // 忽略无效的 URL
                    }
                  }
                }
              } catch {
                // 忽略无效的 URL
              }
            }
          }

          // 如果没找到，尝试查找第一个还没有设置实际 WebSocket 的适配器
          if (!adapter && pendingBunAdapters.size > 0) {
            const adapters = Array.from(pendingBunAdapters.values());
            adapter = adapters.find(
              (a) =>
                !(a as any)._ws || typeof (a as any)._ws.send !== "function",
            );
            // 找到匹配的 key
            if (adapter) {
              for (const [key, value] of pendingBunAdapters.entries()) {
                if (value === adapter) {
                  matchedKey = key;
                  break;
                }
              }
            }
          }

          // 如果还是没找到，尝试从所有适配器中查找
          if (!adapter) {
            adapter = Array.from(WebSocketAdapter.allAdapters).find(
              (a) =>
                !(a as any)._ws || typeof (a as any)._ws.send !== "function",
            );
          }

          if (adapter) {
            adapter.setWebSocket(ws);
            // 从 pending 中移除
            if (matchedKey) {
              pendingBunAdapters.delete(matchedKey);
            } else {
              // 如果没有匹配的 key，删除第一个匹配的适配器
              for (const [key, value] of pendingBunAdapters.entries()) {
                if (value === adapter) {
                  pendingBunAdapters.delete(key);
                  break;
                }
              }
            }
          }
        },
        close(ws: WebSocket, code?: number, reason?: string) {
          // 查找对应的适配器并触发关闭事件
          // 从所有适配器中查找（因为可能已从 pendingBunAdapters 中移除）
          let adapter = Array.from(WebSocketAdapter.allAdapters).find(
            (a) => (a as any)._ws === ws,
          );
          // 如果没找到，尝试从 pendingBunAdapters 中查找
          if (!adapter) {
            const wsData = (ws as any).data;
            if (wsData?.adapterId) {
              adapter = pendingBunAdapters.get(wsData.adapterId);
            }
            // 如果还是没找到，使用第一个适配器
            if (!adapter && pendingBunAdapters.size > 0) {
              adapter = Array.from(pendingBunAdapters.values())[0];
            }
          }
          if (adapter) {
            // 触发 close 事件
            (adapter as any).emit(
              "close",
              new CloseEvent("close", {
                code: code || 1000,
                reason: reason || "",
              }),
            );
          }
        },
      },
    });
    bunServerInstance = server;

    if (options.onListen) {
      options.onListen({
        hostname: server.hostname || options.hostname || "0.0.0.0",
        port: server.port || options.port || 3000,
      });
    }

    return {
      finished: new Promise(() => {}), // Bun 服务器不会自动结束
      port: server.port || options.port || 3000,
      shutdown() {
        bunServerInstance = null;
        return Promise.resolve(server.stop());
      },
    };
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 升级 WebSocket 连接
 * @param request HTTP 请求
 * @param options 升级选项
 * @returns WebSocket 和响应
 */
export function upgradeWebSocket(
  request: Request,
  options?: UpgradeWebSocketOptions,
): UpgradeWebSocketResult {
  if (IS_DENO) {
    return (globalThis as any).Deno.upgradeWebSocket(request, options);
  }

  if (IS_BUN) {
    // Bun 使用 server.upgrade() 方法升级 WebSocket
    // 需要从 serve() 中获取 server 实例
    if (!bunServerInstance) {
      throw new Error(
        "Bun 环境下的 WebSocket 升级需要先调用 serve() 创建服务器。请确保在调用 upgradeWebSocket() 之前已经调用了 serve()。",
      );
    }

    // 构建升级选项
    // 在 Bun 中，可以通过 data 参数传递自定义数据，在 websocket.open 中通过 ws.data 访问
    const adapterId = request.url; // 使用 URL 作为适配器标识
    const upgradeOptions: any = {
      data: {
        adapterId: adapterId, // 传递适配器 ID，用于在 open 事件中匹配
      },
    };
    if (options?.protocol) {
      upgradeOptions.headers = {
        "Sec-WebSocket-Protocol": options.protocol,
      };
    }

    // 尝试升级 WebSocket
    // Bun 的 upgrade() 方法返回 boolean，不返回 socket 和 response
    // 升级成功后，Bun 会自动发送 101 Switching Protocols 响应
    // 实际的 socket 会在 websocket 处理器中可用
    const upgraded = bunServerInstance.upgrade(request, upgradeOptions);

    if (!upgraded) {
      throw new Error("WebSocket 升级失败");
    }

    // 注意：Bun 的 WebSocket 升级方式与 Deno 不同
    // - Deno: 立即返回 socket 和 response
    // - Bun: 返回 boolean，socket 在 websocket 处理器中可用
    // 在 Bun 环境下，我们需要创建一个占位符 WebSocket 适配器
    // 实际的 socket 会在 websocket 处理器中可用，但我们需要先返回一个适配器
    // 这个适配器会在 websocket 处理器中被替换为真正的 socket
    const placeholderWs = new Proxy({} as WebSocket, {
      get(_target, prop) {
        // 如果访问的是 WebSocket 的标准属性，返回默认值
        if (prop === "readyState") {
          return WebSocket.CONNECTING;
        }
        if (prop === "protocol" || prop === "url") {
          return "";
        }
        // 如果访问的是方法，返回一个空函数
        if (typeof prop === "string" && prop.startsWith("on")) {
          return undefined;
        }
        return undefined;
      },
    });

    // 创建一个适配器，包装占位符 WebSocket
    // 注意：在 Bun 环境下，实际的 socket 会在 websocket 处理器中可用
    // 但我们需要先返回一个适配器，以便 websocket 库可以使用 addEventListener
    const adapter = new WebSocketAdapter(placeholderWs as WebSocket);

    // 存储适配器，以便在 websocket.open 中设置实际的 WebSocket
    const url = request.url;
    pendingBunAdapters.set(url, adapter);

    // 在 Bun 环境下，返回 undefined 作为 response，让 Bun 自动处理 WebSocket 升级响应
    // 这样 open 事件才能被正确触发
    return {
      socket: adapter as any as WebSocket, // 返回适配器，但类型为 WebSocket
      response: undefined, // Bun 会自动处理 101 响应
    };
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 建立 TCP 连接
 * @param options 连接选项
 * @returns TCP 连接句柄
 */
export async function connect(options: ConnectOptions): Promise<TcpConn> {
  if (IS_DENO) {
    return await (globalThis as any).Deno.connect(options);
  }

  if (IS_BUN) {
    return new Promise<TcpConn>((resolve, reject) => {
      // 创建 ReadableStream 和 WritableStream 的控制器
      let readableController:
        | ReadableStreamDefaultController<Uint8Array>
        | null = null;
      let socket: any = null;

      const readable = new ReadableStream({
        start(controller) {
          readableController = controller;
        },
      });

      const writable = new WritableStream({
        write(chunk) {
          if (socket) {
            const written = socket.write(chunk);
            // Bun.write 是同步的，但可能返回 -1 表示需要等待
            if (written === -1) {
              // 等待 drain 事件
              return new Promise<void>((resolveDrain) => {
                const drainHandler = () => {
                  socket.off("drain", drainHandler);
                  resolveDrain();
                };
                socket.on("drain", drainHandler);
              });
            }
          }
        },
        close() {
          if (socket) {
            socket.end();
          }
        },
      });

      (globalThis as any).Bun.connect({
        hostname: options.hostname,
        port: options.port,
        socket: {
          open(sock: any) {
            socket = sock;
            // 连接成功，解析 Promise
            resolve({
              localAddr: {
                hostname: sock.localAddress || "0.0.0.0",
                port: sock.localPort || 0,
                transport: "tcp",
              },
              remoteAddr: {
                hostname: sock.remoteAddress || options.hostname,
                port: sock.remotePort || options.port,
                transport: "tcp",
              },
              rid: (sock as any).fd || 0,
              readable,
              writable,
              close() {
                sock.terminate();
              },
              closeWrite() {
                sock.end();
              },
            });
          },
          data(_sock: any, data: Uint8Array) {
            // 将数据推送到 ReadableStream
            if (readableController) {
              readableController.enqueue(data);
            }
          },
          close(_sock: any) {
            // 关闭 ReadableStream
            if (readableController) {
              readableController.close();
            }
          },
          error(_sock: any, error: Error) {
            // 错误处理
            if (readableController) {
              readableController.error(error);
            }
            reject(error);
          },
          connectError(_sock: any, error: Error) {
            // 连接错误
            reject(error);
          },
        },
      }).catch(reject);
    });
  }

  throw new Error("不支持的运行时环境");
}

/**
 * 升级 TCP 连接到 TLS
 * @param conn TCP 连接
 * @param options TLS 选项
 * @returns TLS 连接句柄
 */
export async function startTls(
  conn: TcpConn,
  options?: StartTlsOptions,
): Promise<TcpConn> {
  if (IS_DENO) {
    // Deno.startTls 需要 Deno.TcpConn 类型
    // 我们需要将我们的 TcpConn 转换为 Deno.TcpConn
    // 由于类型不兼容，这里需要类型断言
    return (await (globalThis as any).Deno.startTls(
      conn as any,
      options,
    )) as TcpConn;
  }

  if (IS_BUN) {
    // Bun 不支持升级现有连接，需要关闭原连接并创建新的 TLS 连接
    // 使用 Bun.connect 直接创建 TLS 连接

    // 先关闭原连接
    conn.close();

    // 创建 ReadableStream 和 WritableStream 的控制器
    let readableController: ReadableStreamDefaultController<Uint8Array> | null =
      null;
    let socket: any = null;

    const readable = new ReadableStream({
      start(controller) {
        readableController = controller;
      },
    });

    const writable = new WritableStream({
      write(chunk) {
        if (socket) {
          const written = socket.write(chunk);
          if (written === -1) {
            return new Promise<void>((resolveDrain) => {
              const drainHandler = () => {
                socket.off("drain", drainHandler);
                resolveDrain();
              };
              socket.on("drain", drainHandler);
            });
          }
        }
      },
      close() {
        if (socket) {
          socket.end();
        }
      },
    });

    // 构建 TLS 选项
    const tlsOptions: any = options?.caCerts
      ? { rejectUnauthorized: false }
      : true;
    if (options?.alpnProtocols) {
      tlsOptions.alpnProtocols = options.alpnProtocols;
    }

    return new Promise((resolve, reject) => {
      (globalThis as any).Bun.connect({
        hostname: conn.remoteAddr.hostname,
        port: conn.remoteAddr.port,
        tls: tlsOptions,
        socket: {
          open(sock: any) {
            socket = sock;
            resolve({
              localAddr: {
                hostname: sock.localAddress || "0.0.0.0",
                port: sock.localPort || 0,
                transport: "tcp",
              },
              remoteAddr: {
                hostname: sock.remoteAddress || conn.remoteAddr.hostname,
                port: sock.remotePort || conn.remoteAddr.port,
                transport: "tcp",
              },
              rid: (sock as any).fd || 0,
              readable,
              writable,
              close() {
                sock.terminate();
              },
              closeWrite() {
                sock.end();
              },
            });
          },
          data(_sock: any, data: Uint8Array) {
            if (readableController) {
              readableController.enqueue(data);
            }
          },
          close(_sock: any) {
            if (readableController) {
              readableController.close();
            }
          },
          error(_sock: any, error: Error) {
            if (readableController) {
              readableController.error(error);
            }
            reject(error);
          },
          connectError(_sock: any, error: Error) {
            reject(error);
          },
        },
      });
    });
  }

  throw new Error("不支持的运行时环境");
}
