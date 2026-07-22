/**
 * RuntimeAdapterError 与 detect 增强
 */
import { describe, expect, it } from "@dreamer/test";
import {
  assertSupportedRuntime,
  IS_BUN,
  IS_DENO,
  IS_NODE,
  IS_SUPPORTED,
  isRuntimeAdapterError,
  RUNTIME,
  RuntimeAdapterError,
} from "../src/mod.ts";

describe("RuntimeAdapterError / detect enhancements", () => {
  it("IS_SUPPORTED is true under Deno, Bun or Node", () => {
    expect(IS_SUPPORTED).toBe(true);
    expect(IS_DENO || IS_BUN || IS_NODE).toBe(true);
    expect(RUNTIME === "deno" || RUNTIME === "bun" || RUNTIME === "node").toBe(
      true,
    );
  });

  it("assertSupportedRuntime does not throw on supported runtimes", () => {
    assertSupportedRuntime();
    expect(true).toBe(true);
  });

  it("RuntimeAdapterError carries code and isRuntimeAdapterError", () => {
    const err = new RuntimeAdapterError(
      "UNSUPPORTED_RUNTIME",
      "test message",
    );
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(RuntimeAdapterError);
    expect(err.code).toBe("UNSUPPORTED_RUNTIME");
    expect(err.message).toBe("test message");
    expect(isRuntimeAdapterError(err)).toBe(true);
    expect(isRuntimeAdapterError(new Error("x"))).toBe(false);
    expect(err.toJSON()).toEqual({
      name: "RuntimeAdapterError",
      code: "UNSUPPORTED_RUNTIME",
      message: "test message",
    });
  });
});
