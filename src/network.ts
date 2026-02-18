/**
 * 网络 API 适配模块
 * 提供统一的网络操作接口，兼容 Deno 和 Bun
 */

import { IS_BUN } from "./detect.ts";
import type { BunServer, BunSocket, BunWebSocket } from "./types.ts";
import { getBun, getDeno } from "./utils.ts";
import { $t } from "./i18n.ts";

/**
 * HTTP 服务器选项
 */
export interface ServeOptions {
  port?: number;
  host?: string;
  onListen?: (params: { host: string; port: number }) => void;
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
let bunServerInstance: BunServer | null = null;

// Bun 环境下，存储待处理的 WebSocket 适配器
// 当 upgradeWebSocket 被调用时，我们存储适配器，然后在 websocket 处理器中设置实际的 WebSocket
const pendingBunAdapters = new Map<string, WebSocketAdapter>();

/** 是否输出 WebSocket 调试日志（环境变量 RUNTIME_ADAPTER_DEBUG_WS=1 时启用） */
function isWsDebug(): boolean {
  try {
    const p = (globalThis as { process?: { env?: Record<string, string> } })
      .process;
    return p?.env?.RUNTIME_ADAPTER_DEBUG_WS === "1";
  } catch {
    return false;
  }
}
/** 调试输出：仅当 RUNTIME_ADAPTER_DEBUG_WS=1 时打印，文案走 i18n */
function wsDebug(msg: string, ...args: unknown[]): void {
  if (isWsDebug()) {
    console.log($t("debug.wsPrefix"), msg, ...args);
  }
}

/**
 * WebSocket 适配器类
 * 在 Bun 环境下提供 addEventListener API，兼容 Deno 的 WebSocket API
 */
/**
 * WebSocket 事件类型
 */
type WebSocketEvent = MessageEvent | CloseEvent | Event;

class WebSocketAdapter {
  private _ws: WebSocket | null = null;
  private listeners: Map<string, Set<(event: WebSocketEvent) => void>> =
    new Map();
  private pendingOperations: Array<() => void> = [];
  // 存储所有已创建的适配器（用于 Bun 环境下的查找）
  public static allAdapters: Set<WebSocketAdapter> = new Set();
  // 唯一标识符（用于调试）
  private readonly id: string;

  constructor(ws?: WebSocket) {
    this.id = `adapter_${Date.now()}_${
      Math.random().toString(36).substring(2, 9)
    }`;
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
    wsDebug(
      $t("debug.setWebSocketAdapterId"),
      this.id,
      $t("debug.openListeners"),
      this.listeners.get("open")?.size ?? 0,
    );
    this._ws = ws;
    this.setupEventHandlers();
    // 执行所有待处理的操作
    for (const op of this.pendingOperations) {
      op();
    }
    this.pendingOperations = [];
    // Bun 在 upgrade() 内同步调用 open(ws)，queueMicrotask 仍会在同一任务内执行，此时 handler
    // 尚未执行到 addEventListener("open")，导致 listeners=0。必须推迟到下一宏任务再 emit，
    // 确保 handler 已注册 open 监听器后再触发。
    if (IS_BUN) {
      setTimeout(() => {
        wsDebug(
          $t("debug.setWebSocketEmittingOpen"),
          this.listeners.get("open")?.size ?? 0,
        );
        this.emit("open", new Event("open"));
      }, 0);
    } else {
      this.emit("open", new Event("open"));
    }
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
    listener: (event: WebSocketEvent) => void,
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
    listener: (event: WebSocketEvent) => void,
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
   * @internal 内部方法，用于触发事件
   */
  emit(type: string, event: WebSocketEvent): void {
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
   * 获取内部的 WebSocket 实例（用于查找匹配）
   */
  getWebSocket(): WebSocket | null {
    return this._ws;
  }

  /**
   * 检查 WebSocket 是否已设置且可用
   */
  isWebSocketReady(): boolean {
    return this._ws !== null && typeof this._ws.send === "function";
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
  host: string;
  port: number;
  transport?: "tcp";
}

/**
 * TLS 连接选项
 */
export interface StartTlsOptions {
  host?: string;
  caCerts?: Uint8Array[];
  alpnProtocols?: string[];
}

/**
 * TCP 连接句柄
 */
export interface TcpConn {
  readonly localAddr: { host: string; port: number; transport: string };
  readonly remoteAddr: { host: string; port: number; transport: string };
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
  const deno = getDeno();
  if (deno) {
    // Deno.serve 的签名
    if (typeof options === "function") {
      const handle = deno.serve(
        options as (req: Request) => Response | Promise<Response>,
      );
      // Deno.serve 返回的 handle 可能没有 port 属性，需要从 onListen 回调中获取
      // 但为了兼容性，我们尝试从 handle 中获取
      return {
        ...handle,
        port: handle.port as number | undefined,
      };
    }

    // 处理 options 对象的情况
    const serveOptions = options as ServeOptions;
    let port: number | undefined = undefined;

    // 包装 onListen 回调来捕获 port
    const originalOnListen = serveOptions.onListen;
    // Deno.serve 使用 hostname，需要转换
    const newOptions = {
      ...serveOptions,
      hostname: serveOptions.host, // 转换为 hostname 传递给 Deno.serve
      onListen: (params: { hostname: string; port: number }) => {
        port = params.port;
        if (originalOnListen) {
          // 转换 hostname 为 host
          originalOnListen({ host: params.hostname, port: params.port });
        }
      },
    };

    const handle = deno.serve(newOptions, async (req: Request) => {
      const result = await handler!(req);
      // 确保返回 Response，而不是 undefined
      if (result === undefined) {
        return new Response(null, { status: 404 });
      }
      return result;
    });

    // 如果 handle 已经有 port，直接使用
    if (handle.port !== undefined) {
      port = handle.port;
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
        const handlePort = handle.port;
        if (handlePort !== undefined) {
          port = handlePort;
          return port;
        }
        // 如果都没有，返回 undefined（服务器可能还在启动中）
        return undefined;
      },
    };
  }

  const bun = getBun();
  if (bun) {
    // Bun.serve 的签名不同
    if (typeof options === "function") {
      const server = bun.serve({
        fetch: async (req: Request, server: BunServer) => {
          // 保存 server 实例以便 upgradeWebSocket 使用
          bunServerInstance = server;
          const isWs =
            req.headers.get("Upgrade")?.toLowerCase() === "websocket";
          if (isWs) {
            await options(req);
            // Bun 若收到 undefined 会报 "Expected a Response object"，故返回 101
            return new Response(null, { status: 101 }) as Response;
          }
          return (await options(req)) as Response;
        },
        websocket: {
          // websocket 处理器，用于设置实际的 WebSocket 到适配器
          message(ws: BunWebSocket, message: string | Uint8Array) {
            // 查找对应的适配器并触发消息事件
            // 从所有适配器中查找（因为可能已从 pendingBunAdapters 中移除）
            let adapter = Array.from(WebSocketAdapter.allAdapters).find(
              (a) => a.getWebSocket() === ws,
            );
            // 如果没找到，尝试从 pendingBunAdapters 中查找（可能 _ws 还未设置）
            if (!adapter && pendingBunAdapters.size > 0) {
              // 尝试通过 ws.data.adapterId 查找
              const wsData = ws.data;
              if (wsData?.adapterId) {
                adapter = pendingBunAdapters.get(wsData.adapterId);
              }
              // 如果还是没找到，使用第一个适配器
              if (!adapter) {
                adapter = Array.from(pendingBunAdapters.values())[0];
              }
              // 如果找到适配器但 _ws 还没有设置，现在设置它
              // 这样可以处理 open 事件没有被触发的情况
              if (adapter && !adapter.isWebSocketReady()) {
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
              adapter.emit(
                "message",
                new MessageEvent("message", {
                  data: message,
                }),
              );
            }
          },
          open(ws: BunWebSocket) {
            // 查找对应的适配器并设置实际的 WebSocket
            let adapter: WebSocketAdapter | undefined;
            let matchedKey: string | undefined;

            // 首先尝试通过 ws.data.adapterId 从 pendingBunAdapters 中查找（Bun 的特性）
            const wsData = ws.data;
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

            // 若通过 key 未找到，且当前仅有一个 pending 适配器，直接使用（常见单连接场景）
            if (!adapter && pendingBunAdapters.size === 1) {
              adapter = pendingBunAdapters.values().next().value;
              matchedKey = pendingBunAdapters.keys().next().value;
            }
            // 如果没找到，尝试查找第一个还没有设置实际 WebSocket 的适配器
            if (!adapter && pendingBunAdapters.size > 0) {
              const adapters = Array.from(pendingBunAdapters.values());
              adapter = adapters.find(
                (a) => !a.isWebSocketReady(),
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
                (a) => !a.isWebSocketReady(),
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
          close(ws: BunWebSocket, code?: number, reason?: string) {
            // 查找对应的适配器并触发关闭事件
            // 从所有适配器中查找（因为可能已从 pendingBunAdapters 中移除）
            let adapter = Array.from(WebSocketAdapter.allAdapters).find(
              (a) => a.getWebSocket() === ws,
            );
            // 如果没找到，尝试从 pendingBunAdapters 中查找
            if (!adapter) {
              const wsData = ws.data;
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
              adapter.emit(
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

    const server = bun.serve({
      port: options.port ?? 3000,
      hostname: options.host ?? "0.0.0.0", // Bun.serve 使用 hostname，需要转换
      fetch: async (req: Request, server: BunServer) => {
        // 保存 server 实例以便 upgradeWebSocket 使用
        bunServerInstance = server;
        const isWs = req.headers.get("Upgrade")?.toLowerCase() === "websocket";
        if (isWs) {
          wsDebug($t("debug.fetchUpgradeRequest"));
          await handler!(req);
          // Bun 若收到 undefined 会报 "Expected a Response object" 并导致客户端连接失败，
          // 故在升级完成后返回 101，满足 Bun 对 fetch 返回值的期望。
          wsDebug($t("debug.fetchHandlerCompleted"));
          return new Response(null, { status: 101 }) as Response;
        }
        return (await handler!(req)) as Response;
      },
      websocket: {
        // websocket 处理器，用于设置实际的 WebSocket 到适配器
        message(ws: BunWebSocket, message: string | Uint8Array) {
          // 查找对应的适配器并触发消息事件
          // 先尝试通过 _ws 查找（已设置实际 WebSocket 的适配器）
          let adapter = Array.from(WebSocketAdapter.allAdapters).find(
            (a) => a.getWebSocket() === ws,
          );
          // 如果没找到，尝试从 pendingBunAdapters 中查找（可能 _ws 还未设置）
          if (!adapter && pendingBunAdapters.size > 0) {
            // 尝试通过 ws.data.adapterId 查找
            const wsData = ws.data;
            if (wsData?.adapterId) {
              adapter = pendingBunAdapters.get(wsData.adapterId);
            }
            // 如果还是没找到，尝试通过 ws.url 查找（转换为 http://）
            if (!adapter) {
              const wsUrl = ws.url || "";
              if (wsUrl) {
                const httpUrl = wsUrl.replace(/^ws:/, "http:").replace(
                  /^wss:/,
                  "https:",
                );
                adapter = pendingBunAdapters.get(httpUrl);
              }
            }
            // 如果还是没找到，使用第一个适配器
            if (!adapter) {
              adapter = Array.from(pendingBunAdapters.values())[0];
            }
            // 如果找到适配器但 _ws 还没有设置，现在设置它
            // 这样可以处理 open 事件没有被触发的情况
            if (adapter && !adapter.isWebSocketReady()) {
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
            adapter.emit(
              "message",
              new MessageEvent("message", {
                data: message,
              }),
            );
          }
        },
        open(ws: BunWebSocket) {
          const wsData = ws.data;
          const wsUrl = ws.url || "";
          wsDebug(
            $t("debug.openWsCalled"),
            wsData?.adapterId,
            $t("debug.wsUrl"),
            wsUrl,
            $t("debug.pendingSize"),
            pendingBunAdapters.size,
            $t("debug.pendingKeys"),
            [...pendingBunAdapters.keys()],
          );
          // 查找对应的适配器并设置实际的 WebSocket
          let adapter: WebSocketAdapter | undefined;
          let matchedKey: string | undefined;

          // 首先尝试通过 ws.data.adapterId 从 pendingBunAdapters 中查找（Bun 的特性）
          if (wsData?.adapterId) {
            adapter = pendingBunAdapters.get(wsData.adapterId);
            if (adapter) {
              matchedKey = wsData.adapterId;
            }
          }

          // 如果没找到，尝试通过 ws.url 从 pendingBunAdapters 中查找
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

          // 若通过 key 未找到，且当前仅有一个 pending 适配器，直接使用（常见单连接场景）
          if (!adapter && pendingBunAdapters.size === 1) {
            adapter = pendingBunAdapters.values().next().value;
            matchedKey = pendingBunAdapters.keys().next().value;
          }
          // 再尝试用「未就绪」的适配器兜底（仅当仅有一个时使用，避免误匹配）
          if (!adapter) {
            const unready = Array.from(WebSocketAdapter.allAdapters).filter(
              (a) => !a.isWebSocketReady(),
            );
            if (unready.length === 1) {
              adapter = unready[0];
            }
          }

          wsDebug($t("debug.adapterFound"), !!adapter);
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
        close(ws: BunWebSocket, code?: number, reason?: string) {
          // 查找对应的适配器并触发关闭事件
          // 从所有适配器中查找（因为可能已从 pendingBunAdapters 中移除）
          let adapter = Array.from(WebSocketAdapter.allAdapters).find(
            (a) => a.getWebSocket() === ws,
          );
          // 如果没找到，尝试从 pendingBunAdapters 中查找
          if (!adapter) {
            const wsData = ws.data;
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
            adapter.emit(
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
      // 转换 hostname 为 host
      options.onListen({
        host: server.hostname || options.host || "0.0.0.0",
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

  throw new Error($t("error.unsupportedRuntime"));
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
  const deno = getDeno();
  if (deno) {
    return deno.upgradeWebSocket(request, options);
  }

  if (IS_BUN) {
    // Bun 使用 server.upgrade() 方法升级 WebSocket
    // 需要从 serve() 中获取 server 实例
    if (!bunServerInstance) {
      throw new Error($t("error.bunWsNeedServe"));
    }

    // 构建升级选项
    // 在 Bun 中，可以通过 data 参数传递自定义数据，在 websocket.open 中通过 ws.data 访问
    const adapterId = request.url; // 使用 URL 作为适配器标识
    const upgradeOptions: {
      data: { adapterId: string };
      headers?: Record<string, string>;
    } = {
      data: {
        adapterId: adapterId, // 传递适配器 ID，用于在 open 事件中匹配
      },
    };
    if (options?.protocol) {
      upgradeOptions.headers = {
        "Sec-WebSocket-Protocol": options.protocol,
      };
    }

    // 检查是否已经为这个请求 URL 创建了适配器（避免重复创建）
    const url = request.url;
    let adapter = pendingBunAdapters.get(url);
    if (adapter) {
      // 如果已经存在，直接返回（避免重复升级）
      return {
        socket: adapter as unknown as WebSocket,
        response: undefined,
      };
    }

    // 先创建适配器并注册，再调用 upgrade()。
    // Bun 可能在 upgrade() 内同步调用 websocket.open(ws)，若 adapter 在 upgrade 之后才放入
    // pendingBunAdapters，open(ws) 时找不到 adapter，setWebSocket(ws) 不会被调用，服务端
    // send() 会一直留在 pendingOperations，客户端收不到消息（如批量心跳 ping）。
    const placeholderWs = new Proxy({} as WebSocket, {
      get(_target, prop) {
        if (prop === "readyState") {
          return WebSocket.CONNECTING;
        }
        if (prop === "protocol" || prop === "url") {
          return "";
        }
        if (typeof prop === "string" && prop.startsWith("on")) {
          return undefined;
        }
        return undefined;
      },
    });

    adapter = new WebSocketAdapter(placeholderWs as WebSocket);
    pendingBunAdapters.set(url, adapter);
    wsDebug(
      $t("debug.upgradeWebSocketUrl"),
      url,
      $t("debug.pendingSize"),
      pendingBunAdapters.size,
    );

    // 尝试升级 WebSocket（open(ws) 可能在此调用栈内同步触发，此时已能通过 adapterId 找到 adapter）
    const upgraded = bunServerInstance.upgrade(request, upgradeOptions);
    wsDebug($t("debug.upgradeResult"), upgraded);

    if (!upgraded) {
      pendingBunAdapters.delete(url);
      throw new Error($t("error.wsUpgradeFailed"));
    }

    // 检查适配器是否正确创建
    if (typeof adapter.addEventListener !== "function") {
      throw new Error($t("error.wsAdapterMissingAddEventListener"));
    }

    // 在 Bun 环境下，返回 undefined 作为 response，让 Bun 自动处理 WebSocket 升级响应
    // 这样 open 事件才能被正确触发
    // 注意：直接返回 adapter，不要进行类型断言，让 TypeScript 处理类型
    return {
      socket: adapter as unknown as WebSocket, // 返回适配器，但类型为 WebSocket
      response: undefined, // Bun 会自动处理 101 响应
    };
  }

  throw new Error($t("error.unsupportedRuntime"));
}

/**
 * 建立 TCP 连接
 * @param options 连接选项
 * @returns TCP 连接句柄
 */
export async function connect(options: ConnectOptions): Promise<TcpConn> {
  const deno = getDeno();
  if (deno) {
    // Deno.connect 使用 hostname，需要转换
    return await deno.connect({
      hostname: options.host,
      port: options.port,
      transport: options.transport,
    });
  }

  const bun = getBun();
  if (bun) {
    return new Promise<TcpConn>((resolve, reject) => {
      // 创建 ReadableStream 和 WritableStream 的控制器
      let readableController:
        | ReadableStreamDefaultController<Uint8Array>
        | null = null;
      let socket: BunSocket | null = null;

      const readable = new ReadableStream({
        start(controller) {
          readableController = controller;
        },
      });

      const writable = new WritableStream({
        write(chunk) {
          if (socket && typeof socket.write === "function") {
            const written = socket.write(chunk);
            // Bun.write 是同步的，但可能返回 -1 表示需要等待
            if (written === -1) {
              // 等待 drain 事件
              return new Promise<void>((resolveDrain) => {
                const drainHandler = () => {
                  if (socket && typeof socket.off === "function") {
                    socket.off("drain", drainHandler);
                  }
                  resolveDrain();
                };
                if (socket && typeof socket.on === "function") {
                  socket.on("drain", drainHandler);
                }
              });
            }
          }
        },
        close() {
          if (socket && typeof socket.end === "function") {
            socket.end();
          }
        },
      });

      // Bun.connect 使用 hostname，需要转换
      try {
        bun.connect({
          hostname: options.host,
          port: options.port,
          socket: {
            open(sock: BunSocket) {
              socket = sock;
              // 连接成功，解析 Promise
              resolve({
                localAddr: {
                  host: sock.localAddress || "0.0.0.0",
                  port: sock.localPort || 0,
                  transport: "tcp",
                },
                remoteAddr: {
                  host: sock.remoteAddress || options.host,
                  port: sock.remotePort || options.port,
                  transport: "tcp",
                },
                rid: sock.fd || 0,
                readable,
                writable,
                close() {
                  if (typeof sock.terminate === "function") {
                    sock.terminate();
                  }
                },
                closeWrite() {
                  if (typeof sock.end === "function") {
                    sock.end();
                  }
                },
              });
            },
            data(_sock: BunSocket, data: Uint8Array) {
              // 将数据推送到 ReadableStream
              if (readableController) {
                readableController.enqueue(data);
              }
            },
            close(_sock: BunSocket) {
              // 关闭 ReadableStream
              if (readableController) {
                readableController.close();
              }
            },
            error(_sock: BunSocket, error: Error) {
              // 错误处理
              if (readableController) {
                readableController.error(error);
              }
              reject(error);
            },
            connectError(_sock: BunSocket, error: Error) {
              // 连接错误
              reject(error);
            },
          },
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  throw new Error($t("error.unsupportedRuntime"));
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
  const deno = getDeno();
  if (deno) {
    // Deno.startTls 需要 Deno.TcpConn 类型
    // 我们需要将我们的 TcpConn 转换为 Deno.TcpConn
    // 由于类型不兼容，这里需要类型断言
    // Deno.startTls 的 options 使用 hostname，需要转换
    const tlsOptions = options
      ? {
        hostname: options.host,
        caCerts: options.caCerts, // caCerts 已经是 Uint8Array[]
        alpnProtocols: options.alpnProtocols,
      }
      : undefined;
    return (await deno.startTls(
      conn as unknown as Parameters<typeof deno.startTls>[0],
      tlsOptions,
    )) as TcpConn;
  }

  const bun = getBun();
  if (bun) {
    // Bun 不支持升级现有连接，需要关闭原连接并创建新的 TLS 连接
    // 使用 Bun.connect 直接创建 TLS 连接

    // 先关闭原连接
    conn.close();

    // 创建 ReadableStream 和 WritableStream 的控制器
    let readableController: ReadableStreamDefaultController<Uint8Array> | null =
      null;
    let socket: BunSocket | null = null;

    const readable = new ReadableStream({
      start(controller) {
        readableController = controller;
      },
    });

    const writable = new WritableStream({
      write(chunk) {
        if (socket && typeof socket.write === "function") {
          const written = socket.write(chunk);
          if (written === -1) {
            return new Promise<void>((resolveDrain) => {
              const drainHandler = () => {
                if (socket && typeof socket.off === "function") {
                  socket.off("drain", drainHandler);
                }
                resolveDrain();
              };
              if (socket && typeof socket.on === "function") {
                socket.on("drain", drainHandler);
              }
            });
          }
        }
      },
      close() {
        if (socket && typeof socket.end === "function") {
          socket.end();
        }
      },
    });

    // 构建 TLS 选项
    const tlsOptions: { ca?: Uint8Array[] } | undefined = options?.caCerts
      ? { ca: options.caCerts }
      : undefined;

    return new Promise((resolve, reject) => {
      // Bun.connect 使用 hostname，需要转换
      try {
        bun.connect({
          hostname: conn.remoteAddr.host,
          port: conn.remoteAddr.port,
          tls: tlsOptions,
          socket: {
            open(sock: BunSocket) {
              socket = sock;
              resolve({
                localAddr: {
                  host: sock.localAddress || "0.0.0.0",
                  port: sock.localPort || 0,
                  transport: "tcp",
                },
                remoteAddr: {
                  host: sock.remoteAddress || conn.remoteAddr.host,
                  port: sock.remotePort || conn.remoteAddr.port,
                  transport: "tcp",
                },
                rid: sock.fd || 0,
                readable,
                writable,
                close() {
                  if (typeof sock.terminate === "function") {
                    sock.terminate();
                  }
                },
                closeWrite() {
                  if (typeof sock.end === "function") {
                    sock.end();
                  }
                },
              });
            },
            data(_sock: BunSocket, data: Uint8Array) {
              if (readableController) {
                readableController.enqueue(data);
              }
            },
            close(_sock: BunSocket) {
              if (readableController) {
                readableController.close();
              }
            },
            error(_sock: BunSocket, error: Error) {
              if (readableController) {
                readableController.error(error);
              }
              reject(error);
            },
            connectError(_sock: BunSocket, error: Error) {
              reject(error);
            },
          },
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  throw new Error($t("error.unsupportedRuntime"));
}
