# @dreamer/runtime-adapter Test Report

## Overview

- **Test library**: @dreamer/test@^1.1.10 (Deno / Bun main suite)
- **Node smoke**: `node:test` + `tsx` (`tests/node/*`)
- **Date**: 2026-07-22
- **Package version**: 1.2.0
- **Runtimes**:
  - Deno 2.x
  - Bun 1.3.14
  - Node.js 22+

## Results

### Summary

| Runtime  | Command               | Result                                |
| -------- | --------------------- | ------------------------------------- |
| **Deno** | `deno test -A tests/` | **315 passed**, 0 failed (~43s)       |
| **Bun**  | `bun test tests/`     | **286 passed**, 0 failed (~52s)       |
| **Node** | `npm run test:node`   | **29 passed**, 0 failed (~5.5s smoke) |

- **Pass rate**: 100% on all three runtimes ✅
- **One-shot**: `npm run test:all` (Deno + Bun + Node smoke)

> **Count note**: Deno still registers empty suites for `tests/node/*` when
> `if (!IS_NODE) return` (about +29). Bun does not collect `node:test` cases.
> Main suite coverage is equivalent on Deno/Bun. Node currently runs Phase A
> smoke only; full suite on Node waits for `@dreamer/test` Node backend usage
> against the same `tests/*.test.ts` files.

### Main suite (Deno / Bun)

| File                     | Status | Area                            |
| ------------------------ | ------ | ------------------------------- |
| `detect.test.ts`         | ✅     | Runtime detection               |
| `file.test.ts`           | ✅     | Async filesystem                |
| `file-sync.test.ts`      | ✅     | Sync filesystem                 |
| `file-ext.test.ts`       | ✅     | exists / isFile / truncate      |
| `network.test.ts`        | ✅     | HTTP serve                      |
| `websocket.test.ts`      | ✅     | upgradeWebSocket                |
| `websocket-test.test.ts` | ✅     | In-repo WS server               |
| `env.test.ts`            | ✅     | Environment                     |
| `process.test.ts`        | ✅     | Commands                        |
| `process-info.test.ts`   | ✅     | pid / platform / arch / version |
| `process-utils.test.ts`  | ✅     | args / exit                     |
| `signal.test.ts`         | ✅     | Signals                         |
| `terminal.test.ts`       | ✅     | TTY / stdio                     |
| `cron.test.ts`           | ✅     | Cron                            |
| `path.test.ts`           | ✅     | Paths                           |
| `hash.test.ts`           | ✅     | File hash                       |
| `system-info.test.ts`    | ✅     | Memory / CPU / disk             |
| `mod.test.ts`            | ✅     | Public exports                  |

### Node smoke (`tests/node/`)

| File                        | Status | Area                     |
| --------------------------- | ------ | ------------------------ |
| `smoke-detect.test.ts`      | ✅     | RUNTIME / IS_NODE        |
| `smoke-file.test.ts`        | ✅     | IO / open / mkdir / temp |
| `smoke-network.test.ts`     | ✅     | serve / TCP / WebSocket  |
| `smoke-process.test.ts`     | ✅     | exec / createCommand     |
| `smoke-system-info.test.ts` | ✅     | system / memory / cpu    |
| `smoke-terminal.test.ts`    | ✅     | TTY helpers              |

## Post-optimization verification (1.2.0)

- `deno check src/mod.ts`: pass
- Local monorepo Bun: keep `@dreamer/test` → `logger` → this package links
  healthy (see README)

## Conclusion

- **Deno / Bun**: first-class; full main suite green.
- **Node.js 22+**: import gate open; core API smoke green. Treat smoke +
  downstream package tests as the Node gate until the main suite runs fully
  under Node.
