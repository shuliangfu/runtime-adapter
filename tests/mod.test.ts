/**
 * @fileoverview 主模块导出测试
 */

import { describe, expect, it } from "@dreamer/test";
import * as runtimeAdapter from "../src/mod.ts";

describe("主模块导出", () => {
  it("应该导出运行时检测相关 API", () => {
    expect(runtimeAdapter.detectRuntime).toBeDefined();
    expect(runtimeAdapter.IS_BUN).toBeDefined();
    expect(runtimeAdapter.IS_DENO).toBeDefined();
    expect(runtimeAdapter.RUNTIME).toBeDefined();
  });

  it("应该导出文件系统 API", () => {
    expect(runtimeAdapter.readFile).toBeDefined();
    expect(runtimeAdapter.writeFile).toBeDefined();
    expect(runtimeAdapter.readTextFile).toBeDefined();
    expect(runtimeAdapter.writeTextFile).toBeDefined();
    expect(runtimeAdapter.mkdir).toBeDefined();
    expect(runtimeAdapter.mkdirSync).toBeDefined();
    expect(runtimeAdapter.ensureDir).toBeDefined();
    expect(runtimeAdapter.ensureDirSync).toBeDefined();
    expect(runtimeAdapter.remove).toBeDefined();
    expect(runtimeAdapter.stat).toBeDefined();
    // 同步 API
    expect(runtimeAdapter.readFileSync).toBeDefined();
    expect(runtimeAdapter.writeFileSync).toBeDefined();
    expect(runtimeAdapter.readTextFileSync).toBeDefined();
    expect(runtimeAdapter.writeTextFileSync).toBeDefined();
    expect(runtimeAdapter.mkdirSync).toBeDefined();
    expect(runtimeAdapter.removeSync).toBeDefined();
    expect(runtimeAdapter.statSync).toBeDefined();
    expect(runtimeAdapter.existsSync).toBeDefined();
    expect(runtimeAdapter.isFileSync).toBeDefined();
    expect(runtimeAdapter.isDirectorySync).toBeDefined();
    expect(runtimeAdapter.readdirSync).toBeDefined();
    expect(runtimeAdapter.realPathSync).toBeDefined();
  });

  it("应该导出网络 API", () => {
    expect(runtimeAdapter.serve).toBeDefined();
    expect(runtimeAdapter.connect).toBeDefined();
    expect(runtimeAdapter.startTls).toBeDefined();
    expect(runtimeAdapter.upgradeWebSocket).toBeDefined();
  });

  it("应该导出环境变量 API", () => {
    expect(runtimeAdapter.getEnv).toBeDefined();
    expect(runtimeAdapter.setEnv).toBeDefined();
    expect(runtimeAdapter.deleteEnv).toBeDefined();
    expect(runtimeAdapter.hasEnv).toBeDefined();
    expect(runtimeAdapter.getEnvAll).toBeDefined();
  });

  it("应该导出进程/命令 API", () => {
    expect(runtimeAdapter.createCommand).toBeDefined();
    expect(runtimeAdapter.execCommandSync).toBeDefined();
  });

  it("应该导出终端 API", () => {
    expect(runtimeAdapter.isTerminal).toBeDefined();
    expect(runtimeAdapter.isStderrTerminal).toBeDefined();
    expect(runtimeAdapter.getStdout).toBeDefined();
    expect(runtimeAdapter.getStderr).toBeDefined();
  });

  it("应该导出定时任务 API", () => {
    expect(runtimeAdapter.cron).toBeDefined();
  });

  it("应该导出系统信息 API", () => {
    expect(runtimeAdapter.getMemoryInfo).toBeDefined();
    expect(runtimeAdapter.getSystemInfo).toBeDefined();
    expect(runtimeAdapter.getLoadAverage).toBeDefined();
    // 同步 API
    expect(runtimeAdapter.getMemoryInfoSync).toBeDefined();
    expect(runtimeAdapter.getSystemInfoSync).toBeDefined();
    expect(runtimeAdapter.getLoadAverageSync).toBeDefined();
  });

  it("应该导出哈希 API", () => {
    expect(runtimeAdapter.hash).toBeDefined();
    expect(runtimeAdapter.hashFile).toBeDefined();
    // 同步 API
    expect(runtimeAdapter.hashSync).toBeDefined();
    expect(runtimeAdapter.hashFileSync).toBeDefined();
  });
});
