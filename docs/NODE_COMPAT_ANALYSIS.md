# runtime-adapter Node.js compatibility

**Canonical document (Chinese):**
**[docs/zh-CN/NODE_COMPAT.md](./zh-CN/NODE_COMPAT.md)**

> Status: **Phase A implemented**
> (file/env/path/process/network/terminal/system-info, smoke tests). Main suite
> remains Deno/Bun; Node smoke via `tests/node/*`. Package:
> `@dreamer/runtime-adapter@1.2.0`. **Minimum Node: 22** (`engines.node`:
> `>=22`). Date: **2026-07-22**.

---

## One-line summary

| Item                    | Verdict                                                |
| ----------------------- | ------------------------------------------------------ |
| Feasible / done?        | **Yes — Phase A shipped**                              |
| Hard parts (historical) | Import gate; **HTTP serve + WS**; test matrix          |
| Min Node                | **22**                                                 |
| Tests                   | Deno/Bun main suite + Node smoke (`npm run test:node`) |
| Further work            | Optional main-suite-on-Node; more node-like sharing    |

Detection order: **Deno → Bun → Node → unknown** (never detect Node before Bun).

## Related

| Doc                                            | Role                           |
| ---------------------------------------------- | ------------------------------ |
| [zh-CN/NODE_COMPAT.md](./zh-CN/NODE_COMPAT.md) | Full Chinese status + strategy |
| [zh-CN/TEST_REPORT.md](./zh-CN/TEST_REPORT.md) | Three-runtime results          |
| [zh-CN/CHANGELOG.md](./zh-CN/CHANGELOG.md)     | Release notes                  |
