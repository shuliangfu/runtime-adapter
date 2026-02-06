# Changelog

All notable changes to @dreamer/runtime-adapter are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-02-06

### Added

- **Stable release**: First stable version with stable API
- **Runtime auto-detection**: Auto-detect Deno / Bun runtime environment
- **File system API**: readFile, writeFile, mkdir, remove, existsSync, makeTempDir, makeTempFile, etc.
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
