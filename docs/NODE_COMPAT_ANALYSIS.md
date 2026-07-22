# runtime-adapter Node.js compatibility analysis

**Canonical document (Chinese, full analysis):**
**[docs/zh-CN/NODE_COMPAT.md](./zh-CN/NODE_COMPAT.md)**

> Status: **Phase A implemented** (file/env/path/process/network/terminal APIs, smoke tests); Phase B (test backend) pending.
> Baseline package: `@dreamer/runtime-adapter@1.2.0` (Deno + Bun + Node.js 22+).
> **Minimum Node version (decided): Node.js 22** (`engines.node`: `>=22`; CI baseline: 22 LTS).
> Date: **2026-07-22**.

---

## Supersession notice

An earlier short draft lived in this file and estimated “full Node support in 6–10 hours.”
That estimate is **too optimistic** once `serve` / WebSocket parity and a real Node test matrix are included.

**Use [zh-CN/NODE_COMPAT.md](./zh-CN/NODE_COMPAT.md) for:**

- Module-by-module work breakdown
- MVP vs full vs first-class definitions
- Testing strategy (`deno test` / `bun test` / Node `node:test` + `tsx`)
- Phased roadmap and risk list
- Effort ranges in **person-days / person-weeks**

For monorepo-wide Node (dweb, esbuild resolvers, view, CLI), see:
`dweb/docs/zh-CN/Node兼容工程量分析.md`.

---

## One-line summary

| Item | Verdict |
|------|---------|
| Feasible? | **Yes** — much of Bun path already uses `node:*`. |
| Hard parts | Top-level reject of non-Deno/Bun; **HTTP serve + WS upgrade**; **tests** via `@dreamer/test` (no Node backend yet). |
| **Min Node** | **22** (`>=22`); do **not** support 18/20; optional CI on 24. |
| MVP | detect + file/env/path/process-info/hash/cron — **good ROI**. |
| Full network | Plan in **weeks**, not hours. |
| Implementation | **Not started**; land only after explicit go-ahead. |

---

## Detection order (when implementing)

```text
1. Real Deno (not polyfill)
2. Bun (globalThis.Bun)
3. Node (process.versions.node)
4. unknown
```

Bun also exposes `process` — **never detect Node before Bun**.

---

## Suggested phases (no code in this doc)

1. Freeze MVP boundary (is network a hard throw on Node OK?).
2. `detect` + open import gate + smoke tests on real Node.
3. file (prefer shared node-like impl with Bun) + env/path/process-info.
4. process/signal/system-info/terminal.
5. network: stub → HTTP serve → WebSocket → TCP/TLS.
6. `@dreamer/test` Node backend + CI matrix ×3.
7. docs, `engines.node`, release.

---

## Related

| Doc | Role |
|-----|------|
| [zh-CN/NODE_COMPAT.md](./zh-CN/NODE_COMPAT.md) | **Full analysis (source of truth)** |
| [zh-CN/WIN_COMPAT.md](./zh-CN/WIN_COMPAT.md) | Windows platform limits (orthogonal) |
| [zh-CN/TEST_REPORT.md](./zh-CN/TEST_REPORT.md) | Current Deno/Bun results |
