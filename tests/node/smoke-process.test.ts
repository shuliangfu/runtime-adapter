/**
 * Node 平台进程 API 冒烟测试（Phase A4）
 *
 * 验证 createCommand（spawn/output）与 execCommandSync 的 Node 分支。
 * 仅在 Node 上生效：describe 内 `if (!IS_NODE) return` 早返回，Deno/Bun 扫到此目录时不注册用例。
 *
 * 用 `node -e "..."` 作为子命令以保证跨平台可移植（不依赖 echo/cat/false 等 shell 内建）。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { IS_NODE } from "../../src/detect.ts";
import { createCommand, execCommandSync } from "../../src/process.ts";

const enc = new TextEncoder();
const dec = new TextDecoder();

describe("Node 进程 API 冒烟", () => {
  if (!IS_NODE) return;

  it("execCommandSync 应捕获 stdout", () => {
    const out = execCommandSync("node", [
      "-e",
      "process.stdout.write('sync42')",
    ]);
    assert.equal(out, "sync42");
  });

  it("createCommand output() 应返回 piped stdout", async () => {
    const cmd = createCommand("node", {
      args: ["-e", "process.stdout.write('out42')"],
      stdout: "piped",
      stderr: "piped",
    });
    const out = await cmd.output();
    assert.equal(dec.decode(out.stdout), "out42");
    assert.equal(out.success, true);
    assert.equal(out.code, 0);
  });

  it("createCommand spawn() status 应反映退出码", async () => {
    const cmd = createCommand("node", {
      args: ["-e", "process.exit(7)"],
      stdout: "piped",
      stderr: "piped",
    });
    const child = cmd.spawn();
    // 排空 stdout/stderr 避免 Node 缓冲背压（虽小命令无碍，保持习惯）
    child.stdout?.getReader().cancel().catch(() => {});
    child.stderr?.getReader().cancel().catch(() => {});
    const status = await child.status;
    assert.equal(status.code, 7);
    assert.equal(status.success, false);
  });

  it("createCommand spawn() 应支持 stdin→stdout 管道往返", async () => {
    const cmd = createCommand("node", {
      args: ["-e", "process.stdin.pipe(process.stdout)"],
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    });
    const child = cmd.spawn();
    const writer = child.stdin!.getWriter();
    await writer.write(enc.encode("roundtrip\n"));
    await writer.close();
    const out = new Uint8Array(
      await new Response(child.stdout!).arrayBuffer(),
    );
    const status = await child.status;
    assert.equal(dec.decode(out).trim(), "roundtrip");
    assert.equal(status.success, true);
  });
});
