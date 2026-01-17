/**
 * 定时任务 API 适配模块
 * 提供统一的定时任务接口，兼容 Deno 和 Bun
 *
 * 统一使用 node-cron 库（支持秒级任务，6 字段格式）
 */

// 静态导入 node-cron 库
import * as cronLib from "node-cron";

/**
 * Cron 任务选项
 */
export interface CronOptions {
  /** 时区（默认：UTC） */
  timezone?: string;
  /** 信号控制器（用于取消任务） */
  signal?: AbortSignal;
  /** 自定义错误处理函数（可选） */
  onError?: (error: unknown) => void;
}

/**
 * Cron 任务句柄
 *
 * @example
 * ```typescript
 * const handle = cron("*\/5 * * * * *", () => {
 *   console.log("每 5 秒执行");
 * });
 *
 * // 关闭任务（两种方式等价）
 * handle.close();
 * // 或
 * handle.stop();
 *
 * // 检查任务是否已关闭
 * if (handle.isClosed) {
 *   console.log("任务已关闭");
 * }
 * ```
 */
export interface CronHandle {
  /** 取消任务 */
  close(): void;
  /**
   * 停止任务（close 的别名）
   *
   * @see close
   */
  stop(): void;
  /** AbortController 的信号，用于控制任务取消 */
  signal: AbortSignal;
  /** 任务是否已关闭（只读） */
  readonly isClosed: boolean;
}

/**
 * 注册 Cron 定时任务
 * @param cronExpression Cron 表达式（支持 5 字段格式：分钟 小时 日 月 星期，或 6 字段格式：秒 分钟 小时 日 月 星期）
 * @param handler 任务处理器
 * @param options 任务选项
 * @returns 任务句柄
 */
export function cron(
  cronExpression: string,
  handler: () => void | Promise<void>,
  options?: CronOptions,
): CronHandle {
  // 统一使用 node-cron 库（支持秒级任务）
  // Deno 和 Bun 都使用 npm:node-cron

  // 创建 AbortController 用于取消任务
  // 如果用户已经提供了 signal，使用它；否则创建新的 AbortController
  const controller = options?.signal
    ? (options.signal instanceof AbortController
      ? options.signal
      : new AbortController()) // 如果传入的是 AbortSignal，创建新的 controller
    : new AbortController();

  // node-cron 的选项类型
  interface NodeCronOptions {
    scheduled?: boolean;
    timezone?: string;
  }

  // 配置时区（如果提供）
  const cronOptions: NodeCronOptions = {
    scheduled: true,
    timezone: options?.timezone || "UTC",
  };

  // 使用 node-cron 创建定时任务
  const task = cronLib.default.schedule(
    cronExpression,
    () => {
      // 检查是否已取消
      if (controller.signal.aborted) {
        task.stop();
        return;
      }

      // 处理异步 handler
      Promise.resolve(handler()).catch((error) => {
        // 使用自定义错误处理函数（如果提供），否则使用默认错误处理
        if (options?.onError) {
          options.onError(error);
        } else {
          console.error("Cron 任务执行失败:", error);
        }
      });
    },
    cronOptions,
  );

  // 任务关闭状态
  let isClosed = false;

  // 关闭处理函数（stop 和 close 共享同一个实现，避免代码重复）
  const closeHandler = () => {
    // 避免重复关闭
    if (isClosed) {
      return;
    }
    isClosed = true;
    // 停止 cron 任务
    task.stop();
    // 取消 AbortController
    controller.abort();
  };

  return {
    signal: controller.signal,
    close: closeHandler,
    stop: closeHandler, // stop 是 close 的别名，直接引用同一个函数
    get isClosed() {
      return isClosed;
    },
  };
}
