# Changelog

[English](./CHANGELOG.md) | [中文 (Chinese)](../zh-CN/CHANGELOG.md)

All notable changes to @dreamer/runtime-adapter are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.1] - 2026-07-22

### Fixed

- **`serve()` Node branch returns `Promise<ServeHandle>`**: Node's
  `server.listen()` is asynchronous — port binding completes on a later
  event-loop tick. Synchronously returning the handle made `handle.port` read
  `server.address()` as `null` → `undefined`. The Node branch now resolves the
  handle inside the listen callback, aligning with Deno/Bun sync semantics
  (callers must `await serve(...)`).
- **WebSocket upgrade socket wrongly destroyed**: `upgradeWebSocket`
  synchronously calls `wss.handleUpgrade` to take over the socket and sets
  `ctx.upgraded=true`. If `fetchHandler` then threw (e.g. undici's
  `Response(null,{status:101})` RangeError), the catch block called
  `socket.destroy()`, killing the already upgraded connection → WS `message`
  events silently lost. The catch now checks `ctx.upgraded` before destroying.
- **Node upgrade response status 101 RangeError**: undici's `Response`
  constructor rejects status 101 (must be 200-599). `toUpgradeResponse` now
  returns `Response(null,{status:200})` under `IS_NODE` (Node upgrades take over
  the socket; the Response return value is ignored).
- **Test parallel race**: `file`/`file-ext`/`file-sync`/`hash` shared
  `./tests/data`. Node runs test files in parallel by default, so concurrent
  mkdir/remove on the same directory caused intermittent ENOENT/port failures.
  Each file now uses a unique subdirectory
  (`./tests/data/{file,file-ext,file-sync,hash}`).
- **`websocket.test.ts` / `websocket-test.test.ts` missing `await serve()`**:
  paired with the serve Promise change, `serveWithSystemPort` / `listen` now
  `await serve(...)`.

### Changed

- ⚠ **Unified test suite**: removed `tests/node/` (6 `node:test` smoke files);
  all three runtimes now run the same `tests/*.test.ts`. Node runs the main
  suite via `@dreamer/test`'s Node backend instead of a separate smoke set.
- **`test:node` script**: `tsx --test tests/node/*.test.ts` →
  `tsx --test --test-force-exit tests/*.test.ts` (`--test-force-exit` prevents
  Node test process hang from stdin/server handles).
- **`@dreamer/i18n`**: `1.0.1` → `^1.1.0`.
- **`test:all`**: updated to the unified three-runtime `tests/*.test.ts`.

### Verified

- Deno: 309 passed, 0 failed
- Bun: 286 passed, 0 failed
- Node: 286 passed, 0 failed (`tsx --test --test-force-exit tests/*.test.ts`)

---

## [1.2.0] - 2026-07-22

### Added

- **Node.js compatibility (Phase A)**: `detect`/`env`/`signal`/`process-utils`/
  `process-info`/`file`/`system-info`/`terminal`/`network` modules now support
  Node.js >= 22 alongside Deno and Bun.
  - **Network**: `serve` (http.createServer), `upgradeWebSocket` (ws package +
    AsyncLocalStorage upgrade context), `connect` (node:net), `startTls`
    (node:tls).
  - **WebSocketAdapter**: Merged `IS_BUN` → `IS_BUN || IS_NODE` for
    `setWebSocket`/`setupEventHandlers`/`removeEventListener`; fixes Node
    `handleUpgrade` synchronous-callback timing where "open" event was lost.
- **engines.node**: Declared `>=22` in package.json.
- **Node smoke tests**: `tests/node/` — `node:test` + `tsx` based, guarded by
  `if (!IS_NODE) return` (no-op on Deno/Bun).
- **WebSocket CSWSH protection**: `ServeOptions.allowedOrigins` — WebSocket
  upgrade Origin validation (same-origin by default; explicit list overrides).
  Non-browser clients without Origin always pass.
- **WebSocket hardening options**:
  - `ServeOptions.websocket.maxPayload` — per-server message byte limit (default
    1MB).
  - `ServeOptions.websocket.idleTimeout` — idle timeout in ms (default 120000;
    0/negative disables).
  - `UpgradeWebSocketOptions.maxPayload` / `allowedOrigins` — per-upgrade
    overrides.
- **connect/startTls timeouts**: `ConnectOptions.timeout` and
  `StartTlsOptions.timeout` (default 30000ms; 0/negative disables).
- **Subprocess output cap**: `CommandOptions.maxOutputBytes` (default 10MB;
  0/negative disables). Exceeding the limit throws
  `RuntimeAdapterError(OUTPUT_SIZE_EXCEEDED)`.
- **Error code**: `OUTPUT_SIZE_EXCEEDED` on `RuntimeAdapterErrorCode`.
- **i18n keys**: `nodeWsNeedServe`, `error.internalServerError`,
  `error.wsOriginRejected`, `error.connectTimeout`, `error.tlsHandshakeTimeout`,
  `error.outputSizeExceeded` (en-US / zh-CN).
- **Node `startTls` signal support**: `Deno.startTls` third parameter
  `signalOptions?: { signal?: AbortSignal }` declared for handshake
  timeout/cancellation.
- **Scripts**: `test:deno` / `test:node` / `test:all` (Deno + Bun + Node smoke).

### Changed

- ⚠ **`removeSync` default `recursive` true → false**: Aligns with async
  `remove()` and Deno semantics. Non-empty directories require explicit
  `{ recursive: true }`.
- ⚠ **WebSocket `maxPayload` default 100MB → 1MB**: Defense-in-depth against
  large-message OOM; override via serve/upgrade options.
- **`rename` retry backoff**: Source-path stat precheck retries 50 → 5 (worst
  case 2.5s → 250ms).
- Removed `@types/ws` devDependency (eliminated `@types/node` global `Event`
  pollution vs `deno.window`).
- `startTls` Node branch: `caCerts` via `Buffer.from()` for `tls.connect`.
- `package.json`/`deno.json`: added `ws` dependency; `tsx` for `test:node`.
- **Docs**: README / CHANGELOG / TEST_REPORT / NODE_COMPAT aligned with
  three-runtime support.

### Optimized

- **`writeFile` / `writeTextFile` (Bun)**: No post-write re-read polling;
  Bun/Node share `node:fs/promises.writeFile`.
- **`open` (Bun)**: Real `node:fs` streams + `nodeOpenPlan` (no rewrite-whole-
  file-per-chunk).
- **`stat` / `statSync`**: Shared `mapNodeStatsToFileInfo`.
- **`readFile` (Node) / `readFileSync` (Bun/Node)**: Zero-copy Buffer return.
- **`writeFileSync`**: Write `Uint8Array` directly (no `Buffer.from` copy).
- **`version` / `execPath` fallbacks**: Unknown runtime no longer pretends to be
  `"deno"`.
- **`args`**: Prefer `Bun.argv`, then shared `process.argv` with Node.
- **`makeTempDir`**: Avoid prefixes ending in `X` (Node mkdtemp warning).
- **`env` provider cache**: `getEnvProvider()` lazy-inits once.
- **`readStdin`**: Named handlers + `removeListener` to avoid listener leak.

### Fixed

- **HTTP 500 error leakage**: Node `serve` returns generic
  `error.internalServerError` (no internal detail to clients).
- **CSWSH Origin validation**: WebSocket upgrades validate `Origin` (same-origin
  default).
- **`allAdapters` memory leak**: Remove adapter from static set on close.
- **Node `handleUpgrade` timing**: "open" event no longer lost when the upgrade
  callback runs synchronously.

## [1.1.0] - 2026-07-21

### Added

- **`RuntimeAdapterError`**: Stable error codes (`UNSUPPORTED_RUNTIME`,
  `ONLY_BUN_OR_DENO`, `PLATFORM_LIMITATION`, …) with `isRuntimeAdapterError()`.
- **`IS_SUPPORTED` / `assertSupportedRuntime()`**: Explicit supported-runtime
  checks (Deno or Bun only; Node not targeted).
- **Subpath exports**: `@dreamer/runtime-adapter/fs`, `/path`, `/process`,
  `/net` for lighter imports without pulling the full surface.

### Fixed

- **Bun multi-`serve` WebSocket upgrade**: Request handlers run inside
  `AsyncLocalStorage` so `upgradeWebSocket` resolves the correct Bun server
  instance instead of a global singleton (reduces cross-talk when multiple
  servers run in one process).
- **file `chdir` on Bun without `process.chdir`**: Throws `RuntimeAdapterError`
  with `PLATFORM_LIMITATION` instead of a bare `Error`.

### Changed

- file / env / process-utils: unsupported-runtime throws use
  `RuntimeAdapterError` (`UNSUPPORTED_RUNTIME`).
- Dev dependency `@dreamer/test` raised to `^1.1.10`.

### Fixed (additional)

- **macOS disk usage**: `getDiskUsage` uses `df -k` on darwin (convert KiB to
  bytes) instead of Linux-only `df -B1`.

---

## [1.0.19] - 2026-06-26

### Fixed

- **`serve()` WebSocket upgrade on Deno**: The Deno request handler is no longer
  wrapped in `async/await`, so handlers can synchronously return the original
  `upgradeWebSocket` 101 response. Fixes
  `Upgrade response was not returned from
  callback` when upgrading WebSockets
  through `serve()`.
- **WebSocket integration tests**: The test mock server (`tests/websocket.ts`)
  now reads handshake data before `upgradeWebSocket()`, returns 101 immediately,
  and defers Socket creation and middleware to a microtask so Deno upgrade
  constraints are satisfied.

### Changed

- **CI**: Set workflow env `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` for GitHub
  Actions Node 24 validation.

---

## [1.0.18] - 2026-02-25

### Fixed

- **args() on Bun (Windows)**: When running under Bun, `args()` now prefers
  `Bun.argv` over `process.argv` so script arguments (e.g. `--build` from
  `bun run script.ts -- --build`) are correctly received on Windows where
  `process.argv` may omit them.

### Added

- **process-utils tests**: Additional tests for `args()` (multiple calls, Bun
  environment); full Windows Bun `--build` behavior is covered by dweb CI.

---

## [1.0.17] - 2026-02-22

### Added

- **Path API – `fromFileUrl()`**: Converts a `file://` URL (string or `URL`
  object) to a filesystem path with forward slashes. Use this when spawning
  subprocesses with script paths on Windows with Bun, where `URL.pathname`
  yields `/D:/...` and can cause spawn to fail;
  `fromFileUrl(new URL("./script.ts", import.meta.url))` returns a path that Bun
  accepts.

### Fixed

- **fromFileUrl tests on Windows**: Tests now use platform-valid file URLs on
  Windows (Node `fileURLToPath` requires absolute paths; Unix-style
  `file:///home/...` throws). Deno and Bun Windows CI pass.

---

## [1.0.16] - 2026-02-21

### Fixed

- **Windows Bun CI – system info platform**: `getSystemInfo()` and
  `getSystemInfoSync()` now normalize Node/Bun platform `"win32"` to `"windows"`
  so the returned `platform` is one of `linux`, `darwin`, `windows`, or
  `unknown`, matching Deno and test expectations.
- **Windows Bun CI – pathToFileUrl**: `pathToFileUrl()` now normalizes
  backslashes to forward slashes in the returned `file://` URL so behavior is
  consistent on Windows (including Bun) and tests pass.
- **Windows Bun CI – cron close test**: The cron test “应该支持关闭定时任务” now
  allows at most one extra execution after `handle.close()` to account for
  node-cron possibly firing one more tick after stop on Windows/Bun.

---

## [1.0.15] - 2026-02-19

### Changed

- **i18n**: Initialization now runs automatically when the i18n module is
  loaded. Entry files (`mod.ts`, `detect.ts`) no longer import or call
  `initRuntimeAdapterI18n`; remove any such usage from your code.

---

## [1.0.14] - 2026-02-19

### Changed

- **i18n**: Renamed translation method from `$t` to `$tr` to avoid conflict with
  global `$t`. Update existing code to use `$tr` for package messages.

---

## [1.0.13] - 2026-02-18

### Changed

- **i18n**: All user- and log-facing strings use `$t`; no hardcoded English or
  Chinese. Added `debug.*` and `error.bunRethrowSubstring1/2` to en-US and zh-CN
  locales. WebSocket debug messages and Bun execFileSync rethrow detection now
  go through i18n. Translation entry point is `$t` only (no `tr` method).

---

## [1.0.12] - 2026-02-18

### Fixed

- **Bun WebSocket fetch return value**: For WebSocket upgrade requests, await
  the handler then return a 101 Response instead of undefined. Bun logs
  "Expected a Response object, but received 'undefined'" and fails the client
  connection when fetch returns undefined; returning 101 after the handler
  completes fixes the upgrade and removes the error. Applied to both serve()
  overloads (function and object form).

---

## [1.0.11] - 2026-02-18

### Fixed

- **Bun WebSocket open event timing**: Emit the adapter `open` event in
  `setTimeout(0)` instead of `queueMicrotask()`. Bun calls `websocket.open(ws)`
  synchronously inside `upgrade()`, so the handler has not yet run
  `addEventListener("open", ...)` when `setWebSocket(ws)` runs; a microtask
  still runs before the handler continues, so listeners were 0. Deferring to the
  next macrotask ensures the handler has registered the listener before
  `emit("open")`, so server-side send (e.g. "Hello from server") is delivered.

### Added

- **WebSocket debug logging**: Set `RUNTIME_ADAPTER_DEBUG_WS=1` to log fetch,
  upgradeWebSocket, open(ws), and setWebSocket for troubleshooting.

---

## [1.0.10] - 2026-02-18

### Fixed

- **Bun WebSocket upgrade**: Create and register the WebSocket adapter in
  `pendingBunAdapters` **before** calling `bunServerInstance.upgrade(request)`.
  Bun may invoke `websocket.open(ws)` synchronously during `upgrade()`; if the
  adapter was created only after `upgrade()`, `open(ws)` could not find it, so
  `setWebSocket(ws)` was never called and server-side `send()` stayed queued in
  `pendingOperations`, causing clients to never receive messages (e.g. batch
  heartbeat ping). Now `open(ws)` can resolve the adapter and flush pending
  sends.

---

## [1.0.9] - 2026-02-18

### Added

- **i18n**: Error messages (unsupported runtime,
  file/process/network/terminal/cron) are now translatable via `@dreamer/i18n`
  with en-US and zh-CN locales. New exports: `$t`, `initRuntimeAdapterI18n`,
  `Locale`. `detect.ts` uses `$t("error.onlyBunOrDeno")`; i18n does not depend
  on `detect.ts` to avoid circular dependency.

---

## [1.0.8] - 2026-02-17

### Added

- **SpawnedProcess.unref()**: Allows parent process to exit after awaiting child
  status (Deno keeps child ref by default; call `unref()` after
  `await child.status` so the CLI can exit). Bun implementation is a no-op.

---

## [1.0.7] - 2026-02-16

### Fixed

- **path resolve root path test on Windows**: Use platform-aware assertion; on
  Windows `resolve("/", "file.txt")` returns current drive root (e.g.
  `D:/file.txt`), not `/file.txt`.

---

## [1.0.6] - 2026-02-16

### Changed

- **path.join**: Use node:path semantics only; result normalized to forward
  slashes (e.g. `join(".", "file.txt")` returns `"file.txt"`). Removed
  special-case that prepended `"./"`.
- **hash API**: Unified to use `node:crypto` for both async and sync; Deno and
  Bun both support static import. Removed `IS_DENO`/`IS_BUN` and `require`
  fallback.
- **Docs**: Path API note (join semantics, forward slashes); Hash API note
  (node:crypto, Deno/Bun); TEST_REPORT hash count 10→11, total tests 266→267.
- **License**: Project license updated to Apache 2.0.

---

## [1.0.5] - 2026-02-10

### Changed

- **CI**: Remove Bun test jobs (JSR dependency resolution issues in CI); CI runs
  Deno-only on Linux, macOS, Windows
- **CI**: Restore package.json to .gitignore (no longer committed)
- **CI**: Reorder jobs - put test-windows last (Linux → macOS → Windows)

---

## [1.0.4] - 2025-02-07

### Fixed

- **pathToFileUrl test on Windows**: Platform-specific assertion for POSIX
  absolute path (`/home/user/config.ts`); on Windows, Node's pathToFileURL
  resolves it as current-drive path (e.g. `file:///D:/home/user/config.ts`)

### Changed

- **WebSocket tests**: Use system-assigned port (`port: 0`) instead of fixed
  port to avoid AddrInUse conflicts

---

## [1.0.3] - 2025-02-07

### Added

- **CI workflow**: GitHub Actions CI on Linux, macOS, Windows (deno check, lint,
  test)

### Fixed

- **Windows chmod**: Wrap chmod in try-catch (Windows may not support)
- **Windows chdir**: Path assertion normalized for backslash
- **Windows path resolve**: Platform-aware assertions for Unix/Windows path
  formats
- **Windows process**: `cd` requires `cmd /c cd` (shell built-in); use
  `sort`/`cat` for spawn; `set`/`printenv` for env; `cmd /c cd` for cwd
- **Deno check**: crypto-comparison/performance use
  `(globalThis as any).require`; file.test use `globalThis.process` for
  getuid/getgid
- **watchFs test**: Accept both `create` and `modify` events (Bun/Node fs.watch
  may report modify)
- **WebSocket tests**: Try-catch around `ws.send()`; `cmd /c cd` for Windows;
  port counter + delay to avoid AddrInUse

---

## [1.0.2] - 2025-02-07

### Fixed

- **Bun createCommand stdin**: Wrapped Bun FileSink to Web Streams
  WritableStream so `proc.stdin.getWriter()` works (Bun returns FileSink with
  write/end, not getWriter)
- **Bun createCommand stdio**: Map `"null"` to `"ignore"` and `"piped"` to
  `"pipe"` for Bun spawn options (Bun does not accept string `"null"`)
- **Bun export resolution**: Explicit `execPath` export in mod.ts for Bun
  workspace/local dependency resolution

### Added

- **package.json exports**: Added `exports` field for Bun workspace and local
  file: dependency resolution

---

## [1.0.1] - 2025-02-07

### Added

- **execPath**: Process info API now exports `execPath()` returning runtime
  executable path
- **Windows compatibility docs**: Added `WINDOWS_COMPATIBILITY_ANALYSIS.md` (EN)
  and `WINDOWS_COMPATIBILITY_ANALYSIS-zh.md` (ZH)

### Fixed

- **path.relative() cross-drive**: On Windows, `relative("C:/a/b", "D:/x/y")`
  now correctly returns `D:/x/y` (matches Node.js)
- **process-info execPath**: Fixed Deno/Bun type assertions for `execPath` type
  errors
- **Tests**: open/create/watchFs BadResource errors when stream closes resource;
  watchFs timer leak (clearTimeout)

### Changed

- **System Info wmic fallback**: `getMemoryInfo`, `getDiskUsage`, and CPU core
  count now fall back to PowerShell `Get-CimInstance` when wmic is unavailable
  (e.g. Windows 11 24H2+)
- **README**: Added platform support table (Linux/macOS/Windows) and Windows
  platform notes
- **Platform support**: Added `execPath()` to process info API table in README
- **Docs**: README/README-zh MD024 duplicate heading fixes; TEST_REPORT updated
  (266 tests); removed TEST_COVERAGE_ANALYSIS.md

---

## [1.0.0] - 2026-02-06

### Added

- **Stable release**: First stable version with stable API
- **Runtime auto-detection**: Auto-detect Deno / Bun runtime environment
- **File system API**: readFile, writeFile, mkdir, remove, existsSync,
  makeTempDir, makeTempFile, etc.
- **Network API**: serve, upgradeWebSocket, TCP/TLS connections
- **Environment variable API**: getEnv, setEnv, hasEnv, deleteEnv
- **Process/command API**: spawn, exec, kill, etc.
- **Process info API**: Process ID, platform, architecture, version info
- **Process utils API**: Command-line arguments, program exit
- **Signal handling API**: SIGTERM, SIGINT, SIGUSR1, SIGUSR2 listeners
- **Terminal API**: TTY detection, standard streams, raw mode
- **Cron API**: Cron scheduled tasks (based on node-cron), second-level support
- **Path API**: join, resolve, dirname, basename, relative, etc.
- **File hash API**: SHA-256, SHA-512, SHA-1, MD5
- **System info API**: Memory, CPU, disk usage, system load, hostname, etc.

### Compatibility

- Deno 2.6+
- Bun 1.3.5+
