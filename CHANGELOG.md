# Changelog

[English](./CHANGELOG.md) | [中文 (Chinese)](./CHANGELOG-zh.md)

All notable changes to @dreamer/runtime-adapter are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.1] - 2025-02-07

### Added

- **execPath**: Process info API now exports `execPath()` returning runtime executable path
- **Windows compatibility docs**: Added `WINDOWS_COMPATIBILITY_ANALYSIS.md` (EN) and `WINDOWS_COMPATIBILITY_ANALYSIS-zh.md` (ZH)

### Fixed

- **path.relative() cross-drive**: On Windows, `relative("C:/a/b", "D:/x/y")` now correctly returns `D:/x/y` (matches Node.js)
- **process-info execPath**: Fixed Deno/Bun type assertions for `execPath` type errors
- **Tests**: open/create/watchFs BadResource errors when stream closes resource; watchFs timer leak (clearTimeout)

### Changed

- **System Info wmic fallback**: `getMemoryInfo`, `getDiskUsage`, and CPU core count now fall back to PowerShell `Get-CimInstance` when wmic is unavailable (e.g. Windows 11 24H2+)
- **README**: Added platform support table (Linux/macOS/Windows) and Windows platform notes
- **Platform support**: Added `execPath()` to process info API table in README
- **Docs**: README/README-zh MD024 duplicate heading fixes; TEST_REPORT updated (266 tests); removed TEST_COVERAGE_ANALYSIS.md

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
