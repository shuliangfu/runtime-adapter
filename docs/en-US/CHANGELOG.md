# Changelog

[English](./CHANGELOG.md) | [中文 (Chinese)](../zh-CN/CHANGELOG.md)

All notable changes to @dreamer/runtime-adapter are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
