# @dreamer/runtime-adapter Windows Compatibility Analysis

[English](./WINDOWS_COMPATIBILITY_ANALYSIS.md) | [中文 (Chinese)](./WINDOWS_COMPATIBILITY_ANALYSIS-zh.md)

> Analysis date: 2025-02-07  
> Scope: All runtime-adapter source modules

---

## 1. Summary

| Status | Description |
|--------|-------------|
| **Mostly compatible** | Most APIs work correctly on Windows |
| **Partial limitations** | Some APIs have platform differences or require extra privileges |
| **Known risks** | wmic deprecation, chown unsupported, relative cross-drive (addressed) |

---

## 2. Module-level Analysis

### 2.1 Path API (`path.ts`) ✅ Mostly compatible

| Function | Windows support | Notes |
|----------|-----------------|-------|
| `join` | ✅ | Backslashes normalized to forward slashes; supports `C:\` style |
| `dirname` | ✅ | Handles Windows paths correctly |
| `basename` | ✅ | Handles Windows paths correctly |
| `extname` | ✅ | No platform dependency |
| `resolve` | ✅ | Supports `C:/path` absolute paths |
| `normalize` | ✅ | Handles `C:\`, `..`, `.` |
| `isAbsolute` | ✅ | Detects `C:\`, `C:/` |
| `isRelative` | ✅ | No platform dependency |
| `relative` | ✅ | **Fixed**: returns target path when `from` and `to` are on different drives (e.g. `relative("C:/a/b", "D:/x/y")` → `D:/x/y`, matching Node.js behavior) |

---

### 2.2 File System API (`file.ts`) ⚠️ Partial limitations

| Function | Windows support | Notes |
|----------|-----------------|-------|
| `readFile` / `writeFile` | ✅ | Deno/Bun both support Windows paths |
| `mkdir` / `ensureDir` | ✅ | `mode` has limited effect on Windows |
| `remove` / `rename` | ✅ | Works correctly |
| `stat` / `exists` | ✅ | Works correctly |
| `copyFile` | ✅ | Works correctly |
| `chmod` | ⚠️ | Windows only maps to read-only attribute; only `444`/`666` effective |
| `chown` | ❌ | **Not supported on Windows**; throws `EPERM` |
| `symlink` | ⚠️ | Requires admin or Developer Mode; otherwise throws `EPERM` |
| `watchFs` | ✅ | Deno.watchFs / fs.watch both support Windows |
| `makeTempDir` | ✅ | Bun uses `os.tmpdir()`, e.g. `C:\Users\xxx\AppData\Local\Temp` |
| `makeTempFile` | ✅ | Same as above |
| `realPath` | ✅ | Works correctly |
| `walk` | ✅ | No platform dependency |

**Recommendation**: Document `chown` and `symlink` Windows limitations clearly.

---

### 2.3 Process/Command API (`process.ts`) ✅ Mostly compatible

| Function | Windows support | Notes |
|----------|-----------------|-------|
| `createCommand` | ✅ | Deno.Command / Bun.spawn both support Windows |
| `execCommandSync` | ✅ | Uses `execFileSync`; executables in PATH are found |

**Note**: Commands like `deno` without `.exe` are resolved automatically by the system on Windows.

---

### 2.4 Process Info API (`process-info.ts`) ✅ Compatible

| Function | Windows support | Notes |
|----------|-----------------|-------|
| `execPath` | ✅ | Returns e.g. `C:\path\to\deno.exe` |
| `pid` | ✅ | Works correctly |
| `platform` | ✅ | Returns `"windows"` |
| `arch` | ✅ | Returns `x86_64` / `arm64` |
| `version` | ✅ | Works correctly |

---

### 2.5 Signal API (`signal.ts`) ✅ Handled

| Function | Windows support | Notes |
|----------|-----------------|-------|
| `addSignalListener` | ✅ | SIGTERM silently skipped on Windows+Deno |
| `removeSignalListener` | ✅ | Same as above |

---

### 2.6 Terminal API (`terminal.ts`) ✅ Handled

| Function | Windows support | Notes |
|----------|-----------------|-------|
| `isTerminal` | ✅ | Works correctly |
| `setStdinRaw` | ✅ | Returns `false` when Deno fails on Windows (exception caught) |
| `readStdin` | ✅ | Works correctly |
| `writeStdoutSync` | ✅ | Works correctly |

---

### 2.7 System Info API (`system-info.ts`) ✅ Implemented

| Function | Windows support | Notes |
|----------|-----------------|-------|
| `getMemoryInfo` | ✅ | Tries wmic first; falls back to PowerShell Get-CimInstance |
| `getCpuUsage` | ✅ | Deno/Bun native API |
| `getLoadAverage` | ✅ | Returns `undefined` by design |
| `getDiskUsage` | ✅ | Tries wmic first; falls back to PowerShell Get-CimInstance |
| `getSystemInfo` | ✅ | Bun uses os.cpus(); Deno uses wmic/PowerShell for core count |

**wmic deprecation timeline** (Microsoft):

- Windows 10 21H1: Deprecation started
- Windows 11 22H2/23H2: Available as optional feature
- Windows 11 24H2: Not installed by default
- Windows 11 25H2: Planned removal

**Implementation**: PowerShell fallback added. Example commands:

```powershell
# Memory
Get-CimInstance Win32_OperatingSystem | Select-Object TotalVisibleMemorySize, FreePhysicalMemory

# Disk
Get-CimInstance Win32_LogicalDisk | Select-Object Size, FreeSpace
```

---

### 2.8 Other modules

| Module | Windows support | Notes |
|--------|-----------------|-------|
| `env.ts` | ✅ | No platform dependency |
| `network.ts` | ✅ | HTTP/WebSocket cross-platform |
| `hash.ts` | ✅ | Web Crypto API cross-platform |
| `cron.ts` | ✅ | node-cron supports Windows |
| `detect.ts` | ✅ | No platform dependency |
| `utils.ts` | ✅ | No platform dependency |

---

## 3. Items to fix / improve

### High priority

1. ~~**`path.relative()` cross-drive**~~ ✅ Fixed  
   - When `from` and `to` are on different drives, returns the target path (matches Node.js).

### Medium priority

2. ~~**wmic replacement in `system-info.ts`**~~ ✅ Implemented  
   - PowerShell Get-CimInstance fallback added; used automatically when wmic is unavailable.

3. **`chown` documentation and behavior**  
   - Document that it throws EPERM on Windows; recommend checking `platform()` before calling.

### Low priority

4. **`symlink` documentation**  
   - Document that Windows requires admin or Developer Mode.

---

## 4. Testing recommendations

1. Run the full test suite on Windows: `deno test -A tests` and `bun test tests`.
2. Add cross-drive test cases for `path.relative()` (can be skipped by platform in CI).
3. Verify system-info fallback on Windows 11 24H2 when wmic is unavailable.

---

## 5. Conclusion

runtime-adapter is **mostly compatible** with Windows; most APIs work correctly. Current status:

- `path.relative()` cross-drive behavior → ✅ Fixed
- `system-info` wmic deprecation → ✅ PowerShell fallback added
- `chown` not supported on Windows → Documentation needed
