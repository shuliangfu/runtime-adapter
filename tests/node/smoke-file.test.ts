/**
 * Node 平台文件系统 API 冒烟测试（Phase A5）
 *
 * 验证 file.ts 的 Node 分支：readFile/readTextFile/writeFile/writeTextFile/open/create
 * 及 Group 2 归并后的 mkdir/readdir/remove/stat/makeTempDir/exists 等。
 * 仅在 Node 上生效：describe 内 `if (!IS_NODE) return` 早返回，Deno/Bun 扫到时不注册用例。
 */
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { IS_NODE } from "../../src/detect.ts";
import {
  create,
  exists,
  isDirectory,
  isFile,
  makeTempDir,
  mkdir,
  open,
  readdir,
  readFile,
  readTextFile,
  remove,
  stat,
  writeFile,
  writeTextFile,
} from "../../src/file.ts";

const enc = new TextEncoder();
const dec = new TextDecoder();

/** 唯一临时路径，避免并行用例冲突 */
function tmpPath(suffix: string): string {
  return join(
    tmpdir(),
    `ra-smoke-${Date.now()}-${Math.random().toString(36).slice(2)}-${suffix}`,
  );
}

describe("Node 文件系统 API 冒烟", () => {
  if (!IS_NODE) return;

  it("writeTextFile → readTextFile 文本往返", async () => {
    const p = tmpPath("text.txt");
    await writeTextFile(p, "hello-node-文件");
    const text = await readTextFile(p);
    assert.equal(text, "hello-node-文件");
    await remove(p);
  });

  it("writeFile → readFile 二进制往返", async () => {
    const p = tmpPath("bin.dat");
    const data = enc.encode("binary\x00payload");
    await writeFile(p, data);
    const out = await readFile(p);
    assert.equal(dec.decode(out), "binary\x00payload");
    await remove(p);
  });

  it("create() 写入并落盘", async () => {
    const p = tmpPath("create.txt");
    const fh = await create(p);
    const writer = fh.writable.getWriter();
    await writer.write(enc.encode("created-content"));
    await writer.close();
    fh.close();
    // create() 为只写句柄，用 readTextFile 验证落盘
    const text = await readTextFile(p);
    assert.equal(text, "created-content");
    await remove(p);
  });

  it("open({read:true}) 读取已存在文件", async () => {
    const p = tmpPath("open-read.txt");
    await writeTextFile(p, "open-read-data");
    const fh = await open(p, { read: true });
    const buf = new Uint8Array(
      await new Response(fh.readable).arrayBuffer(),
    );
    assert.equal(dec.decode(buf), "open-read-data");
    fh.close();
    await remove(p);
  });

  it("stat/exists/isFile/isDirectory", async () => {
    const p = tmpPath("stat.txt");
    await writeTextFile(p, "x");
    assert.equal(await exists(p), true);
    assert.equal(await isFile(p), true);
    assert.equal(await isDirectory(p), false);
    const info = await stat(p);
    assert.equal(info.isFile, true);
    assert.equal(info.isDirectory, false);
    assert.ok(info.size > 0);
    await remove(p);
    assert.equal(await exists(p), false);
  });

  it("mkdir → readdir → remove 目录操作", async () => {
    const dir = tmpPath("dir");
    await mkdir(dir);
    await writeTextFile(join(dir, "a.txt"), "a");
    await writeTextFile(join(dir, "b.txt"), "b");
    const entries = await readdir(dir);
    const names = entries.map((e) => e.name).sort();
    assert.deepEqual(names, ["a.txt", "b.txt"]);
    await remove(dir, { recursive: true });
    assert.equal(await exists(dir), false);
  });

  it("makeTempDir 返回存在的目录", async () => {
    const dir = await makeTempDir({ prefix: "ra-smoke-tmpdir-" });
    assert.equal(await isDirectory(dir), true);
    await remove(dir, { recursive: true });
  });
});
