/**
 * 统一错误类型：跨 Deno/Bun/Node 调用方可 `instanceof` 或按 code 分支。
 */

/**
 * 稳定错误码（对外契约，勿随意改名）
 */
export type RuntimeAdapterErrorCode =
  | "UNSUPPORTED_RUNTIME"
  | "ONLY_BUN_OR_DENO"
  | "PLATFORM_LIMITATION"
  | "INVALID_ARGUMENT"
  | "IO_ERROR"
  | "NETWORK_ERROR"
  | "PROCESS_ERROR"
  | "OUTPUT_SIZE_EXCEEDED";

/**
 * runtime-adapter 标准错误
 */
export class RuntimeAdapterError extends Error {
  override readonly name = "RuntimeAdapterError";
  readonly code: RuntimeAdapterErrorCode;
  override readonly cause?: unknown;

  constructor(
    code: RuntimeAdapterErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(
      message,
      options?.cause !== undefined ? { cause: options.cause } : undefined,
    );
    this.code = code;
    // 保持 stack 可用（V8）
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, RuntimeAdapterError);
    }
  }

  toJSON(): { name: string; code: string; message: string } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
    };
  }
}

/**
 * 是否为 RuntimeAdapterError
 */
export function isRuntimeAdapterError(
  err: unknown,
): err is RuntimeAdapterError {
  return err instanceof RuntimeAdapterError;
}

/**
 * 快捷：不支持的运行时
 */
export function unsupportedRuntimeError(message: string): RuntimeAdapterError {
  return new RuntimeAdapterError("UNSUPPORTED_RUNTIME", message);
}

/**
 * 快捷：仅支持 Deno/Bun/Node（错误码 `ONLY_BUN_OR_DENO` 为历史对外契约，勿改名）
 */
export function onlyBunOrDenoError(message: string): RuntimeAdapterError {
  return new RuntimeAdapterError("ONLY_BUN_OR_DENO", message);
}

/**
 * 快捷：平台限制（如 Windows chown）
 */
export function platformLimitationError(
  message: string,
  cause?: unknown,
): RuntimeAdapterError {
  return new RuntimeAdapterError("PLATFORM_LIMITATION", message, { cause });
}
