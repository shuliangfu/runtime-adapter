# @dreamer/runtime-adapter Test Report

## Overview

- **Test library**: @dreamer/test (shared across Deno / Bun / Node)
- **Unified suite**: `tests/*.test.ts` (all three runtimes run the same files;
  no separate Node smoke set)
- **Date**: 2026-11-23
- **Package version**: 1.2.3
- **Runtimes**:
  - Deno 2.9.8
  - Bun 1.4.5
  - Node.js 22.22.2

## Results

### Summary

| Runtime  | Command                                        | Result                          |
| -------- | ---------------------------------------------- | ------------------------------- |
| **Deno** | `deno test -A tests/`                          | **318 passed**, 0 failed (~41s) |
| **Bun**  | `bun test tests/`                              | **293 passed**, 0 failed (~41s) |
| **Node** | `tsx --test --test-force-exit tests/*.test.ts` | **293 passed**, 0 failed (~25s) |

- **Pass rate**: 100% on all three runtimes ✅
- **One-shot**: `npm run test:all` (Deno + Bun + Node, same suite)

> **Count note**: all three runtimes run the same `tests/*.test.ts`. Deno's 318
> includes Deno-specific case branches (e.g. `upgradeWebSocket` Deno/Bun
> branches, Deno-native API cases); Bun/Node skip non-native cases and both
> report 293. Main business coverage is equivalent across all three.

### Main suite (shared across all three runtimes)

| File                     | Status | Area                            |
| ------------------------ | ------ | ------------------------------- |
| `detect.test.ts`         | ✅     | Runtime detection               |
| `file.test.ts`           | ✅     | Async filesystem                |
| `file-sync.test.ts`      | ✅     | Sync filesystem                 |
| `file-ext.test.ts`       | ✅     | exists / isFile / truncate      |
| `network.test.ts`        | ✅     | HTTP serve                      |
| `remote-addr.test.ts`    | ✅     | Request remote-address WeakMap  |
| `errors.test.ts`         | ✅     | Error types                     |
| `websocket.test.ts`      | ✅     | upgradeWebSocket                |
| `ws-concurrent.test.ts`  | ✅     | Concurrent WebSocket upgrades   |
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

## Static checks

- `deno check src/`: pass (0 errors)
- `deno lint src/`: pass (22 files, 0 issues)
- `deno fmt --check src/ tests/`: pass (46 files formatted)

## Conclusion

- **Three-runtimes first-class**: Deno / Bun / Node run the same
  `tests/*.test.ts`, all green.
- **Node.js 22+**: main suite wired in via `@dreamer/test`'s Node backend; no
  separate smoke set maintained.
- **Test isolation**: filesystem tests use unique `tests/data/<file>`
  subdirectories, eliminating parallel races.
