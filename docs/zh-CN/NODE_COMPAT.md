# @dreamer/runtime-adapter Node.js 兼容性

[English](../NODE_COMPAT_ANALYSIS.md) | 中文

> **文档状态**：**Phase A 已落地**（detect +
> file/env/path/process/network/terminal/system-info 等）；\
> **Phase B**（`@dreamer/test` Node 后端跑主套件）由 **test 包**承担，RA
> 侧以冒烟 + 下游实测门禁。\
> **分析日期**：2026-07-22\
> **包版本**：`1.2.0`\
> **官方支持**：Deno + Bun + **Node.js 22+**\
> **Node 最低版本**：**22**（`engines.node`: `>=22`；不承诺 18/20）\
> **本文范围**：仅 **runtime-adapter**；全栈见
> `dweb/docs/zh-CN/Node兼容工程量分析.md`

---

## 0. 一句话结论

| 项                               | 判断                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------- |
| **能不能 import / 用核心 API？** | **能。** 模块顶层已放行 Node；`IS_NODE` / `RUNTIME === "node"`。                |
| **主路径是否生产可用？**         | **Phase A 冒烟全绿**（file/serve/WS/process/system-info/terminal）。            |
| **与 Deno/Bun 主套件对齐？**     | 主套件仍在 Deno/Bun 上跑；Node 用 `tests/node/*` 冒烟。                         |
| **继续优化方向**                 | 公共 node-like 抽取、性能（已去 Bun 写轮询 / open 整文件重写）、主套件上 Node。 |

---

## 1. 现状（实现后）

### 1.1 闸门

| 事实                                               | 位置                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| `Runtime = "deno" \| "bun" \| "node" \| "unknown"` | `src/detect.ts`                                                     |
| 检测顺序                                           | **Deno → Bun → Node → unknown**（Bun 必须先于 Node）                |
| `IS_SUPPORTED`                                     | `IS_DENO \|\| IS_BUN \|\| IS_NODE`                                  |
| 顶层 throw                                         | 仅 `unknown`                                                        |
| `engines.node`                                     | `>=22`                                                              |
| 测试                                               | `deno test` / `bun test` / `npm run test:node` / `npm run test:all` |

### 1.2 模块策略

| 模块                                        | Node 策略                                                          |
| ------------------------------------------- | ------------------------------------------------------------------ |
| path / hash / cron                          | 基本直接可用                                                       |
| env / signal / process-utils / process-info | 与 Bun 共用 `process` / `node:*`                                   |
| file                                        | 大量 `IS_BUN \|\| IS_NODE` + `node:fs`；读路径 Bun 可走 `Bun.file` |
| process                                     | Node：`node:child_process`；Bun：`Bun.spawn`                       |
| network                                     | Node：`http` + `ws` + `net`/`tls`；Bun：`Bun.serve`                |
| terminal / system-info                      | node-like / `node:os`                                              |

### 1.3 近期性能优化（1.2.0）

- Bun 写文件：去掉 re-read 轮询，统一 `node:fs` 写。
- Bun `open`：流式写入，不再每 chunk 整文件重写。
- `stat` 映射、`readFile(Sync)` 零拷贝、`writeFileSync` 免 `Buffer.from` 拷贝。

---

## 2. 产品边界

| 级别                                           | 状态                                |
| ---------------------------------------------- | ----------------------------------- |
| **MVP**（import + file/env/path/process-info） | ✅ 完成                             |
| **Full API**（含 serve / WS / process spawn）  | ✅ Phase A 冒烟覆盖                 |
| **一等公民**（主套件 CI×3 同构）               | ⏳ 依赖 test 包 Node 后端 + CI 矩阵 |

---

## 3. 测试策略

```bash
# 主套件
deno test -A tests/
bun test tests/

# Node 冒烟
npm run test:node

# 三端
npm run test:all
```

`tests/node/*` 使用 `node:test`，文件内 `if (!IS_NODE) return`，避免 Deno/Bun
误跑业务断言。

详见 [TEST_REPORT.md](./TEST_REPORT.md)。

---

## 4. 检测顺序（必须遵守）

```text
1. 真 Deno（排除 polyfill）
2. Bun（globalThis.Bun）
3. Node（process.versions.node）
4. unknown → throw
```

---

## 5. 相关

| 文档                               | 角色                            |
| ---------------------------------- | ------------------------------- |
| [TEST_REPORT.md](./TEST_REPORT.md) | 三端结果                        |
| [CHANGELOG.md](./CHANGELOG.md)     | 1.2.0 Node Phase A + 加固与优化 |
| [WIN_COMPAT.md](./WIN_COMPAT.md)   | Windows 平台限制                |
| monorepo dweb Node 文档            | 全栈工程量                      |
