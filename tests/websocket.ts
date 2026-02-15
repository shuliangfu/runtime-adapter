/**
 * @module @dreamer/websocket
 *
 * WebSocket 工具库，提供 WebSocket 服务器功能，支持实时双向通信。
 *
 * 功能特性：
 * - WebSocket 服务器：基于 runtime-adapter 的 WebSocket 服务器，兼容 Deno 和 Bun
 * - 连接管理：连接建立、关闭、状态追踪、连接池管理
 * - 消息处理：文本消息、二进制消息、消息序列化/反序列化
 * - 房间管理：房间创建、用户加入/离开、房间内消息广播
 * - 心跳检测：自动心跳发送、连接超时检测、断线重连支持
 * - 事件系统：连接事件、消息事件、自定义事件支持
 *
 * @example
 * ```typescript
 * import { Server } from "jsr:@dreamer/websocket";
 *
 * const io = new Server({
 *   port: 8080,
 *   path: "/socket.io",
 * });
 *
 * io.on("connection", (socket) => {
 *   socket.on("chat-message", (data) => {
 *     socket.emit("chat-response", { status: "success" });
 *   });
 * });
 *
 * await io.listen();
 * ```
 */

import { serve, type ServeHandle, upgradeWebSocket } from "../src/mod.ts";

/**
 * WebSocket 服务器配置选项
 */
export interface ServerOptions {
  /** 主机地址（默认：0.0.0.0） */
  host?: string;
  /** 端口号 */
  port?: number;
  /** WebSocket 路径（默认："/"） */
  path?: string;
  /** 心跳超时时间（毫秒，默认：60000） */
  pingTimeout?: number;
  /** 心跳间隔（毫秒，默认：30000） */
  pingInterval?: number;
  /** 最大连接数（默认：无限制） */
  maxConnections?: number;
}

/**
 * WebSocket 握手信息
 */
export interface Handshake {
  /** 查询参数 */
  query: Record<string, string>;
  /** 请求头 */
  headers: Headers;
  /** 客户端地址 */
  address?: string;
  /** URL */
  url: string;
}

/**
 * Socket 数据存储
 */
export interface SocketData {
  [key: string]: unknown;
}

/**
 * Socket 事件监听器
 */
export type SocketEventListener = (
  data?: any,
  callback?: (response: any) => void,
) => void;

/**
 * 服务器事件监听器
 */
export type ServerEventListener = (socket: Socket) => void;

/**
 * 中间件函数
 */
export type Middleware = (
  socket: Socket,
  next: (error?: Error) => void,
) => void | Promise<void>;

/**
 * WebSocket Socket 类
 * 表示一个 WebSocket 连接
 */
export class Socket {
  /** Socket ID（唯一标识） */
  public readonly id: string;
  /** 握手信息 */
  public readonly handshake: Handshake;
  /** 数据存储 */
  public data: SocketData = {};
  /** 是否已连接 */
  public connected = true;
  /** 房间列表 */
  private rooms: Set<string> = new Set();
  /** 事件监听器 */
  private listeners: Map<string, SocketEventListener[]> = new Map();
  /** WebSocket 连接（可能是 WebSocket 或 WebSocketAdapter） */
  private ws: WebSocket | {
    addEventListener: (type: string, listener: (event: any) => void) => void;
    send: (data: string | ArrayBuffer | Blob) => void;
    close: (code?: number, reason?: string) => void;
    readyState: number;
  };
  /** 服务器实例 */
  private server: Server;
  /** 心跳定时器 */
  private pingTimer?: number;
  /** 心跳超时定时器 */
  private pingTimeoutTimer?: number;

  /**
   * 创建 Socket 实例
   * @param ws WebSocket 连接
   * @param server 服务器实例
   * @param handshake 握手信息
   */
  constructor(ws: WebSocket, server: Server, handshake: Handshake) {
    // 调试：检查传入的 ws 对象
    if (!ws || typeof ws !== "object") {
      throw new Error(`无效的 WebSocket 对象: ${typeof ws}`);
    }

    // 检查是否有必要的方法（在 Bun 环境下，ws 应该是 WebSocketAdapter）
    if (
      typeof (ws as any).addEventListener !== "function" &&
      typeof (ws as any).onmessage === "undefined"
    ) {
      throw new Error("构造函数接收到的 WebSocket 对象缺少必要的方法");
    }

    this.ws = ws;
    this.server = server;
    this.handshake = handshake;
    this.id = this.generateId();

    // 设置消息处理（在连接建立之前就设置，适配器会正确处理）
    this.setupMessageHandler();

    // 设置心跳检测
    this.setupHeartbeat();

    // 设置关闭处理
    this.setupCloseHandler();

    // 确保在连接建立后触发 open 事件（如果还没有触发）
    // 这对于 Bun 环境下的 WebSocketAdapter 很重要
    if (
      this.ws.readyState === WebSocket.CONNECTING ||
      this.ws.readyState === WebSocket.OPEN
    ) {
      // 如果连接已经建立或正在建立，等待一下确保适配器已设置
      // 对于 Bun 环境，open 事件会在适配器设置后触发
      // 我们不需要手动触发，只需要确保监听器已经设置好
    }
  }

  /**
   * 生成唯一 ID
   * @returns Socket ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 设置消息处理
   */
  private setupMessageHandler(): void {
    const messageHandler = (event: MessageEvent) => {
      try {
        // 解析消息
        const message = this.parseMessage(event.data);

        // 处理心跳响应
        if (message.type === "pong") {
          this.handlePong();
          return;
        }

        // 处理自定义事件
        if (message.type === "event" && message.event) {
          this.handleEvent(message.event, message.data, message.callbackId);
        }
      } catch (error) {
        this.emit("error", error);
      }
    };

    // 使用统一的 addEventListener API（runtime-adapter 已处理 Deno 和 Bun 的差异）
    // 在 Bun 环境下，this.ws 是 WebSocketAdapter，它有 addEventListener 方法
    // 在 Deno 环境下，this.ws 是原生 WebSocket，也有 addEventListener 方法
    if (!this.ws) {
      throw new Error("WebSocket 对象未初始化");
    }

    // 检查是否有 addEventListener 方法
    if (typeof (this.ws as any).addEventListener === "function") {
      // 在 Bun 环境下，WebSocketAdapter 的 addEventListener 会正确工作
      (this.ws as any).addEventListener("message", messageHandler);
    } else if (typeof (this.ws as any).onmessage !== "undefined") {
      // 后备方案：使用 onmessage（Bun 原生 WebSocket）
      (this.ws as any).onmessage = messageHandler;
    } else {
      throw new Error(
        `WebSocket 对象不支持消息监听。类型: ${typeof this.ws}, 属性: ${
          Object.keys(this.ws || {}).join(", ")
        }`,
      );
    }
  }

  /**
   * 解析消息
   * @param data 消息数据
   * @returns 解析后的消息
   */
  private parseMessage(data: string | ArrayBuffer | Blob): any {
    try {
      if (typeof data === "string") {
        return JSON.parse(data);
      }
      // 二进制消息暂不支持复杂解析
      return { type: "binary", data };
    } catch {
      return { type: "error", data };
    }
  }

  /**
   * 处理事件
   * @param event 事件名称
   * @param data 事件数据
   * @param callbackId 回调 ID
   */
  private handleEvent(event: string, data: any, callbackId?: string): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        const callback = callbackId
          ? (response: any) => {
            this.send({
              type: "callback",
              callbackId,
              data: response,
            });
          }
          : undefined;
        listener(data, callback);
      }
    }
  }

  /**
   * 设置心跳检测
   */
  private setupHeartbeat(): void {
    const pingInterval = this.server.options.pingInterval || 30000;
    const pingTimeout = this.server.options.pingTimeout || 60000;

    // 发送心跳
    this.pingTimer = setInterval(() => {
      if (this.connected) {
        this.send({ type: "ping" });
        // 设置超时定时器
        this.pingTimeoutTimer = setTimeout(() => {
          if (this.connected) {
            this.disconnect("ping timeout");
          }
        }, pingTimeout);
      }
    }, pingInterval) as unknown as number;
  }

  /**
   * 处理心跳响应
   */
  private handlePong(): void {
    if (this.pingTimeoutTimer) {
      clearTimeout(this.pingTimeoutTimer);
      this.pingTimeoutTimer = undefined;
    }
  }

  /**
   * 设置关闭处理
   */
  private setupCloseHandler(): void {
    const closeHandler = () => {
      this.disconnect("client disconnect");
    };

    const errorHandler = (error: Event) => {
      this.emit("error", error);
    };

    // 使用统一的 addEventListener API（runtime-adapter 已处理 Deno 和 Bun 的差异）
    // 在 Bun 环境下，this.ws 是 WebSocketAdapter，它有 addEventListener 方法
    // 在 Deno 环境下，this.ws 是原生 WebSocket，也有 addEventListener 方法
    if (this.ws && typeof (this.ws as any).addEventListener === "function") {
      (this.ws as any).addEventListener("close", closeHandler);
      (this.ws as any).addEventListener("error", errorHandler);
    } else if (this.ws) {
      // 后备方案：使用 onclose/onerror（虽然不应该到达这里）
      (this.ws as any).onclose = closeHandler;
      (this.ws as any).onerror = errorHandler;
    }
  }

  /**
   * 发送消息
   * @param message 消息对象
   */
  private send(message: any): void {
    // 检查是否是 WebSocketAdapter（通过检查是否有 pendingOperations 属性）
    const isAdapter = typeof (this.ws as any).pendingOperations !== "undefined";

    if (isAdapter) {
      // 如果是 WebSocketAdapter（Bun 环境），允许 CONNECTING 状态
      // 适配器会将操作加入 pendingOperations 队列，当 setWebSocket 被调用时执行
      if (
        this.ws.readyState === WebSocket.CONNECTING ||
        this.ws.readyState === WebSocket.OPEN
      ) {
        this.ws.send(JSON.stringify(message));
      }
    } else {
      // 如果是原生 WebSocket（Deno 环境），只在 OPEN 状态时发送
      // Deno 的原生 WebSocket 在 CONNECTING 状态时调用 send 会抛出 InvalidStateError
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
      } else if (this.ws.readyState === WebSocket.CONNECTING) {
        // 如果连接还未打开，等待 open 事件后再发送
        // 使用原生 WebSocket 的 addEventListener（类型断言确保是原生 WebSocket）
        const nativeWs = this.ws as WebSocket;
        const openHandler = () => {
          if (nativeWs.readyState === WebSocket.OPEN) {
            nativeWs.send(JSON.stringify(message));
          }
          // 移除监听器（只在原生 WebSocket 上调用）
          if (typeof nativeWs.removeEventListener === "function") {
            nativeWs.removeEventListener("open", openHandler);
          }
        };
        nativeWs.addEventListener("open", openHandler);
      }
      // 如果连接已关闭，不发送消息
    }
  }

  /**
   * 监听事件
   * @param event 事件名称
   * @param listener 事件监听器
   */
  on(event: string, listener: SocketEventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  /**
   * 取消监听事件
   * @param event 事件名称
   * @param listener 事件监听器（可选，不提供则移除所有监听器）
   */
  off(event: string, listener?: SocketEventListener): void {
    if (!listener) {
      this.listeners.delete(event);
      return;
    }

    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 发送事件（一次性）
   * @param event 事件名称
   * @param data 事件数据
   */
  emit(event: string, data?: any): void {
    this.send({
      type: "event",
      event,
      data,
    });
  }

  /**
   * 加入房间
   * @param room 房间名称
   */
  join(room: string): void {
    this.rooms.add(room);
    this.server.addSocketToRoom(this.id, room);
  }

  /**
   * 离开房间
   * @param room 房间名称
   */
  leave(room: string): void {
    this.rooms.delete(room);
    this.server.removeSocketFromRoom(this.id, room);
  }

  /**
   * 向房间发送消息（不包括自己）
   * @param room 房间名称
   * @param event 事件名称
   * @param data 事件数据
   */
  to(room: string): {
    emit: (event: string, data?: any) => void;
  } {
    return {
      emit: (event: string, data?: any) => {
        this.server.emitToRoom(room, event, data, this.id);
      },
    };
  }

  /**
   * 广播消息（不包括自己）
   * @param event 事件名称
   * @param data 事件数据
   */
  broadcast: {
    emit: (event: string, data?: any) => void;
  } = {
    emit: (event: string, data?: any) => {
      this.server.broadcast(event, data, this.id);
    },
  };

  /**
   * 断开连接
   * @param reason 断开原因
   */
  disconnect(reason?: string): void {
    if (!this.connected) return;

    this.connected = false;

    // 清理定时器
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
    }
    if (this.pingTimeoutTimer) {
      clearTimeout(this.pingTimeoutTimer);
    }

    // 离开所有房间
    for (const room of this.rooms) {
      this.server.removeSocketFromRoom(this.id, room);
    }
    this.rooms.clear();

    // 关闭 WebSocket
    // 在 Bun 环境下，如果适配器的 _ws 还没有被设置，readyState 可能是 CONNECTING
    // 但我们也应该尝试关闭连接，适配器会处理 _ws 未设置的情况
    if (
      this.ws.readyState === WebSocket.OPEN ||
      this.ws.readyState === WebSocket.CONNECTING
    ) {
      this.ws.close();
    }

    // 触发断开事件
    this.emit("disconnect", reason);

    // 从服务器移除
    this.server.removeSocket(this.id);
  }
}

/**
 * WebSocket 服务器类
 */
export class Server {
  /** 服务器配置 */
  public readonly options:
    & Required<Pick<ServerOptions, "path" | "pingTimeout" | "pingInterval">>
    & ServerOptions;
  /** Socket 连接池 */
  private sockets: Map<string, Socket> = new Map();
  /** 适配器到 Socket 实例的映射（用于 Bun 环境） */
  private adapterToSocket: WeakMap<any, Socket> = new WeakMap();
  /** 房间映射（房间名 -> Socket ID 集合） */
  private rooms: Map<string, Set<string>> = new Map();
  /** 事件监听器 */
  private listeners: Map<string, ServerEventListener[]> = new Map();
  /** 中间件列表 */
  private middlewares: Middleware[] = [];
  /** HTTP 服务器句柄 */
  private httpServer?: ServeHandle;

  /**
   * 创建 WebSocket 服务器实例
   * @param options 服务器配置选项
   */
  constructor(options: ServerOptions = {}) {
    this.options = {
      path: options.path || "/",
      pingTimeout: options.pingTimeout || 60000,
      pingInterval: options.pingInterval || 30000,
      ...options,
    };
  }

  /**
   * 添加中间件
   * @param middleware 中间件函数
   */
  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * 监听事件
   * @param event 事件名称
   * @param listener 事件监听器
   */
  on(event: "connection", listener: ServerEventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  /**
   * 获取实际监听端口（port: 0 时由系统分配，listen 后可从 httpServer.port 获取）
   */
  get port(): number | undefined {
    return this.httpServer?.port ??
      (this.options.port !== 0 ? this.options.port : undefined);
  }

  /**
   * 启动服务器
   * @param host 主机地址（可选）
   * @param port 端口号（可选，传 0 则使用系统分配端口）
   */
  listen(host?: string, port?: number): void {
    const serverHost = host || this.options.host || "0.0.0.0";
    const serverPort = port ?? this.options.port ?? 8080;

    // 使用 runtime-adapter 的 serve API，兼容 Deno 和 Bun
    this.httpServer = serve(
      {
        port: serverPort,
        host: serverHost === "0.0.0.0" ? undefined : serverHost,
      },
      async (request: Request) => {
        // 检查路径
        const url = new URL(request.url);
        if (url.pathname === this.options.path) {
          try {
            // 每个 WebSocket 连接都应该创建新的 Socket 实例
            // 不要使用 urlToSocket 来避免重复创建，因为多个连接可能使用相同的 URL

            // 升级 WebSocket 连接
            // 在 Bun 环境下，socket 是 WebSocketAdapter，它实现了 addEventListener 等方法
            // 在 Deno 环境下，socket 是原生 WebSocket
            const upgradeResult = upgradeWebSocket(request);
            const { socket, response } = upgradeResult;

            // 调试：检查 socket 的类型和属性
            if (!socket || typeof socket !== "object") {
              throw new Error(`无效的 WebSocket 对象: ${typeof socket}`);
            }

            // 在 Bun 环境下，socket 应该是 WebSocketAdapter 实例
            // 检查是否有必要的方法（addEventListener 或 onmessage）
            const hasAddEventListener =
              typeof (socket as any).addEventListener === "function";
            const hasOnMessage =
              typeof (socket as any).onmessage !== "undefined";

            if (!hasAddEventListener && !hasOnMessage) {
              // 尝试检查是否是 WebSocketAdapter 实例（通过检查内部属性）
              const adapterKeys = Object.getOwnPropertyNames(socket);
              const prototypeKeys = Object.getOwnPropertyNames(
                Object.getPrototypeOf(socket || {}),
              );
              throw new Error(
                `WebSocket 对象缺少必要的方法。属性: ${
                  adapterKeys.join(", ")
                }, 原型属性: ${prototypeKeys.join(", ")}`,
              );
            }

            // 创建握手信息
            const handshake: Handshake = {
              query: Object.fromEntries(url.searchParams as any),
              headers: request.headers,
              address: request.headers.get("x-forwarded-for") || undefined,
              url: request.url,
            };

            // 创建 Socket 实例
            // WebSocketAdapter 实现了与 WebSocket 兼容的接口，可以直接使用
            // 在 Bun 环境下，socket 是 WebSocketAdapter，它实现了 addEventListener 方法
            // 在 Deno 环境下，socket 是原生 WebSocket
            const socketInstance = new Socket(
              socket as any, // 使用 any 避免类型检查问题，WebSocketAdapter 已实现兼容接口
              this,
              handshake,
            );

            // 将适配器映射到 Socket 实例（用于 Bun 环境下的消息处理）
            this.adapterToSocket.set(socket, socketInstance);

            // 执行中间件
            await this.executeMiddlewares(socketInstance);

            // 添加到连接池
            this.sockets.set(socketInstance.id, socketInstance);

            // 触发连接事件
            this.emit("connection", socketInstance);

            // Bun 环境下 response 可能为 undefined（由 Bun 自动处理）
            return response ||
              new Response("WebSocket upgrade", { status: 101 });
          } catch (error) {
            return new Response("WebSocket upgrade failed", { status: 500 });
          }
        }

        return new Response("Not Found", { status: 404 });
      },
    );
  }

  /**
   * 执行中间件
   * @param socket Socket 实例
   */
  private async executeMiddlewares(socket: Socket): Promise<void> {
    for (const middleware of this.middlewares) {
      await new Promise<void>((resolve, reject) => {
        const next = (error?: Error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        };
        const result = middleware(socket, next);
        if (result instanceof Promise) {
          result.catch(reject);
        }
      });
    }
  }

  /**
   * 触发事件
   * @param event 事件名称
   * @param socket Socket 实例
   */
  private emit(event: "connection", socket: Socket): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        listener(socket);
      }
    }
  }

  /**
   * 添加 Socket 到房间
   * @param socketId Socket ID
   * @param room 房间名称
   */
  addSocketToRoom(socketId: string, room: string): void {
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room)!.add(socketId);
  }

  /**
   * 从房间移除 Socket
   * @param socketId Socket ID
   * @param room 房间名称
   */
  removeSocketFromRoom(socketId: string, room: string): void {
    const roomSockets = this.rooms.get(room);
    if (roomSockets) {
      roomSockets.delete(socketId);
      if (roomSockets.size === 0) {
        this.rooms.delete(room);
      }
    }
  }

  /**
   * 向房间发送消息
   * @param room 房间名称
   * @param event 事件名称
   * @param data 事件数据
   * @param excludeSocketId 排除的 Socket ID
   */
  emitToRoom(
    room: string,
    event: string,
    data?: any,
    excludeSocketId?: string,
  ): void {
    const roomSockets = this.rooms.get(room);
    if (roomSockets) {
      for (const socketId of roomSockets) {
        if (socketId !== excludeSocketId) {
          const socket = this.sockets.get(socketId);
          if (socket && socket.connected) {
            socket.emit(event, data);
          }
        }
      }
    }
  }

  /**
   * 广播消息
   * @param event 事件名称
   * @param data 事件数据
   * @param excludeSocketId 排除的 Socket ID
   */
  broadcast(event: string, data?: any, excludeSocketId?: string): void {
    for (const [socketId, socket] of this.sockets.entries()) {
      if (socketId !== excludeSocketId && socket.connected) {
        socket.emit(event, data);
      }
    }
  }

  /**
   * 移除 Socket
   * @param socketId Socket ID
   */
  removeSocket(socketId: string): void {
    this.sockets.delete(socketId);
  }

  /**
   * 关闭服务器
   */
  async close(): Promise<void> {
    // 关闭所有连接
    for (const socket of this.sockets.values()) {
      socket.disconnect("server shutdown");
    }

    // 关闭 HTTP 服务器，添加超时保护
    if (this.httpServer) {
      try {
        await Promise.race([
          this.httpServer.shutdown(),
          new Promise<void>((_, reject) => {
            setTimeout(() => reject(new Error("服务器关闭超时")), 2000);
          }),
        ]);
      } catch (error) {
        // 如果超时，强制关闭
      }
    }
  }
}
