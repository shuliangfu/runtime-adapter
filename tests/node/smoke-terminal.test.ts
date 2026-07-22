/**
 * Node 平台终端 API 冒烟测试（Phase A7）
 *
 * 验证 terminal.ts 的 Node 分支：isTerminal/getStdout/writeStdoutSync/setStdinRaw 等。
 * 仅在 Node 上生效：describe 内 `if (!IS_NODE) return` 早返回。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { IS_NODE } from "../../src/detect.ts";
import {
  getStderr,
  getStdout,
  isStderrTerminal,
  isStdinTerminal,
  isTerminal,
  setStdinRaw,
  writeStderrSync,
  writeStdoutSync,
} from "../../src/terminal.ts";

const enc = new TextEncoder();

describe("Node 终端 API 冒烟", () => {
  if (!IS_NODE) return;

  it("isTerminal/isStderrTerminal/isStdinTerminal 应返回布尔不抛", () => {
    assert.equal(typeof isTerminal(), "boolean");
    assert.equal(typeof isStderrTerminal(), "boolean");
    assert.equal(typeof isStdinTerminal(), "boolean");
  });

  it("writeStdoutSync/writeStderrSync 不应抛出", () => {
    assert.doesNotThrow(() => writeStdoutSync(enc.encode("ra-smoke-stdout\n")));
    assert.doesNotThrow(() => writeStderrSync(enc.encode("ra-smoke-stderr\n")));
  });

  it("getStdout/getStderr 应返回可写的 WritableStream", async () => {
    const stdout = getStdout();
    const stderr = getStderr();
    assert.ok(stdout instanceof WritableStream);
    assert.ok(stderr instanceof WritableStream);
    const writer = stdout.getWriter();
    await writer.write(enc.encode("stream-write\n"));
    await writer.close();
  });

  it("setStdinRaw 在非 TTY 应返回 false 不抛", () => {
    // CI/测试环境 stdin 通常非 TTY
    const result = setStdinRaw(true);
    assert.equal(typeof result, "boolean");
    // 非 TTY 应返回 false；TTY 下返回 true 也算通过
    if (!process.stdin.isTTY) {
      assert.equal(result, false);
    }
  });
});
