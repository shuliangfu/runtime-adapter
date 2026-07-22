/**
 * 网络 API 适配模块
 * 提供统一的网络操作接口，兼容 Deno / Bun / Node.js
 */

import { AsyncLocalStorage } from "node:async_hooks";
import * as http from "node:http";
import * as net from "node:net";
import { Readable, Writable } from "node:stream";
import * as tls from "node:tls";
import { type WebSocket as WsWebSocket, WebSocketServer } from "ws";
import { IS_BUN, IS_NODE } from "./detect.ts";
import { unsupportedRuntimeError } from "./errors.ts";
import { $tr } from "./i18n.ts";
import type { BunServer, BunSocket, BunWebSocket } from "./types.ts";
import { getBun, getDeno } from "./utils.ts";

/**
 * 【Why】H5：WebSocket 默认 maxPayload 1MB，纵深防御大消息 OOM。可在 ServeOptions.websocket
 * 或 UpgradeWebSocketOptions.maxPayload 覆盖。
 * 【Perf】ws 包在收满 maxPayload 字节后立即断开连接，避免无限缓冲。
 */
const DEFAULT_WS_MAX_PAYLOAD = 1 << 20; // 1MB
/**
 * 【Why】H5：WebSocket 默认空闲超时 120s，超时后服务端主动 close(1001)。
 * 【Invariant】0/负数禁用（仅 Node per-connection 定时器；Bun/Deno 用原生机制）。
 */
const DEFAULT_WS_IDLE_TIMEOUT_MS = 120_000;
/**
 * 【Why】H2/H3：connect/startTls 默认超时 30s，防止不可达主机永久挂起占 fd。
 * 【Invariant】0/负数禁用（无限等待）。
 */
const DEFAULT_CONNECT_TIMEOUT_MS = 30_000;

/**
 * HTTP 服务器选项
 */
export interface ServeOptions {
  port?: number;
  host?: string;
  onListen?: (params: { host: string; port: number }) => void;
  /**
   * WebSocket 升级允许的 Origin 列表（CSWSH 防护）。
   * 未设置时默认同源校验（Origin hostname+port 比对 Host 头）；
   * 设置后仅精确匹配列表中的 Origin（含 "null" 字面量）。非浏览器客户端（无 Origin）始终放行。
   */
  allowedOrigins?: string[];
  /**
   * WebSocket 全局配置（H5 纵深防御）。
   * - maxPayload：单条消息最大字节数，默认 1MB，超限 ws 包自动断开连接。
   * - idleTimeout：空闲超时毫秒数，默认 120000，0/负数禁用。
   */
  websocket?: { maxPayload?: number; idleTimeout?: number };
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

/**
 * Bun：请求处理期间的 server 上下文（支持多 serve 并发，避免全局单例串台）。
 * upgradeWebSocket 优先取 ALS，其次回退 lastBunServer（兼容非 fetch 路径）。
 */
const bunServerAls = new AsyncLocalStorage<BunServer>();
/** 最近一次 serve 绑定的 BunServer（单服务场景回退） */
let lastBunServer: BunServer | null = null;

function resolveBunServer(): BunServer | null {
  return bunServerAls.getStore() ?? lastBunServer;
}

// Bun 环境下，存储待处理的 WebSocket 适配器
// 当 upgradeWebSocket 被调用时，我们存储适配器，然后在 websocket 处理器中设置实际的 WebSocket
const pendingBunAdapters = new Map<string, WebSocketAdapter>();

/**
 * Node：WebSocket 升级上下文（通过 ALS 从 server.on("upgrade") 传递到 upgradeWebSocket）。
 * Node 的 WS 升级走独立 "upgrade" 事件（不像 Bun/Deno 在 fetch handler 内同步升级），
 * 故需在 upgrade 事件回调中把 {req, socket, head, wss} 存入 ALS，handler 内调
 * upgradeWebSocket 时读取并调 wss.handleUpgrade。
 */
interface NodeUpgradeCtx {
  req: http.IncomingMessage;
  socket: net.Socket;
  head: Buffer;
  wss: WebSocketServer;
  upgraded: boolean; // upgradeWebSocket 调用后置 true，upgrade 事件回调据此判断是否拒绝
  /** serve 级别 idleTimeout（ms），per-call options.idleTimeout 优先覆盖 */
  idleTimeoutMs: number;
}

const nodeUpgradeAls = new AsyncLocalStorage<NodeUpgradeCtx>();
/** 最近一次 serve 创建的 http.Server（单服务场景回退） */
let lastNodeServer: http.Server | null = null;
/** 最近一次 serve 创建的 WebSocketServer（单服务场景回退） */
let lastNodeWss: WebSocketServer | null = null;
/** Node 环境下待处理的 WebSocket 适配器（key = request.url） */
const pendingNodeAdapters = new Map<string, WebSocketAdapter>();

/**
 * WebSocket 升级 Origin 校验：把 serve() 配置的 allowedOrigins 绑定到具体 Request，
 * upgradeWebSocket 据此校验。WeakMap 随 Request GC 自动清理，无内存泄漏。
 */
const wsAllowedOriginsByReq = new WeakMap<Request, string[] | undefined>();

/**
 * 判定 WebSocket 升级请求的 Origin 是否被允许（防 CSWSH 跨站劫持）。
 * 【Why】浏览器在 evil.com 打开 ws://victim.com 时会自动带 Origin: http://evil.com，
 * 若服务端不校验则被劫持。默认同源校验（Origin hostname+port 归一化后比对 Host 头），
 * allowedOrigins 显式覆盖。
 * 【Invariant】fail-closed：无 Origin（非浏览器客户端）放行；有 Origin 但无法验证则拒。
 */
function isWsOriginAllowed(
  origin: string | null | undefined,
  host: string | null | undefined,
  allowedOrigins?: string[],
): boolean {
  // 无 Origin header → 非浏览器客户端（curl/服务端 WS），放行
  if (!origin) return true;
  // allowedOrigins 显式配置：精确匹配（含 "null" 字面量场景）
  if (allowedOrigins && allowedOrigins.length > 0) {
    return allowedOrigins.includes(origin);
  }
  // 默认同源校验：无 Host 无法验证 → 拒绝；Origin==="null"（沙箱）无可比对源 → 拒绝
  if (!host || origin === "null") return false;
  try {
    const o = new URL(origin);
    const oHost = o.hostname;
    // Origin 端口缺省时按协议默认端口归一化
    const oPort = o.port ||
      (o.protocol === "https:" || o.protocol === "wss:" ? "443" : "80");
    // Host 头：hostname[:port]，port 缺省按 80（本适配层 serve 走 http）
    let hHost: string, hPort: string;
    const bracket = host.lastIndexOf("]");
    const colonIdx = bracket > -1
      ? host.indexOf(":", bracket)
      : host.lastIndexOf(":");
    if (colonIdx > -1) {
      hHost = host.slice(0, colonIdx);
      hPort = host.slice(colonIdx + 1);
    } else {
      hHost = host;
      hPort = "80";
    }
    // 归一化默认端口：80/443 统一视为 80（http 服务）
    const norm = (
      p: string,
    ) => (p === "" || p === "80" || p === "443" ? "80" : p);
    return oHost === hHost && norm(oPort) === norm(hPort);
  } catch {
    // Origin 非合法 URL → 拒绝
    return false;
  }
}

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
    console.log($tr("debug.wsPrefix"), msg, ...args);
  }
}

/**
 * 从 pendingBunAdapters 中查找并移除适配器。
 * 匹配策略（按优先级）：
 * 1. ws.data.adapterId 精确匹配
 * 2. ws.url 精确匹配
 * 3. ws.url 路径+host+port 匹配
 * 4. 单个 pending 适配器直接使用
 * 5. 第一个未就绪的 pending 适配器
 */
function findAndRemovePendingAdapter(
  ws: BunWebSocket,
): { adapter: WebSocketAdapter | undefined; matchedKey: string | undefined } {
  const wsData = ws.data as { adapterId?: string } | undefined;
  const wsUrl = ws.url || "";

  // 1. adapterId 精确匹配
  if (wsData?.adapterId) {
    const adapter = pendingBunAdapters.get(wsData.adapterId);
    if (adapter) return { adapter, matchedKey: wsData.adapterId };
  }

  // 2. ws.url 精确匹配
  if (wsUrl) {
    const adapter = pendingBunAdapters.get(wsUrl);
    if (adapter) return { adapter, matchedKey: wsUrl };

    // 3. ws → http 协议转换后匹配
    const httpUrl = wsUrl.replace(/^ws:/, "http:").replace(/^wss:/, "https:");
    if (httpUrl !== wsUrl) {
      const adapter = pendingBunAdapters.get(httpUrl);
      if (adapter) return { adapter, matchedKey: httpUrl };
    }

    // 4. 路径+host+port 匹配
    try {
      const wsUrlObj = new URL(wsUrl);
      for (const [key, value] of pendingBunAdapters.entries()) {
        try {
          const keyUrlObj = new URL(key);
          if (
            wsUrlObj.pathname === keyUrlObj.pathname &&
            wsUrlObj.hostname === keyUrlObj.hostname &&
            wsUrlObj.port === keyUrlObj.port
          ) {
            return { adapter: value, matchedKey: key };
          }
        } catch {
          // 忽略无效的 URL
        }
      }
    } catch {
      // 忽略无效的 URL
    }
  }

  // 5. 单个 pending 适配器直接使用
  if (pendingBunAdapters.size === 1) {
    const entry = pendingBunAdapters.entries().next().value;
    if (entry) {
      const [matchedKey, adapter] = entry;
      return { adapter, matchedKey };
    }
  }

  // 6. 第一个未就绪的 pending 适配器
  for (const [key, value] of pendingBunAdapters.entries()) {
    if (!value.isWebSocketReady()) {
      return { adapter: value, matchedKey: key };
    }
  }

  return { adapter: undefined, matchedKey: undefined };
}

/**
 * 创建 Bun WebSocket 事件处理器（message/open/close）。
 *
 * 函数式 serve 和对象式 serve 共用此处理器，消除重复代码。
 * close 事件中同时清理 allAdapters，防止内存泄漏。
 */
function createBunWebSocketHandlers() {
  return {
    message(ws: BunWebSocket, message: string | Uint8Array) {
      let adapter = Array.from(WebSocketAdapter.allAdapters).find(
        (a) => a.getWebSocket() === ws,
      );
      if (!adapter && pendingBunAdapters.size > 0) {
        const { adapter: found } = findAndRemovePendingAdapter(ws);
        adapter = found;
        if (adapter && !adapter.isWebSocketReady()) {
          adapter.setWebSocket(ws);
          const wsUrl = ws.url || "";
          const wsData = ws.data as { adapterId?: string } | undefined;
          if (wsUrl && pendingBunAdapters.has(wsUrl)) {
            pendingBunAdapters.delete(wsUrl);
          } else if (
            wsData?.adapterId && pendingBunAdapters.has(wsData.adapterId)
          ) {
            pendingBunAdapters.delete(wsData.adapterId);
          } else {
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
        adapter.emit(
          "message",
          new MessageEvent("message", { data: message }),
        );
      }
    },

    open(ws: BunWebSocket) {
      const wsData = ws.data as { adapterId?: string } | undefined;
      const wsUrl = ws.url || "";
      wsDebug(
        $tr("debug.openWsCalled"),
        wsData?.adapterId,
        $tr("debug.wsUrl"),
        wsUrl,
        $tr("debug.pendingSize"),
        pendingBunAdapters.size,
        $tr("debug.pendingKeys"),
        [...pendingBunAdapters.keys()],
      );

      let { adapter, matchedKey } = findAndRemovePendingAdapter(ws);

      // 若 pending 中未找到，兜底：唯一的未就绪适配器
      if (!adapter) {
        const unready = Array.from(WebSocketAdapter.allAdapters).filter(
          (a) => !a.isWebSocketReady(),
        );
        if (unready.length === 1) adapter = unready[0];
      }

      wsDebug($tr("debug.adapterFound"), !!adapter);
      if (adapter) {
        adapter.setWebSocket(ws);
        if (matchedKey) {
          pendingBunAdapters.delete(matchedKey);
        } else {
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
      let adapter = Array.from(WebSocketAdapter.allAdapters).find(
        (a) => a.getWebSocket() === ws,
      );
      if (!adapter) {
        const { adapter: found } = findAndRemovePendingAdapter(ws);
        adapter = found;
      }
      if (adapter) {
        adapter.emit(
          "close",
          new CloseEvent("close", {
            code: code || 1000,
            reason: reason || "",
          }),
        );
        // 清理 allAdapters 防止内存泄漏
        WebSocketAdapter.allAdapters.delete(adapter);
      }
    },
  };
}

/**
 * 将 Node http.IncomingMessage 转换为 Web Request。
 * URL 从 Host header + req.url 重建；body 用 Readable.toWeb(req) 包装（GET/HEAD 无 body）。
 */
function nodeReqToRequest(req: http.IncomingMessage): Request {
  const host = req.headers.host || "localhost";
  const url = `http://${host}${req.url || "/"}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        for (const v of value) headers.append(key, v);
      } else {
        headers.set(key, value);
      }
    }
  }
  const method = req.method || "GET";
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody
    ? (Readable.toWeb(req) as ReadableStream<Uint8Array>)
    : null;
  return new Request(url, {
    method,
    headers,
    body,
    // @ts-expect-error Node Request 支持 duplex:'half'（TS lib.dom.d.ts 无此字段）
    duplex: "half",
  });
}

/**
 * 将 Web Response 写入 Node http.ServerResponse。
 * 状态码 + headers 直接设置；body 若为 ReadableStream 则 pipe 到 res。
 */
async function writeResponseToNodeRes(
  res: http.ServerResponse,
  response: Response,
): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  if (response.body) {
    const writer = Writable.toWeb(res);
    await response.body.pipeTo(writer);
  } else {
    res.end();
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

export class WebSocketAdapter {
  private _ws: WebSocket | null = null;
  private listeners: Map<string, Set<(event: WebSocketEvent) => void>> =
    new Map();
  private pendingOperations: Array<() => void> = [];
  // 存储所有已创建的适配器（用于 Bun 环境下的查找）
  public static allAdapters: Set<WebSocketAdapter> = new Set();
  // 唯一标识符（用于调试）
  private readonly id: string;
  // 【Why】H5：空闲超时定时器（Node ws 无原生 idleTimeout，per-connection 管理）
  private idleTimeoutMs: number = DEFAULT_WS_IDLE_TIMEOUT_MS;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

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
      $tr("debug.setWebSocketAdapterId"),
      this.id,
      $tr("debug.openListeners"),
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
    // Node 同理：ws 包 wss.handleUpgrade 回调同步触发（在 upgradeWebSocket 返回前），
    // handler 的 addEventListener("open") 尚未执行，故 Node 也需 setTimeout(0) 推迟 emit。
    // Deno 不走此路径（upgradeWebSocket 直接返回原生 socket，不创建 adapter）。
    if (IS_BUN || IS_NODE) {
      setTimeout(() => {
        wsDebug(
          $tr("debug.setWebSocketEmittingOpen"),
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

    // Bun/Node 环境下，将 onmessage、onclose、onerror 转换为 addEventListener
    // （ws 包的 WsWebSocket 同样支持 onmessage/onclose/onerror 属性赋值）
    if (IS_BUN || IS_NODE) {
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
        // 【Why】P1：关闭时从 allAdapters 移除（Set.delete 幂等，与 Bun 路径双重清理安全）。
        // 定时器清理由 emit("close") 统一处理。
        WebSocketAdapter.allAdapters.delete(this);
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
   * 设置空闲超时（H5）。ms <= 0 禁用。
   * 【Invariant】仅在 ws 就绪后有效；定时器触发时 close(1001) 主动断开空闲连接。
   */
  setIdleTimeout(ms: number): void {
    this.idleTimeoutMs = ms > 0 ? ms : 0;
    if (this.idleTimeoutMs > 0) {
      this.startIdleTimer();
    } else {
      this.clearIdleTimer();
    }
  }

  /** 启动/重启空闲定时器 */
  private startIdleTimer(): void {
    this.clearIdleTimer();
    if (this.idleTimeoutMs <= 0) return;
    this.idleTimer = setTimeout(() => {
      // 【Why】空闲超时：主动关闭，防止僵尸连接占资源
      if (this._ws && typeof this._ws.close === "function") {
        try {
          this._ws.close(1001, "idle timeout");
        } catch {
          // ws 已关闭则忽略
        }
      }
    }, this.idleTimeoutMs);
  }

  /** 重置空闲定时器（收到消息时调用） */
  private resetIdleTimer(): void {
    if (this.idleTimeoutMs > 0) {
      this.startIdleTimer();
    }
  }

  /** 清除空闲定时器 */
  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /**
   * 添加事件监听器（兼容 Deno 和 Bun）
   */
  addEventListener(
    type: string,
    listener: (event: WebSocketEvent) => void,
  ): void {
    if (IS_BUN || IS_NODE) {
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
    if (IS_BUN || IS_NODE) {
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
    // 【Why】H5：统一在 emit 咽喉点管理空闲定时器——Bun 走 createBunWebSocketHandlers
    // 调 emit，Node 走 setupEventHandlers 调 emit，此处覆盖三端消息/关闭/错误。
    if (type === "message") {
      this.resetIdleTimer();
    } else if (type === "close" || type === "error") {
      this.clearIdleTimer();
    }
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
  /** WS 升级允许的 Origin 列表，覆盖 serve() 级别配置（CSWSH 防护）。 */
  allowedOrigins?: string[];
  /** 单条消息最大字节数（per-call 覆盖 serve 级别，默认 1MB）。 */
  maxPayload?: number;
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
  /** 连接超时毫秒数，默认 30000；0/负数禁用。 */
  timeout?: number;
}

/**
 * TLS 连接选项
 */
export interface StartTlsOptions {
  host?: string;
  caCerts?: Uint8Array[];
  alpnProtocols?: string[];
  /** TLS 握手超时毫秒数，默认 30000；0/负数禁用。 */
  timeout?: number;
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

    const handle = deno.serve(
      newOptions,
      (req: Request): Response | Promise<Response> => {
        // 【Why】H1：绑定 serve 级别 allowedOrigins 到此 Request，供 upgradeWebSocket 读取
        wsAllowedOriginsByReq.set(req, serveOptions.allowedOrigins);
        const result = handler!(req);
        // 确保返回 Response，而不是 undefined（勿用 async/await，否则 WebSocket 升级无法同步返回 101）
        if (result === undefined) {
          return new Response(null, { status: 404 });
        }
        if (result instanceof Promise) {
          return result.then((r) => r ?? new Response(null, { status: 404 }));
        }
        return result;
      },
    );

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
    // Bun.serve：每个请求在 ALS 中绑定 server，支持多实例并发 upgrade
    if (typeof options === "function") {
      const server = bun.serve({
        fetch: async (req: Request, srv: BunServer) => {
          return await bunServerAls.run(srv, async () => {
            lastBunServer = srv;
            const isWs =
              req.headers.get("Upgrade")?.toLowerCase() === "websocket";
            if (isWs) {
              await options(req);
              return new Response(null, { status: 101 }) as Response;
            }
            return (await options(req)) as Response;
          });
        },
        websocket: createBunWebSocketHandlers(),
      });
      lastBunServer = server;
      return {
        finished: new Promise(() => {}),
        port: server.port,
        shutdown() {
          if (lastBunServer === server) lastBunServer = null;
          return Promise.resolve(server.stop());
        },
      };
    }

    const server = bun.serve({
      port: options.port ?? 3000,
      hostname: options.host ?? "0.0.0.0",
      fetch: async (req: Request, srv: BunServer) => {
        return await bunServerAls.run(srv, async () => {
          lastBunServer = srv;
          // 【Why】H1：绑定 serve 级别 allowedOrigins 到此 Request，供 upgradeWebSocket 读取
          wsAllowedOriginsByReq.set(req, options.allowedOrigins);
          const isWs =
            req.headers.get("Upgrade")?.toLowerCase() === "websocket";
          if (isWs) {
            wsDebug($tr("debug.fetchUpgradeRequest"));
            await handler!(req);
            wsDebug($tr("debug.fetchHandlerCompleted"));
            return new Response(null, { status: 101 }) as Response;
          }
          return (await handler!(req)) as Response;
        });
      },
      websocket: createBunWebSocketHandlers(),
    });
    lastBunServer = server;

    if (options.onListen) {
      options.onListen({
        host: server.hostname || options.host || "0.0.0.0",
        port: server.port || options.port || 3000,
      });
    }

    return {
      finished: new Promise(() => {}),
      port: server.port || options.port || 3000,
      shutdown() {
        if (lastBunServer === server) lastBunServer = null;
        return Promise.resolve(server.stop());
      },
    };
  }

  if (IS_NODE) {
    const fetchHandler = typeof options === "function" ? options : handler!;
    const serveOpts = typeof options === "function"
      ? ({} as ServeOptions)
      : (options as ServeOptions);

    // 【Why】H5：wss 级别 maxPayload 限制单条消息大小，超限 ws 包自动断开连接防 OOM
    const wss = new WebSocketServer({
      noServer: true,
      maxPayload: serveOpts.websocket?.maxPayload ?? DEFAULT_WS_MAX_PAYLOAD,
    });
    lastNodeWss = wss;

    const server = http.createServer(async (req, res) => {
      try {
        const webReq = nodeReqToRequest(req);
        const result = await fetchHandler(webReq);
        if (result === undefined) {
          await writeResponseToNodeRes(
            res,
            new Response(null, { status: 404 }),
          );
        } else {
          await writeResponseToNodeRes(res, result);
        }
      } catch (err) {
        // 【Why】C2：不向客户端泄露内部错误细节（堆栈/路径/参数），仅记服务端审计日志
        console.error($tr("error.internalServerError"), err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end($tr("error.internalServerError"));
        } else {
          res.destroy();
        }
      }
    });

    server.on("upgrade", (req, socket, head) => {
      const webReq = nodeReqToRequest(req);
      // 【Why】H1：CSWSH 防护咽喉点（Node）。绑定 serve 级别 allowedOrigins 到此 Request，
      // 供 upgradeWebSocket 读取；同时在进入 handler 前做干净 403 拒绝，避免误升级。
      wsAllowedOriginsByReq.set(webReq, serveOpts.allowedOrigins);
      if (
        !isWsOriginAllowed(
          req.headers.origin,
          req.headers.host,
          serveOpts.allowedOrigins,
        )
      ) {
        console.error($tr("error.wsOriginRejected"));
        socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }

      const ctx: NodeUpgradeCtx = {
        req,
        socket: socket as net.Socket,
        head,
        wss,
        upgraded: false,
        idleTimeoutMs: serveOpts.websocket?.idleTimeout ??
          DEFAULT_WS_IDLE_TIMEOUT_MS,
      };
      nodeUpgradeAls.run(ctx, async () => {
        try {
          await fetchHandler(webReq);
          // handler 未调 upgradeWebSocket → 拒绝升级
          if (!ctx.upgraded) {
            socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
            socket.destroy();
          }
        } catch (_e) {
          // 【Why】upgradeWebSocket 已设 ctx.upgraded=true 并同步调 wss.handleUpgrade 接管
          // socket；若 fetchHandler 后续代码抛错（如 Response(101) 在 undici 下 RangeError），
          // 不可 destroy 已升级 socket——否则 wss 创建的 ws 收不到消息，WS 测试静默失败。
          // 仅未升级时 destroy 拒绝连接。
          if (!ctx.upgraded) {
            socket.destroy();
          }
        }
      });
    });

    lastNodeServer = server;

    const listenPort = serveOpts.port ?? 0;
    const listenHost = serveOpts.host ?? "0.0.0.0";

    // 【Why】Node 的 server.listen() 异步：端口绑定在事件循环后续 tick 完成，
    // 若同步返回 handle，handle.port 读 server.address() 得 null → undefined。
    // Deno/Bun 的原生 serve 同步返回且 port 立即可用；Node 用 Promise 在 listen
    // 回调（绑定完成）后 resolve handle，对齐语义。调用方须 await serve(...)。
    // 【Invariant】类型标注 ServeHandle（运行时 Promise<ServeHandle>），适配层
    // 弥合三端差异——Deno/Bun 分支同步返回 ServeHandle，Node 分支返回 Promise。
    return new Promise<ServeHandle>((resolve) => {
      server.listen(listenPort, listenHost, () => {
        if (serveOpts.onListen) {
          const addr = server.address() as net.AddressInfo;
          serveOpts.onListen({ host: addr.address, port: addr.port });
        }
        resolve({
          finished: new Promise<void>((resolveFinished) => {
            server.on("close", () => resolveFinished());
          }),
          get port(): number | undefined {
            const addr = server.address();
            return addr && typeof addr === "object" ? addr.port : undefined;
          },
          shutdown(shutdownOpts?: { graceful?: boolean }): Promise<void> {
            // 关闭所有 WS 连接（ws 包无类型声明，WsWebSocket 为 any，显式标注避免 implicit any）
            wss.clients.forEach((ws: WsWebSocket) => ws.close());
            wss.close();
            // 非优雅关闭：立即断开所有 HTTP 连接
            if (!shutdownOpts?.graceful) {
              if (typeof server.closeAllConnections === "function") {
                server.closeAllConnections();
              }
            }
            if (lastNodeServer === server) lastNodeServer = null;
            if (lastNodeWss === wss) lastNodeWss = null;
            return new Promise<void>((resolveShutdown) => {
              server.close(() => resolveShutdown());
            });
          },
        });
      });
    }) as unknown as ServeHandle;
  }

  throw unsupportedRuntimeError($tr("error.unsupportedRuntime"));
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
  // 【Why】CSWSH 防护：在升级前校验 Origin。三端统一咽喉点。
  // allowedOrigins 优先取 per-call options，其次 serve() 经 WeakMap 绑定的配置。
  // Node upgrade handler 已做干净 403 拒绝；此处对 Deno/Bun 抛错使升级被拒（连接不建立）。
  const allowed = options?.allowedOrigins ?? wsAllowedOriginsByReq.get(request);
  if (
    !isWsOriginAllowed(
      request.headers.get("origin"),
      request.headers.get("host"),
      allowed,
    )
  ) {
    console.error($tr("error.wsOriginRejected"));
    throw new Error($tr("error.wsOriginRejected"));
  }

  const deno = getDeno();
  if (deno) {
    return deno.upgradeWebSocket(request, options);
  }

  if (IS_BUN) {
    // Bun 使用 server.upgrade()：优先当前请求 ALS 中的 server，再回退 lastBunServer
    const bunServerInstance = resolveBunServer();
    if (!bunServerInstance) {
      throw unsupportedRuntimeError($tr("error.bunWsNeedServe"));
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
    // 【Why】H5：Bun 无 per-connection idleTimeout 原生 API，用适配器定时器管理
    adapter.setIdleTimeout(options?.idleTimeout ?? DEFAULT_WS_IDLE_TIMEOUT_MS);
    wsDebug(
      $tr("debug.upgradeWebSocketUrl"),
      url,
      $tr("debug.pendingSize"),
      pendingBunAdapters.size,
    );

    // 尝试升级 WebSocket（open(ws) 可能在此调用栈内同步触发，此时已能通过 adapterId 找到 adapter）
    const upgraded = bunServerInstance.upgrade(request, upgradeOptions);
    wsDebug($tr("debug.upgradeResult"), upgraded);

    if (!upgraded) {
      pendingBunAdapters.delete(url);
      throw new Error($tr("error.wsUpgradeFailed"));
    }

    // 检查适配器是否正确创建
    if (typeof adapter.addEventListener !== "function") {
      throw new Error($tr("error.wsAdapterMissingAddEventListener"));
    }

    // 在 Bun 环境下，返回 undefined 作为 response，让 Bun 自动处理 WebSocket 升级响应
    // 这样 open 事件才能被正确触发
    // 注意：直接返回 adapter，不要进行类型断言，让 TypeScript 处理类型
    return {
      socket: adapter as unknown as WebSocket, // 返回适配器，但类型为 WebSocket
      response: undefined, // Bun 会自动处理 101 响应
    };
  }

  if (IS_NODE) {
    const ctx = nodeUpgradeAls.getStore();
    if (!ctx) {
      throw new Error($tr("error.nodeWsNeedServe"));
    }

    const url = request.url;

    // 沿用 Bun 的 placeholder 模式：upgradeWebSocket 同步返回，
    // 实际 ws 在 wss.handleUpgrade 回调（异步）中通过 setWebSocket 注入
    const placeholderWs = new Proxy({} as WebSocket, {
      get(_target, prop) {
        if (prop === "readyState") return WebSocket.CONNECTING;
        if (prop === "protocol" || prop === "url") return "";
        if (typeof prop === "string" && prop.startsWith("on")) return undefined;
        return undefined;
      },
    });

    const adapter = new WebSocketAdapter(placeholderWs as WebSocket);
    pendingNodeAdapters.set(url, adapter);
    // 【Why】H5：per-call idleTimeout 优先，回退 serve 级别 ctx.idleTimeoutMs
    adapter.setIdleTimeout(options?.idleTimeout ?? ctx.idleTimeoutMs);

    ctx.upgraded = true;

    ctx.wss.handleUpgrade(
      ctx.req,
      ctx.socket,
      ctx.head,
      (ws: WsWebSocket) => {
        // 【Why】H5：per-call maxPayload 覆盖 wss 级别默认值
        if (options?.maxPayload !== undefined) {
          (ws as unknown as { setMaxPayload(n: number): void })
            .setMaxPayload(options.maxPayload);
        }
        adapter.setWebSocket(ws as unknown as WebSocket);
        pendingNodeAdapters.delete(url);
      },
    );

    return {
      socket: adapter as unknown as WebSocket,
      response: undefined,
    };
  }

  throw new Error($tr("error.unsupportedRuntime"));
}

/**
 * 建立 TCP 连接
 * @param options 连接选项
 * @returns TCP 连接句柄
 */
export async function connect(options: ConnectOptions): Promise<TcpConn> {
  const deno = getDeno();
  if (deno) {
    const timeoutMs = options.timeout ?? DEFAULT_CONNECT_TIMEOUT_MS;
    // 【Why】H2：AbortSignal.timeout 超时后 abort Deno.connect，释放 fd
    try {
      return await deno.connect({
        hostname: options.host,
        port: options.port,
        transport: options.transport,
        ...(timeoutMs > 0 ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        throw new Error($tr("error.connectTimeout"));
      }
      throw err;
    }
  }

  const bun = getBun();
  if (bun) {
    // 【Why】H2：超时阈值；0/负数禁用（与 Deno/Node 分支一致）
    const timeoutMs = options.timeout ?? DEFAULT_CONNECT_TIMEOUT_MS;
    return new Promise<TcpConn>((resolve, reject) => {
      // 创建 ReadableStream 和 WritableStream 的控制器
      let readableController:
        | ReadableStreamDefaultController<Uint8Array>
        | null = null;
      let socket: BunSocket | null = null;
      // 【Why】H2：settled 防止超时后 open 回调重复 resolve；timer 超时 terminate socket 释放 fd
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const done = (fn: () => void) => {
        if (settled) return;
        settled = true;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        fn();
      };

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          done(() => {
            if (socket && typeof socket.terminate === "function") {
              socket.terminate();
            }
            reject(new Error($tr("error.connectTimeout")));
          });
        }, timeoutMs);
      }

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
              // 连接成功，解析 Promise（done 确保超时后不再重复 resolve）
              done(() => {
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
              done(() => reject(error));
            },
            connectError(_sock: BunSocket, error: Error) {
              // 连接错误
              done(() => reject(error));
            },
          },
        });
      } catch (error) {
        done(() => reject(error));
      }
    });
  }

  if (IS_NODE) {
    const socket = net.createConnection({
      host: options.host,
      port: options.port,
    });
    const timeoutMs = options.timeout ?? DEFAULT_CONNECT_TIMEOUT_MS;

    // 【Why】H2：超时 destroy socket 释放 fd，clearTimeout 防泄漏
    await new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          socket.destroy();
          reject(new Error($tr("error.connectTimeout")));
        }, timeoutMs);
      }
      socket.once("connect", () => {
        if (timer) clearTimeout(timer);
        resolve();
      });
      socket.once("error", (err) => {
        if (timer) clearTimeout(timer);
        reject(err);
      });
    });

    const addr = socket.address() as net.AddressInfo;

    return {
      localAddr: {
        host: addr.address,
        port: addr.port,
        transport: "tcp",
      },
      remoteAddr: {
        host: socket.remoteAddress || options.host,
        port: socket.remotePort || options.port,
        transport: "tcp",
      },
      readable: Readable.toWeb(socket) as ReadableStream<Uint8Array>,
      writable: Writable.toWeb(socket) as WritableStream<Uint8Array>,
      close() {
        socket.destroy();
      },
      closeWrite() {
        socket.end();
      },
    };
  }

  throw new Error($tr("error.unsupportedRuntime"));
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
    // 【Why】H3：TLS 握手超时，防止恶意对端永久挂起握手占 fd
    const timeoutMs = options?.timeout ?? DEFAULT_CONNECT_TIMEOUT_MS;
    const signalOpts = timeoutMs > 0
      ? { signal: AbortSignal.timeout(timeoutMs) }
      : undefined;
    try {
      return (await deno.startTls(
        conn as unknown as Parameters<typeof deno.startTls>[0],
        tlsOptions,
        signalOpts,
      )) as TcpConn;
    } catch (err) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        try {
          conn.close();
        } catch {
          // 忽略关闭错误
        }
        throw new Error($tr("error.tlsHandshakeTimeout"));
      }
      throw err;
    }
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
    // 【Why】H3：TLS 握手超时阈值；0/负数禁用
    const timeoutMs = options?.timeout ?? DEFAULT_CONNECT_TIMEOUT_MS;

    return new Promise((resolve, reject) => {
      // 【Why】H3：settled 防止超时后 open 回调重复 resolve；timer 超时 terminate socket 释放 fd
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const done = (fn: () => void) => {
        if (settled) return;
        settled = true;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        fn();
      };
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          done(() => {
            if (socket && typeof socket.terminate === "function") {
              socket.terminate();
            }
            reject(new Error($tr("error.tlsHandshakeTimeout")));
          });
        }, timeoutMs);
      }
      // Bun.connect 使用 hostname，需要转换
      try {
        bun.connect({
          hostname: conn.remoteAddr.host,
          port: conn.remoteAddr.port,
          tls: tlsOptions,
          socket: {
            open(sock: BunSocket) {
              socket = sock;
              done(() => {
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
              done(() => reject(error));
            },
            connectError(_sock: BunSocket, error: Error) {
              done(() => reject(error));
            },
          },
        });
      } catch (error) {
        done(() => reject(error));
      }
    });
  }

  if (IS_NODE) {
    // 与 Bun 同语义：先关原连接，再创建新 TLS 连接
    conn.close();

    const tlsSocket = tls.connect({
      host: conn.remoteAddr.host,
      port: conn.remoteAddr.port,
      // caCerts 是 Uint8Array[]，tls.connect 的 ca 要 string|Buffer|(string|Buffer)[]
      // Buffer.from(Uint8Array) 拷贝为 Buffer，类型与语义均正确
      ca: options?.caCerts?.map((c) => Buffer.from(c)),
    });

    // 【Why】H3：TLS 握手超时，防止恶意对端永久挂起握手占 fd
    const timeoutMs = options?.timeout ?? DEFAULT_CONNECT_TIMEOUT_MS;
    await new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          tlsSocket.destroy();
          reject(new Error($tr("error.tlsHandshakeTimeout")));
        }, timeoutMs);
      }
      tlsSocket.once("secureConnect", () => {
        if (timer) clearTimeout(timer);
        resolve();
      });
      tlsSocket.once("error", (err) => {
        if (timer) clearTimeout(timer);
        reject(err);
      });
    });

    const addr = tlsSocket.address() as net.AddressInfo;

    return {
      localAddr: {
        host: addr.address,
        port: addr.port,
        transport: "tcp",
      },
      remoteAddr: {
        host: tlsSocket.remoteAddress || conn.remoteAddr.host,
        port: tlsSocket.remotePort || conn.remoteAddr.port,
        transport: "tcp",
      },
      readable: Readable.toWeb(tlsSocket) as ReadableStream<Uint8Array>,
      writable: Writable.toWeb(tlsSocket) as WritableStream<Uint8Array>,
      close() {
        tlsSocket.destroy();
      },
      closeWrite() {
        tlsSocket.end();
      },
    };
  }

  throw new Error($tr("error.unsupportedRuntime"));
}
