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
  socket: WebSocket;
  response: Response;
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
  options: ServeOptions | ((req: Request) => Response | Promise<Response>),
  handler?: (req: Request) => Response | Promise<Response>,
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
          // 空的 websocket 处理器，允许升级
          message() {},
          open() {},
          close() {},
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
        // 空的 websocket 处理器，允许升级
        message() {},
        open() {},
        close() {},
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
    const upgradeOptions: any = {};
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
    // 这里返回一个占位符 Response，实际的 socket 需要在 websocket 处理器中获取
    // 为了兼容 Deno 的 API，我们返回一个空的 Response
    return {
      socket: {} as WebSocket, // 占位符，实际 socket 在 websocket 处理器中
      response: new Response(null, {
        status: 101,
        statusText: "Switching Protocols",
      }),
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
