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
}

/**
 * Cron 任务句柄
 */
export interface CronHandle {
  /** 取消任务 */
  close(): void;
  /** AbortController，用于控制任务取消 */
  signal: AbortSignal;
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

  // 配置时区（如果提供）
  const cronOptions: any = {
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
        console.error("Cron 任务执行失败:", error);
      });
    },
    cronOptions,
  );

  return {
    signal: controller.signal,
    close() {
      // 停止 cron 任务
      task.stop();
      // 取消 AbortController
      controller.abort();
    },
  };
}
