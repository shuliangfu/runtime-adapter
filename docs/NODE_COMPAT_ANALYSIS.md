# runtime-adapter 增加 Node.js 兼容性：难度与改动量分析

## 一、结论摘要

| 维度                | 评估                                                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **难度**            | 中等。逻辑清晰，多为「Deno → Bun → 抛错」再补一条「Node → node:xxx」分支。                                                    |
| **改动量**          | 中等偏上。约 10+ 个文件需动，其中 **file.ts**、**network.ts** 函数多、分支多。                                                |
| **最小可行（MVP）** | 约 **2–3 小时**：放开入口 + env + path + file + process-info + cwd，满足 database 等只依赖「文件/环境/路径/进程信息」的包。   |
| **全量兼容**        | 约 **6–10 小时**：含 network（serve/WebSocket）、terminal、system-info、process（spawn）、signal、cron 等全部在 Node 下可用。 |

---

## 二、入口：detect.ts（必做，改动小）

**当前**：`RUNTIME === "unknown"` 时直接
`throw new Error($tr("error.onlyBunOrDeno"))`，Node 下任何 import
都会在这里挂掉。

**改动**：

1. 删除或改为「仅在不支持且真的被用到再报错」的检查（例如不再在模块顶层
   throw）。
2. 增加 `IS_NODE = (RUNTIME === "node")`，并在 `detectRuntime()` 里识别 Node：
   - 例如 `typeof process !== "undefined" && process.versions?.node != null` →
     `return "node"`。
3. `RUNTIME` 类型改为 `"deno" | "bun" | "node" | "unknown"`。

**工作量**：约 10 分钟。

---

## 三、按模块改动量概览

### 3.1 已兼容或几乎无需改

| 模块        | 说明                                                                                                 |
| ----------- | ---------------------------------------------------------------------------------------------------- |
| **path.ts** | 已统一用 `node:path` + `node:url`，无 Deno/Bun 分支，**Node 下可直接用**。                           |
| **hash.ts** | 用 `node:crypto` + file 的 `readFile`/`readFileSync`。file 支持 Node 后，**无需改**。                |
| **cron.ts** | 已统一用 `node-cron`，无 `getDeno()`/`getBun()` 分支，**仅因 detect 抛错而进不来**；放开入口即可用。 |

### 3.2 小改动（加一段 Node 分支即可）

| 模块                 | 当前逻辑                                    | Node 方案                                           | 预估     |
| -------------------- | ------------------------------------------- | --------------------------------------------------- | -------- |
| **env.ts**           | `getDeno()` → `IS_BUN`(process.env) → throw | 若 `getProcess()` 存在则用 `process.env`            | ~5 分钟  |
| **signal.ts**        | Deno.addSignalListener / Bun: process.on    | Node: `process.on(signal, handler)` / `process.off` | ~10 分钟 |
| **process-utils.ts** | getDeno() → throw                           | Node: `process.cwd()` 等                            | ~15 分钟 |
| **utils.ts**         | 已有 getProcess()/getBuffer()               | 可选：导出 `IS_NODE` 供其他模块用                   | ~2 分钟  |

### 3.3 中等改动（多处 Deno/Bun 分支，补 Node 分支）

| 模块                | 说明                                                                                                       | 预估     |
| ------------------- | ---------------------------------------------------------------------------------------------------------- | -------- |
| **process-info.ts** | execPath 已用 getProcess()；pid/cwd/platform 等需补 Node（process.pid、process.cwd()、os.platform() 等）   | ~30 分钟 |
| **process.ts**      | spawn/command：Deno.Command / Bun.spawn / 已用 node:child_process(Bun)。Node 下统一用 `node:child_process` | ~40 分钟 |
| **terminal.ts**     | 多处 getDeno() 后 throw。Node：process.stdin/stdout、readline、tty 等                                      | ~1 小时  |
| **system-info.ts**  | 多处 getDeno()；Node：os、process.versions 等                                                              | ~1 小时  |

### 3.4 大改动（函数多或 API 形态差异大）

| 模块           | 说明                                                                                                                                                                                                                                                                       | 预估           |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **file.ts**    | 约 35+ 个导出函数，几乎都是「Deno → Bun → throw」。已有 `node:fs`/`node:fs/promises` 引用（Bun 用）。每个函数在 throw 前加 `else if (getProcess()) { ... node fs ... }` 即可，**模式重复、工作量大但不复杂**。可考虑先抽一层「Node 文件实现」再在各 API 里调用，减少重复。 | **1.5–2 小时** |
| **network.ts** | `serve()`、`upgradeWebSocket()`、`connect()`、`startTls()`。Node 用 `http.createServer`/`https`/`net`，API 与 Deno/Bun 的 listen + handler 形态不同；WebSocket 需用 `ws` 或 Node 18+ 的 `undici` 等。**差异最大、实现和测试成本最高**。                                    | **2–4 小时**   |

---

## 四、依赖关系（便于分批做）

- **database 包**
  主要用到：detect（IS_DENO/IS_BUN）、env（getEnv）、path（join/cwd/dirname/basename/extname/realPath
  等）、**file**（readdir/stat/realPath/mkdir/writeTextFile
  等）、process-info（cwd）、migration 里还有 IS_BUN。
- 因此 **MVP** 可只做：
  - detect：放开 Node + 导出 IS_NODE
  - env、path（已 OK）、**file**、**process-info**、process-utils
  - 若 migration 在 Node 下用到了 process 的 cwd，再补 process-info 的 Node
    分支即可。
- **network / terminal / system-info** 可放到「全量兼容」阶段，对只跑 database
  的场景不是必须。

---

## 五、建议实施顺序

1. **detect.ts**：识别 Node、去掉顶层 throw、导出 IS_NODE。
2. **env.ts**：Node 下用 process.env。
3. **process-info.ts**：Node 下 pid/cwd/platform/arch 等。
4. **file.ts**：所有「读/写/目录/stat/临时文件」等加 Node 分支（或统一走
   node:fs）。
5. **process-utils.ts**、**signal.ts**、**process.ts**：按需补 Node。
6. **terminal.ts**、**system-info.ts**：全量兼容时再做。
7. **network.ts**：最后做，或用「Node 下 serve/upgradeWebSocket 直接 throw
   或返回明确不支持」的占位实现，保证包能跑起来再迭代。

---

## 六、风险与注意点

- **path.ts** 已用 `node:path`，在 Deno 下需依赖 Deno 的 Node 兼容层；若 Deno
  版本过旧可能缺 `node:path`，需在文档或兼容表里说明。
- **file.ts** 在 Node 下用 `node:fs`/`node:fs/promises`，需保证目标 Node
  版本（如 18+）支持这些 API。
- **测试**：现有测试多为 Deno/Bun，加 Node 后需在 CI 里加 `node run tests`
  或至少对 MVP 模块跑一遍，防止回归。

---

## 七、Node 下如何写测试 / 跑测试

你提的两点都对：Node 没有像 Deno/Bun 那样「自带一整套测试 + 直接跑 TS」；要在
Node 下跑测试，需要决定「用谁跑」和「怎么跑 TS」。

### 7.1 现状（Bun）

- 当前用例是 **Bun**：`bun test tests/`，Bun 自带测试 runner、**直接跑
  .ts**，无需额外装 TS 运行时。
- 测试里用的是 **@dreamer/test**（describe / it / expect / afterAll），和 Bun 的
  test runner 一起用。

### 7.2 Node 侧的情况

| 点                      | 说明                                                                                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **“Node 没有自带测试”** | Node **18+** 自带 **`node:test`**（跑测试的 runner）和 **`node:assert`**，但 API 和 Jest/Bun 的 describe-it-expect 不一样，也没有内置「发现并跑一整个 tests 目录」的约定。 |
| **要跑 .ts**            | Node 默认只跑 .js，跑 .ts 需要：**tsx**（推荐，零配置）、ts-node、或先 `tsc` 编译再 `node --test`。                                                                        |

所以：**“写 Node 兼容的测试”** 可以有两种思路——要么在 Node
下也跑同一套测试（需要选 runner + TS 方案），要么只在 Node 下跑少量冒烟测试。

### 7.3 方案 A：不专门为 Node 加测试（推荐做 MVP 时）

- **继续只用 Bun 跑现有测试**：`bun test tests/` 不变。
- Node 兼容只保证「在 Node 里 import 不报错、你测过的 API 行为一致」；不在 CI
  里用 Node 再跑一遍完整用例。
- **优点**：零额外依赖、不用装 ts 服务器/TS 构建，也不用改现有测试。
- **缺点**：Node 上的回归主要靠人工或上层项目（如 database）在 Node 下自测。

很多「多运行时支持」的库都这么干：实现 Node 兼容，但 CI 只在一个运行时（如 Bun
或 Node）跑全量测试。

### 7.4 方案 B：在 Node 下用“内置 test + tsx”跑少量冒烟测试

- **依赖**：只多一个 **tsx**（`npm i -D tsx`），用 Node 自带的
  **node:test**，不引入 Jest/Vitest。
- **做法**：
  - 写一个（或少数几个）**只测 Node 路径** 的用例，例如
    `tests/node-smoke.test.ts`。
  - 里面用
    **node:test**（`import test from "node:test"`、`import assert from "node:assert"`），不依赖
    `@dreamer/test`。
  - 跑：`node --import tsx --test tests/node-smoke.test.ts`；如需可加
    `"test:node": "node --import tsx --test tests/node-smoke.test.ts"`。
- **优点**：真正在 Node 下执行，验证 getEnv、cwd、readFile 等 Node
  分支；依赖少（tsx 即可），不需要单独装“TS 服务器”（tsx 就是在 Node 里跑 TS
  的）。
- **缺点**：需要手写一小份 node:test 风格的用例；和现有 describe/it/expect
  两套风格并存。

### 7.5 方案 C：在 Node 下用 Vitest 跑（和现有用例风格统一）

- **依赖**：`npm i -D vitest`（Vitest 自带 TS 支持，不需要再装 ts-node/单独 TS
  服务器）。
- **做法**：
  - 配置 Vitest（如 `vitest.config.ts`），让测试入口指向现有
    `tests/**/*.test.ts`。
  - 把测试里的 `@dreamer/test` 改成从 **vitest** 里 import（`describe` / `it` /
    `expect` / `afterAll`），这样同一份用例既能在 Bun 下用 `@dreamer/test`
    跑（若保留），也能在 Node 下用 Vitest 跑。
  - 或：专门为 Node 建一份 `tests-node/`，只用 Vitest，不混用 @dreamer/test。
- **优点**：API 和现有 describe/it/expect 一致，TS 开箱即用。
- **缺点**：多一个测试框架和一份配置；若想「一份用例双运行时跑」，要处理
  @dreamer/test 与 Vitest 的兼容（或统一成 Vitest）。

### 7.6 方案 D：让 @dreamer/test 兼容 Node，共用同一份测试（推荐）

**思路**：在 **@dreamer/test** 里增加 Node 分支，让 `describe` / `it` 在 Node
下委托给 **node:test**，这样现有测试文件**不用改**，既能用 `bun test tests/`
跑，也能用 `node --import tsx --test tests/*.test.ts` 在 Node 下跑。

**前提**：

1. **runtime-adapter 先支持 Node**。@dreamer/test 依赖 runtime-adapter 的
   `addSignalListener`、`exit`、`IS_BUN`、`IS_DENO` 等，入口会拉取 detect，若
   runtime-adapter 在 Node 下抛错，test 包本身都加载不了。
2. 在 test 包里加 **IS_NODE**（或等 runtime-adapter 导出），在 `describe` / `it`
   / `test.skip` / `test.only` 等里加「else if (IS_NODE)」分支。

**实现要点**：

| 部分                      | 说明                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **describe**              | Node 下改为调用 `node:test` 的 `test.describe(name, fn)`，把当前套件注册到 Node 的 test runner。                                            |
| **it / test**             | Node 下改为调用 `test.it(name, fn)` 或 `test(name, fn)`，同样交给 node:test 执行。                                                          |
| **expect**                | 现有实现不依赖 Deno/Bun，**无需改**，在 Node 下直接复用。                                                                                   |
| **afterAll / beforeAll**  | node:test 的 describe 里可在回调中自己维护「最后执行」逻辑，或用 Node 18+ 的 describe 钩子（若有）；在 test 包里做一层简单映射即可。        |
| **test.skip / test.only** | 对应 node:test 的 `test.skip`、`test.only`（或等价 API）。                                                                                  |
| **信号 / exit**           | 继续用 runtime-adapter 的 `addSignalListener`、`exit`；runtime-adapter 支持 Node 后，这两者在 Node 下用 `process.on`、`process.exit` 即可。 |

**运行方式**：

- Bun（不变）：`bun test tests/`
- Node：`node --import tsx --test tests/env.test.ts`，或写个脚本用 glob 跑
  `tests/**/*.test.ts`；package.json 里可加
  `"test:node": "node --import tsx --test tests/"`（若 Node
  支持目录则直接这样，否则用脚本遍历）。

**优点**：一份测试、双运行时跑，不用维护两套用例或两套断言风格；**缺点**：需要改
@dreamer/test（主要是 test-runner.ts 的 Node 分支），且依赖 runtime-adapter
先支持 Node。整体工作量在 **1–2 小时**（在 runtime-adapter Node 兼容做完之后）。

### 7.7 小结与建议

- **要不要在 Node 里跑测试？**
  - 做 **MVP** 时：可以 **不写** Node 专用测试，继续 `bun test tests/`，不装 ts
    服务器、也不在 Node 跑全量。
  - 想 **在 Node 上也有自动化**：用 **方案 B**（node:test + tsx，只跑少量 Node
    冒烟）成本最低；用 **方案 C**（Vitest）则更接近“和现在一样的写法、在 Node
    再跑一遍”。
- **“需要安装 TS 服务器吗？”**
  - 若选 **方案 A**：不需要。
  - 若选 **方案 B**：只需 **tsx**（在 Node 里执行 TS），不需要单独的“TS
    服务器”（如 language server 是编辑器的，和跑测试无关）。
  - 若选 **方案 C**：用 **Vitest** 即可，它内置对 TS 的支持，不需要再装 ts-node
    或单独 TS 服务器。

---

## 八、总结

- **难不难？** 不难，主要是「按运行时再补一条分支」，没有复杂架构改动。
- **改动大吗？** 文件数量不算多，但 **file.ts** 和 **network.ts**
  占大部分工作量；若只做 **MVP（入口 + env + path + file + process-info）**，约
  **2–3 小时** 即可让依赖 runtime-adapter 的 database 在 Node
  下跑起来；**全量兼容** 约 **6–10 小时**。
- **Node 测试怎么写？** 见 **第七节**：可只保留 Bun 测试（方案 A）；或加少量
  Node 冒烟测试用 node:test + tsx（方案 B）；或上 Vitest 在 Node 跑同一套
  describe/it/expect（方案 C）。不强制装「TS 服务器」，跑 TS 用 **tsx** 或
  **Vitest** 即可。
- **能否让 @dreamer/test 兼容 Node，从而共用同一份测试？** 可以。在
  **@dreamer/test** 里为 Node 加分支：`describe` / `it` 委托给
  **node:test**，`expect` 保持不变；跑法为
  `node --import tsx --test tests/*.test.ts`。前提是 **runtime-adapter 先支持
  Node**。详见 **第七节方案 D**。
