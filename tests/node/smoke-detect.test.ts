/**
 * Node 平台闸门冒烟测试（Phase A · T0）
 *
 * 仅在 Node 上生效：在 describe 回调内 `if (!IS_NODE) return` 早返回，
 * 让 Deno/Bun 共享测试命令（`deno test -A tests/` / `bun test tests/`）扫到此目录时
 * 不注册任何用例，不影响双端回归。不依赖 node:test 的 skip 选项语义（Bun 不认）。
 *
 * 用 node:test + node:assert/strict，不依赖 @dreamer/test（其 Node 后端在 Phase B 落地）。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertSupportedRuntime,
  detectRuntime,
  IS_BUN,
  IS_DENO,
  IS_NODE,
  IS_SUPPORTED,
  RUNTIME,
  type Runtime,
} from "../../src/detect.ts";

describe("Node 闸门冒烟", () => {
  // 仅 Node 执行；Deno/Bun 跑到此处时直接返回，不注册 it 用例
  if (!IS_NODE) return;

  it("RUNTIME 应为 node", () => {
    assert.equal(RUNTIME, "node");
    const r: Runtime = detectRuntime();
    assert.equal(r, "node");
  });

  it("IS_NODE 为 true，且与 IS_DENO/IS_BUN 互斥", () => {
    assert.equal(IS_NODE, true);
    assert.equal(IS_DENO, false);
    assert.equal(IS_BUN, false);
  });

  it("IS_SUPPORTED 为 true（Node 已放行）", () => {
    assert.equal(IS_SUPPORTED, true);
  });

  it("assertSupportedRuntime() 在 Node 上不抛", () => {
    assert.doesNotThrow(() => assertSupportedRuntime());
  });
});
