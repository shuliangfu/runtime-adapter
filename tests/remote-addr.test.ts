/**
 * Request remote address map
 */

import { describe, expect, it } from "@dreamer/test";
import {
  getRequestRemoteAddress,
  rememberRequestRemoteAddress,
  REQUEST_REMOTE_ADDR_MAP,
} from "../src/network.ts";

describe("request remote address", () => {
  it("remember / get 往返，并挂在 Symbol.for 全局表上", () => {
    const req = new Request("http://localhost/");
    expect(getRequestRemoteAddress(req)).toBeUndefined();
    rememberRequestRemoteAddress(req, "203.0.113.10");
    expect(getRequestRemoteAddress(req)).toBe("203.0.113.10");
    const map = (globalThis as unknown as Record<
      symbol,
      WeakMap<Request, string>
    >)[REQUEST_REMOTE_ADDR_MAP];
    expect(map.get(req)).toBe("203.0.113.10");
    rememberRequestRemoteAddress(req, "");
    expect(getRequestRemoteAddress(req)).toBe("203.0.113.10");
  });
});
