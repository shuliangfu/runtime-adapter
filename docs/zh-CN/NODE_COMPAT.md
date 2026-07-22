# @dreamer/runtime-adapter Node.js 兼容性分析

[English](../NODE_COMPAT_ANALYSIS.md)（旧稿索引） | 中文

> **文档状态**：Phase A 已实现（file/env/path/process/network/terminal）；Phase B（测试后端）待定
> **分析日期**：2026-07-22
> **包版本基线**：`1.2.0`
> **当前官方支持**：Deno + Bun + Node.js (22+)
> **Node 最低兼容版本（已定）**：**Node.js 22**（`engines.node`: `>=22`；CI 验证基线 22 LTS）
> **本文范围**：仅 **runtime-adapter** 本体（含测试策略）；dweb / esbuild / view 全栈见 monorepo
> `dweb/docs/zh-CN/Node兼容工程量分析.md`

---

## 0. 一句话结论

| 项 | 判断 |
|----|------|
| **能不能做** | **能**。大量底层已是 `node:*`（Bun 路径），与 Node 高度重合。 |
| **卡点在哪** | ① 模块顶层 **拒绝非 Deno/Bun**；② **`serve` + WebSocket 升级** 与 Deno/Bun 形态差最大；③ **测试矩阵** 依赖 `@dreamer/test`（目前仅 Deno/Bun 后端）。 |
| **好不好实现** | **MVP（file/env/path/process-info）好做**；**全量含 network 中等偏难**；**生产级 serve/WS 对齐契约最难**。 |
| **建议节奏** | 先文档与分阶段规格（本文）→ 再实现 MVP → 再 network → 最后测试门面 / CI 三端。**兼容实现另开任务，本文不落地代码。** |
| **Node 最低版本** | **22**（不承诺 18 / 20；可选 CI 加 24 做前瞻，最低线不抬到 24） |

---

## 1. 现状快照

### 1.1 产品与闸门

| 事实 | 位置 / 含义 |
|------|-------------|
| `Runtime = "deno" \| "bun" \| "unknown"` | `src/detect.ts`；**无 `"node"`** |
| `IS_SUPPORTED = IS_DENO \|\| IS_BUN` | Node 视为未支持 |
| **模块加载即 throw** | `if (!IS_SUPPORTED) throw onlyBunOrDenoError(...)` → **Node 上任何 `import` 即失败** |
| 包描述 / README | 仅声明 Deno + Bun |
| `package.json` engines | 仅 `bun >= 1.3`，**无 `node`** |
| 双跑测试 | `deno test -A tests/` · `bun test tests/` · 共用 `@dreamer/test` |

### 1.2 模块体量（实现成本粗定位）

| 文件 | 约行数 | Deno/Bun 分支密度 | Node 预期 |
|------|--------|-------------------|-----------|
| `path.ts` | ~230 | 低（已 `node:path`） | **几乎直接可用** |
| `hash.ts` | ~140 | 低（`node:crypto` + file） | file 通后即可 |
| `cron.ts` | ~140 | 无（`node-cron`） | 放开 detect 即可 |
| `env.ts` | ~90 | 中 | 复用 Bun 的 `process.env` |
| `signal.ts` | ~90 | 中 | 复用 Bun 的 `process.on` |
| `process-utils.ts` | ~70 | 中 | 补 Node |
| `process-info.ts` | ~190 | 中 | 补 Node |
| `process.ts` | ~460 | 中 | 已有 `node:child_process` 路径可抽 |
| `terminal.ts` | ~280 | 高 | 中等；CI 无 TTY 需 skip 策略 |
| `system-info.ts` | ~1040 | 高 | 大量可走 `node:os`（与 Bun 类似） |
| `file.ts` | ~1880 | **很高** | 模式重复：抽 **node-like** 实现最优 |
| `network.ts` | ~1100 | 高 | **最大难点**（serve / WS / TCP / TLS） |
| `detect.ts` / `errors.ts` / `utils.ts` | 小 | — | 入口与类型必改 |

### 1.3 设计模式（对 Node 友好的点）

当前典型模式：

```text
const deno = getDeno();
if (deno) { /* Deno 原生 */ }
if (IS_BUN) { /* 多半 node:* 或 Bun 专有 */ }
throw unsupportedRuntimeError(...);
```

含义：

- **Bun 分支 ≈ Node 候选实现**（fs / path / crypto / child_process / process.env）。
- 真正「双实现」的是：**Deno 原生 API** vs **Bun 专有（Bun.serve / Bun.spawn / 部分 system）**。
- Node 策略优先：**`IS_NODE` 与 Bun 共用 node-like 路径**，仅在 Bun 专有处再分叉（尤其 network）。

### 1.4 与全栈文档的关系

| 文档 | 范围 |
|------|------|
| **本文** | RA 模块改动、测试策略、分阶段 MVP、风险 |
| `dweb/docs/zh-CN/Node兼容工程量分析.md` | RA → dweb 依赖链 → view；含 esbuild resolver、CLI、CI×3 |
| `docs/NODE_COMPAT_ANALYSIS.md`（仓库旧稿） | 早期粗估；**工时偏乐观，以本文与 dweb 文档为准** |

---

## 2. 兼容目标定义（实现前必须定界）

### 2.1 推荐产品边界

| 级别 | 目标 | 非目标（首期不做） |
|------|------|-------------------|
| **MVP** | Node 上可 `import`；file / path / env / process-info / hash / cron 行为与 Bun 对齐到现有单测语义 | 完整 serve/WS；terminal 全功能；与 Deno 权限模型对等 |
| **Full API** | 公开 API 在 Node 上均可调用；`serve` + `upgradeWebSocket` 满足 **server/dweb 当前契约** | 性能与 Deno/Bun 完全一致；HTTP/2 优先 |
| **一等公民** | CI 三端绿 + `engines.node` + 文档 + npm 消费路径清晰 | Node 上原生 `jsr:` 源码直引（交给下游 / 安装期） |

### 2.2 Node 版本策略（已定）

| 项 | 决定 |
|----|------|
| **最低兼容** | **Node.js 22** |
| **`package.json` engines（实现时）** | `"node": ">=22"`（与现有 `"bun": ">=1.3"` 并列） |
| **CI / 本地验证基线** | **22 LTS** 必跑 |
| **可选矩阵** | 另加 **24** 做前瞻回归；**不作为** 最低线 |
| **明确不支持** | **Node 18、Node 20**（到文档日期时 20 已过 EOL；不扩大支持面） |
| **模块系统** | 仅 **ESM**（本包已 `"type": "module"`） |

**定 22 的原因（摘要）**：

1. 2026 年中 **Node 20 已退出安全维护**，`>=20` 等于承诺无 LTS 安全更新的版本。
2. RA 所需 API（`node:fs` / `path` / `crypto` / `child_process` / 全局 `fetch` / `AsyncLocalStorage` / `node:test`）在 **22 上均已稳定**，抬到 22 **几乎不增加实现成本**。
3. 最低线再抬到 24 会无谓砍掉仍在 22 LTS 上的用户；用 **CI 可选 24** 即可。

文档与 README 实现阶段统一表述：

> Supported: **Node.js 22+**（以 **22 LTS** 为验证基线；更高 major 尽力兼容直至纳入 CI）。

### 2.3 API 契约原则

1. **对外类型与函数签名不变**（`ServeHandle`、`ServeOptions`、file API 等）。
2. **行为对齐以现有 Deno/Bun 测试为规格**；实现细节允许不同。
3. 无法对齐的平台差异（Windows `chown`、无 TTY、信号子集）→ **文档 + 测试 skip**，与 [WIN_COMPAT](./WIN_COMPAT.md) 同一风格。
4. 错误继续走 `RuntimeAdapterError` / 既有 i18n 键；必要时扩展文案（`onlyBunOrDeno` → `onlySupportedRuntimes` 等，**实现时再改**）。

---

## 3. 模块级改造清单

### 3.1 P0 — 闸门与检测（必做）

**文件**：`detect.ts`、`errors.ts`、`i18n` locales、`utils.ts`（可选导出）

| 项 | 建议 |
|----|------|
| `Runtime` | 增加 `"node"` |
| `detectRuntime()` | 在 Deno/Bun 之后：`process.versions?.node` → `"node"`（注意 **Bun 也有 process**，**必须先判 Bun 再判 Node**） |
| `IS_NODE` | `RUNTIME === "node"` |
| `IS_SUPPORTED` | `deno \|\| bun \|\| node` |
| 顶层 throw | 去掉或改为仅 `unknown` 时 throw；**否则 Node 永远进不来** |
| `assertSupportedRuntime` | 同步支持 Node |
| 测试 | `detect.test.ts` 断言集扩展为三元 |

**预估**：0.5～1 人日（含 i18n / 测试断言调整）。

**检测顺序（实现时必须遵守）**：

```text
1. 真 Deno（排除 polyfill）
2. Bun（globalThis.Bun）
3. Node（process.versions.node）
4. unknown
```

### 3.2 P0 — 几乎零改 / 随 file 生效

| 模块 | 说明 |
|------|------|
| **path.ts** | 已 `node:path` + `node:url`，无运行时分支 |
| **hash.ts** | `node:crypto` + file；file Node 化后即通 |
| **cron.ts** | `node-cron`；detect 放开即可（注意时区/卸载语义与现测一致） |

### 3.3 P0 — 小改（复用 Bun / process）

| 模块 | Node 方案 | 预估 |
|------|-----------|------|
| **env.ts** | 与 Bun 相同：`process.env` | 0.5 人日 |
| **signal.ts** | `process.on` / `off`（与 Bun 同路径可合并 `IS_BUN \|\| IS_NODE`） | 0.5 人日 |
| **process-utils.ts** | cwd / exit 等走 `process` | 0.5 人日 |
| **process-info.ts** | pid / cwd / platform / arch / execPath / memory 等 | 1 人日 |
| **process.ts** | spawn / Command：抽 `node:child_process` 公共实现，Deno 单独 | 2～3 人日 |

### 3.4 P1 — 中改

| 模块 | Node 方案 | 风险 | 预估 |
|------|-----------|------|------|
| **file.ts** | 优先 **抽取 node-like 实现**，`IS_BUN \|\| IS_NODE` 共用；避免 60+ 处复制粘贴 | watchFs 语义、错误码、symlink、权限映射 | **3～7 人日** |
| **system-info.ts** | 以 `node:os` / `process` 为主（大量已与 Bun 分支同源） | 磁盘占用、loadavg 在 Windows/部分环境差异 | 2～4 人日 |
| **terminal.ts** | stdin/stdout、`tty.isatty`、`setRawMode` | CI 无 TTY；raw mode 与 Deno 不完全一致 | 2～3 人日 |

**file.ts 重构建议（实现阶段）**：

```text
// 概念结构（非最终 API）
function useNodeFs(): boolean {
  return IS_BUN || IS_NODE; // 或 getProcess() && !getDeno()
}
// Deno 分支保持；node-like 单实现覆盖 Bun+Node
```

比「每个函数加第三个 else if」更易维护，也减少 Node 回归成本。

### 3.5 P2 — 大改：network（主风险）

**文件**：`network.ts`（~1100 行）
**导出核心**：`serve`、`upgradeWebSocket`、`connect`、`startTls`

| 能力 | Deno | Bun | Node 候选 |
|------|------|-----|-----------|
| HTTP serve | `Deno.serve` | `Bun.serve` + ALS 绑 server | `node:http` / `node:https`，或轻量适配（自研 Fetch 桥） |
| Request/Response | Web 标准 | Web 标准 | **需 Node 请求流 → Fetch Request，Response → 写回** |
| WS 升级 | 同步 `upgradeWebSocket`（历史坑已修） | pending adapter + server 上下文 | `ws` 包 或 Node 实验/原生 WebSocket；**契约对齐最难** |
| TCP connect / TLS | Deno API | 对应实现 | `node:net` / `node:tls` |

**已有可复用资产**：

- Bun 侧 `AsyncLocalStorage` 多实例 serve 上下文（1.1.0 修过串台）— Node 多 `http.Server` 时同样需要 **请求级上下文**。
- 统一的 `ServeHandle`（`finished` / `shutdown` / `port`）— Node 必须凑齐语义。

**MVP 可选策略（产品可接受时）**：

| 策略 | 说明 |
|------|------|
| **A. 占位** | Node 上 `serve` / `upgradeWebSocket` **明确 throw「暂不支持」**，其余 API 可用 | 适合 database 等非 HTTP 下游 |
| **B. HTTP only** | 仅 `serve` + fetch 契约，WS 后置 | 适合只跑 HTTP 的中间件验证 |
| **C. Full** | serve + WS + connect + startTls | 对齐 server/dweb；**工时上界** |

**预估**：

| 范围 | 人日量级（熟手） |
|------|------------------|
| 占位 + 测试 skip | 0.5～1 |
| HTTP serve 契约可用 | 5～10 |
| + upgradeWebSocket 与现测对齐 | **+5～15** |
| + connect / startTls | +2～4 |

> 旧稿「network 2～4 小时」**不可信**；以 **人周** 量级规划 full network 更稳妥。

### 3.6 文档与包装

| 项 | 说明 |
|----|------|
| README / package description | 增加 Node 支持声明：**最低 Node 22** |
| `engines` | `"node": ">=22"`（已定） |
| keywords | 增加 `node` |
| CHANGELOG | 实现合并时写 |
| WIN_COMPAT | Node 在 Windows 上再交叉验证（chown/symlink 等同已知限制） |

---

## 4. 测试策略（实现时按此落地）

### 4.1 现状

| 平台 | 命令 | 调度 |
|------|------|------|
| Deno | `deno test -A tests/` | `@dreamer/test` → `Deno.test` |
| Bun | `bun test tests/` | `@dreamer/test` → `bun:test` |
| Node | **无** | `@dreamer/test` **无 Node 后端**；且 RA 顶层 throw |

同一套 `tests/*.test.ts` + `@dreamer/test` 门面；**不是** 两套业务用例。

### 4.2 原则

1. **必须用真实 Node 进程** 跑 Node 分支；禁止用 Bun/Deno runner「假装」Node。
2. **行为契约共享**；实现细节允许 `if (IS_NODE)`。
3. 分阶段：**冒烟 → MVP suite → full / network**。
4. `@dreamer/test` Node 后端可与 RA 并行规划，但 **RA 冒烟可不依赖它**。

### 4.3 推荐分阶段测试

#### Phase T0 — 实现期冒烟（不依赖改 test 包）

```text
devDependency: tsx、@types/node
命令示例: npx tsx --test tests/node/**/*.test.ts
```

- 使用 `node:test` + `node:assert/strict`。
- 最小文件：`detect`、`env`、读写一个临时文件。
- 目的：PR 级快速反馈。

#### Phase T1 — MVP 行为覆盖

- 覆盖：detect / env / path / file（含 sync）/ process-info / hash / cron。
- 可从现有用例 **移植断言**，或暂时复制关键路径到 `tests/node/`。
- network / 重 terminal：**skip 或独立文件且标记 optional**。

#### Phase T2 — 与 Deno/Bun 同门面（一等公民）

1. `@dreamer/test` 增加 `IS_NODE` → `node:test` 的 `describe` / `it` / hooks。
2. 调整 hooks 超时（对齐 Bun 的 HOOK_TIMEOUT 经验）。
3. 快照等 Deno 专有能力：Node 上 skip 或自研。
4. 脚本对称：

```json
{
  "scripts": {
    "test:deno": "deno test -A tests/",
    "test:bun": "bun test tests/",
    "test:node": "tsx --test tests/",
    "test:all": "…"
  }
}
```

5. CI：三 job；`TEST_REPORT` 三列（Deno / Bun / Node）。

### 4.4 用例组织建议

```text
tests/
  detect.test.ts       # 三端共享；RUNTIME ∈ {deno,bun,node}
  file.test.ts
  network.test.ts      # Node 未实现前 skip 或分文件
  node/                # T0 可选；T2 后可删并回共享
    smoke.test.ts
```

运行时断言示例（实现时）：

```ts
expect(["deno", "bun", "node"]).toContain(RUNTIME);
expect(IS_SUPPORTED).toBe(true);
```

### 4.5 模块测试注意点

| 模块 | 注意 |
|------|------|
| file | 临时目录隔离；并行安全 |
| process | 子进程用 `process.execPath` + `-e`；Windows 路径 |
| signal | CI/平台信号子集；部分 skip |
| terminal | 无 TTY 时 skip |
| serve/WS | 端口 `0` 或随机；严格 shutdown；防并行抢端口 |
| detect | **仅在 Node 进程中**断言 `IS_NODE` |

### 4.6 明确不推荐

| 做法 | 原因 |
|------|------|
| 用 `bun test` 验证 Node 兼容 | 测的是 Bun，不是 Node |
| 首期上 Vitest 作为主路径 | 与 monorepo Deno/Bun 门面分叉 |
| 未定义 MVP 就强求 network 全绿 | 周期不可控，阻塞 file 类下游 |

---

## 5. 实施路线图（仅规划，本阶段不编码）

```text
[已完成] 分析文档（本文）
    ↓
Phase 0  规格冻结：MVP 边界、network 占位 or 全做（**Node 最低版本已定：22**）
    ↓
Phase 1  detect + IS_NODE + 去掉顶层拒绝 + 冒烟测试脚手架（Node **22**）
    ↓
Phase 2  env / path / file（node-like 抽取）/ process-info / hash / cron
    ↓
Phase 3  process / signal / system-info / terminal
    ↓
Phase 4  network：占位 → HTTP serve → WS → TCP/TLS
    ↓
Phase 5  @dreamer/test Node 后端 + 共享 suite 三端 CI
    ↓
Phase 6  文档 / engines / CHANGELOG / 发版（如 1.2.0）
```

**依赖顺序**：

- 下游 **database 等非 HTTP 包**：Phase 2 结束即可开始对接验证。
- **server / dweb**：强依赖 Phase 4。
- **全 monorepo Node**：另见 dweb 全栈分析（esbuild resolver、CLI、JSR/npm）。

---

## 6. 工程量汇总（仅 RA）

| 范围 | 粗估（1 名熟手） | 说明 |
|------|------------------|------|
| Phase 1 闸门 + 冒烟 | **0.5～1 人日** | |
| Phase 2 MVP API | **4～8 人日** | file 为主 |
| Phase 3 进程/系统/终端 | **4～8 人日** | |
| Phase 4 network full | **2～4 人周** | 主风险 |
| Phase 5 测试门面 + CI | **3～7 人日** | 含 `@dreamer/test` 部分 |
| **MVP 合计（无 full network）** | **约 1.5～3 人周** | 可支撑非 HTTP 下游 |
| **Full 合计** | **约 4～8 人周** | 含生产向 serve/WS |

> 对比旧稿「全量 6～10 小时」：本文按 **真实 serve/WS 与测试矩阵** 上调；实现时以里程碑验收，不以旧工时为承诺。

---

## 7. 风险与未决问题

| # | 风险 / 问题 | 建议 |
|---|-------------|------|
| 1 | Bun 与 Node 均有 `process`，误判顺序导致 Bun 被标成 Node | 检测顺序固定：Deno → Bun → Node |
| 2 | serve 的 Fetch 语义与流式 body、错误处理细节 | 以现有 `network.test.ts` / server 集成为验收 |
| 3 | WS 升级同步/异步差异 | 对齐 Deno 已修行为；Node 侧单测 + 联调 `@dreamer/websocket` |
| 4 | `@dreamer/test` 依赖旧版 RA 的循环/版本 | 发版顺序：RA 先发支持 Node 的版本，再升 test |
| 5 | TS 在 Node 上如何跑测 | 统一 `tsx` 或「先 build 再 `node --test`」；文档写死一种 |
| 6 | 是否引入 `ws` 依赖 | 若引入：peer 或 dependency、体积与 license；实现 Phase 4 决策 |
| 7 | 顶层 throw 去掉后，unknown 环境静默？ | 保留 `assertSupportedRuntime`；可选惰性 API 级 throw |
| 8 | Windows + Node | 与 WIN_COMPAT 交叉；symlink/chown/信号单独矩阵 |

**已拍板**：

1. ~~Node 最低版本？~~ → **Node.js 22**（`engines`: `>=22`；CI 基线 22 LTS）。

**实现前仍建议拍板**：

1. MVP 是否允许 **network 占位 throw**？
2. 测试是否必须 **第一期就** 进 `@dreamer/test`，还是 T0 冒烟即可合并？

---

## 8. 验收清单（实现阶段用）

### MVP

- [ ] Node 进程 `import "@dreamer/runtime-adapter"` 不抛
- [ ] `RUNTIME === "node"`，`IS_NODE === true`，`IS_SUPPORTED === true`
- [ ] file 异步/同步主路径、path、env、process-info、hash、cron 主测通过
- [ ] `npx tsx --test …`（或既定命令）在 **Node 22** CI 可跑
- [ ] README 注明 Node MVP 范围与限制、**最低 Node 22**

### Full

- [ ] `serve` + `upgradeWebSocket` 现有关键用例通过
- [ ] process / signal / terminal / system-info 主测通过（合理 skip 已文档化）
- [ ] Deno / Bun **回归零失败**（三端矩阵）
- [ ] `@dreamer/test` Node 后端可用或文档说明过渡方案
- [ ] `engines.node`: `">=22"` + CHANGELOG + 版本发布策略

---

## 9. 相关文件索引

| 路径 | 说明 |
|------|------|
| `src/detect.ts` | 闸门与 Runtime 类型 |
| `src/file.ts` | 最大 node-like 复用面 |
| `src/network.ts` | serve / WS |
| `src/env.ts` / `signal.ts` / `process*.ts` / `terminal.ts` / `system-info.ts` | 分支补齐 |
| `tests/*.test.ts` | 现有双跑规格 |
| `docs/zh-CN/WIN_COMPAT.md` | 平台差异文档模板 |
| `docs/zh-CN/TEST_REPORT.md` | 当前 Deno/Bun 结果；Node 列待增 |
| `package.json` / `deno.json` | engines、脚本、imports |

---

## 10. 变更记录（本文档）

| 日期 | 说明 |
|------|------|
| 2026-07-22 | 初版：现状、模块清单、测试策略、分阶段路线、工时与风险；**明确实现另开** |
| 2026-07-22 | **已定**：Node 最低兼容 **22**（`engines.node` `>=22`；CI 基线 22 LTS；不支持 18/20） |

---

**下一步（需明确开干后再做）**：Phase 0 规格确认 → Phase 1 代码与 `tests/node` 冒烟脚手架。在此之前本文仅作设计与排期输入，不修改 `src/` 行为。
