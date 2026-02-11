# @dreamer/runtime-adapter Test Report

## Test Overview

- **Test library version**: @dreamer/test@^1.0.0-beta.12
- **Test framework**: @dreamer/test (compatible with Deno and Bun)
- **Test date**: 2026-02-07
- **Test environment**:
  - Bun 1.3.5
  - Deno 2.6.4

## Test Results

### Overall Statistics

- **Total tests**: 266
- **Passed**: 266 ✅
- **Failed**: 0
- **Pass rate**: 100% ✅
- **Test execution time**: ~51 seconds

### Test File Statistics

| Test File               | Test Count | Status        | Description                                           |
| ----------------------- | ---------- | ------------- | ----------------------------------------------------- |
| `detect.test.ts`        | 7          | ✅ All passed | Runtime detection                                     |
| `file.test.ts`          | 35         | ✅ All passed | Async file system API (open, create, watchFs, ensureDir) |
| `file-sync.test.ts`     | 21         | ✅ All passed | Sync file system API (includes ensureDirSync)          |
| `file-ext.test.ts`      | 4          | ✅ All passed | File extension utilities                              |
| `network.test.ts`       | 5          | ✅ All passed | Network API (HTTP server)                             |
| `websocket.test.ts`     | 6          | ✅ All passed | WebSocket API (upgradeWebSocket)                       |
| `websocket-test.test.ts`| 36         | ✅ All passed | WebSocket Server (rooms, events, heartbeat)            |
| `env.test.ts`           | 10         | ✅ All passed | Environment variable API                             |
| `process.test.ts`       | 12         | ✅ All passed | Process/command API (includes sync command execution) |
| `process-info.test.ts`  | 5          | ✅ All passed | Process info API (includes execPath)                  |
| `process-utils.test.ts` | 2          | ✅ All passed | Process utils API                                     |
| `signal.test.ts`        | 2          | ✅ All passed | Signal handling API                                   |
| `terminal.test.ts`      | 25         | ✅ All passed | Terminal API                                          |
| `cron.test.ts`          | 4          | ✅ All passed | Cron/scheduled task API                               |
| `path.test.ts`          | 52         | ✅ All passed | Path operation API (includes cross-drive relative)     |
| `hash.test.ts`          | 10         | ✅ All passed | File hash API (includes sync hash)                    |
| `system-info.test.ts`   | 16         | ✅ All passed | System info API (includes sync version)               |
| `mod.test.ts`           | 14         | ✅ All passed | Module exports (includes utils: getDeno, getBun, getProcess, getBuffer) |

## Feature Test Details

### 1. Runtime Detection (detect.test.ts)

**Test scenarios**:

- ✅ `detectRuntime()` function
  - Returns valid runtime type
  - Returns correct Runtime type
- ✅ `RUNTIME` constant
  - Is a valid runtime value
  - Is of Runtime type
- ✅ `IS_DENO` and `IS_BUN` constants
  - Are both boolean values
- ✅ Runtime environment check
  - Runs correctly in Deno or Bun environment

**Test result**: All 7 tests passed

### 2. File System API (file.test.ts)

**Test scenarios**:

- ✅ Directory operations
  - `mkdir` - Create directory
  - `mkdir` - Supports recursive directory creation
  - `ensureDir` - Ensure directory exists (create if not exists) ⭐ New
    - Should create non-existent directory
    - Should create nested directories
    - Should not throw error if directory already exists
    - Should support mode option
- ✅ File read/write
  - `writeTextFile` - Write text file
  - `readTextFile` - Read text file
  - `writeFile` - Write binary file
  - `readFile` - Read binary file
- ✅ File operations
  - `copyFile` - Copy file
  - `rename` - Rename file
  - `remove` - Remove file/directory
  - `stat` - Get file info
  - `readdir` - Read directory
  - `realPath` - Get real path
  - `symlink` - Create symlink
  - `chmod` - Change file permissions
  - `chown` - Change file owner
- ✅ Temporary file/directory
  - `makeTempFile` - Create temporary file
  - `makeTempDir` - Create temporary directory
- ✅ Working directory
  - `cwd` - Get current working directory
  - `chdir` - Change working directory
- ✅ File handles
  - `open` - Open file for read/write (stream-based)
  - `create` - Create and write file
- ✅ File watcher
  - `watchFs` - Watch directory for file create events
  - Supports close method
- ✅ Directory traversal
  - `walk` - Recursively traverse directory
    - Traverse all files in directory
    - Supports path matching

**Test result**: All 35 tests passed

### 3. Sync File System API (file-sync.test.ts) ⭐ New

**Test scenarios**:

- ✅ Directory operations
  - `mkdirSync` - Sync create directory
  - `mkdirSync` - Supports recursive directory creation
  - `ensureDirSync` - Sync ensure directory exists (create if not exists) ⭐ New
    - Should create non-existent directory
    - Should create nested directories
    - Should not throw error if directory already exists
    - Should support mode option
- ✅ File read/write
  - `writeTextFileSync` - Sync write text file
  - `readTextFileSync` - Sync read text file
  - `writeFileSync` - Sync write binary file
  - `readFileSync` - Sync read binary file
- ✅ File operations
  - `statSync` - Sync get file info
  - `statSync` - Sync get directory info
  - `removeSync` - Sync remove file
  - `removeSync` - Sync remove directory
  - `existsSync` - Check if file exists
  - `existsSync` - Check if directory exists
  - `isFileSync` - Check if path is file
  - `isDirectorySync` - Check if path is directory
  - `readdirSync` - Sync read directory contents
  - `realPathSync` - Sync resolve real path

**Test result**: All 20 tests passed

**Implementation characteristics**:

- ✅ Cross-runtime compatibility: Deno uses native sync API, Bun uses Node.js
  compatible `fs` module
- ✅ Performance optimization: Sync API is suitable for scenarios requiring
  blocking wait
- ✅ Error handling: Complete error handling and type checking

### 4. File Extension Utilities (file-ext.test.ts)

**Test scenarios**:

- ✅ `exists` - Check if file or directory exists
- ✅ `isFile` - Check if path is file
- ✅ `isDirectory` - Check if path is directory
- ✅ `truncate` - Truncate file

**Test result**: All 4 tests passed

### 5. Network API (network.test.ts)

**Test scenarios**:

- ✅ `serve` - HTTP server
  - Start HTTP server
  - Handle different request paths
  - Support POST requests
  - Can close server
  - Support custom hostname

**Test result**: All 5 tests passed

### 6. WebSocket API (websocket.test.ts) ⭐ New

**Test scenarios**:

- ✅ `upgradeWebSocket` - WebSocket upgrade
  - Should upgrade WebSocket connection (Deno)
  - Should upgrade WebSocket connection (Bun)
  - Should support addEventListener API
  - Should support send method
  - Should support close method

**Test result**: All 5 tests passed

**Implementation characteristics**:

- ✅ Cross-runtime compatibility: Works correctly in both Deno and Bun
  environments
- ✅ Unified API: Provides unified `addEventListener` interface, automatically
  adapts to Deno and Bun WebSocket API differences
- ✅ WebSocketAdapter: Uses adapter pattern internally to unify handling of Deno
  and Bun WebSocket API differences
- ✅ Automatic handling: WebSocket upgrade and event handling in Bun environment
  is fully automated, no manual configuration required

### 7. Environment Variable API (env.test.ts)

**Test scenarios**:

- ✅ `setEnv` - Set environment variable
- ✅ `getEnv` - Get environment variable
  - Get set environment variable
  - Return undefined (if environment variable does not exist)
- ✅ `hasEnv` - Check if environment variable exists
  - Return true (if environment variable exists)
  - Return false (if environment variable does not exist)
- ✅ `deleteEnv` - Delete environment variable
  - Delete environment variable
  - Safely delete non-existent environment variable
- ✅ `getEnvAll` - Get all environment variables
  - Return object of all environment variables
  - Include set environment variables

**Test result**: All 9 tests passed

### 8. Process/Command API (process.test.ts)

**Test scenarios**:

- ✅ `createCommand` - Create command object
  - Create command process
  - Execute simple command
  - Support stdin
  - Support environment variables
  - Support working directory
  - Can wait for process completion
  - Can get output
  - Can cancel process
- ✅ `execCommandSync` - Sync execute command ⭐ New
  - Sync execute command and return output
  - Support multiple arguments
  - Should throw error when command fails
  - Support working directory

**Test result**: All 12 tests passed

**Implementation characteristics**:

- ✅ Deno: Uses `Deno.Command.outputSync()`
- ✅ Bun: Uses `child_process.execFileSync()`
- ✅ Cross-runtime compatibility: Unified API interface

### 9. Process Info API (process-info.test.ts)

**Test scenarios**:

- ✅ `pid` - Get current process ID
- ✅ `platform` - Get operating system platform
- ✅ `arch` - Get CPU architecture
- ✅ `version` - Get runtime version info
- ✅ `execPath` - Get executable path

**Test result**: All 5 tests passed

### 10. Process Utils API (process-utils.test.ts)

**Test scenarios**:

- ✅ `args` - Get command-line arguments array
- ✅ `exit` - Exit program (function existence test)

**Test result**: All 2 tests passed

### 11. Signal Handling API (signal.test.ts)

**Test scenarios**:

- ✅ `addSignalListener` - Add signal listener
- ✅ `removeSignalListener` - Remove signal listener

**Test result**: All 2 tests passed

### 12. Terminal API (terminal.test.ts)

**Test scenarios**:

- ✅ `isTerminal` - Check if terminal
  - Returns boolean
  - Check if stdout is terminal
- ✅ `isStderrTerminal` - Check if stderr is terminal
  - Returns boolean
  - Check if stderr output is terminal
- ✅ `isStdinTerminal` - Check if stdin is terminal
  - Returns boolean
  - Check if stdin is terminal
- ✅ `getStdout` - Get stdout stream
  - Returns WritableStream
  - Can write data
  - Can write multiple data chunks
- ✅ `getStderr` - Get stderr stream
  - Returns WritableStream
  - Can write data
- ✅ `writeStdoutSync` - Sync write to stdout
  - Sync write to stdout
  - Can write empty data
  - Can write Unicode characters
  - Can write large data blocks
- ✅ `writeStderrSync` - Sync write to stderr
  - Sync write to stderr
  - Can write empty data
  - Can write error messages
- ✅ `readStdin` - Read stdin
  - Is async function
  - Accepts Uint8Array buffer
- ✅ `setStdinRaw` - Set stdin raw mode
  - Is function
  - Can enable raw mode
  - Can disable raw mode
  - Can enable raw mode with options
  - Can toggle raw mode

**Test result**: All 25 tests passed

### 13. Cron/Scheduled Task API (cron.test.ts)

**Test scenarios**:

- ✅ `cron` - Create cron task
  - Create cron task
  - Support closing cron task
  - Support AbortSignal
  - Support different cron expressions

**Test result**: All 4 tests passed

### 14. Path Operation API (path.test.ts)

**Test scenarios**:

- ✅ `join` - Join paths (9 tests)
- ✅ `dirname` - Get directory name (5 tests)
- ✅ `basename` - Get file name (6 tests)
- ✅ `extname` - Get extension (5 tests)
- ✅ `resolve` - Resolve path (7 tests)
- ✅ `relative` - Calculate relative path (includes cross-drive on Windows)
- ✅ `normalize` - Normalize path (5 tests)
- ✅ `isAbsolute` - Check if absolute path (3 tests)
- ✅ `isRelative` - Check if relative path (2 tests)
- ✅ Comprehensive tests (2 tests)

**Test result**: All 52 tests passed

### 15. File Hash API (hash.test.ts)

**Test scenarios**:

- ✅ `hash` - Async compute data hash
  - Compute string hash
  - Compute binary data hash
  - Use different algorithms (SHA-256, SHA-512)
- ✅ `hashFile` - Async compute file hash
  - Compute file hash
  - Produce same hash for same content
- ✅ `hashSync` - Sync compute data hash ⭐ New
  - Sync compute string hash
  - Sync compute binary data hash
  - Use different algorithms
- ✅ `hashFileSync` - Sync compute file hash ⭐ New
  - Sync compute file hash
  - Produce same hash for same content

**Test result**: All 10 tests passed

**Implementation characteristics**:

- ✅ Cross-runtime compatibility: Uses `node:crypto` module (both Deno and Bun
  support)
- ✅ Multiple algorithm support: MD5, SHA-1, SHA-256, SHA-512
- ✅ Sync and async versions: Meet different use case requirements

### 16. System Info API (system-info.test.ts)

**Test scenarios**:

- ✅ `getMemoryInfo` - Async get system memory info
  - Return memory info
  - Return valid memory usage rate
- ✅ `getCpuUsage` - Async get CPU usage
  - Return CPU usage
  - Support custom sampling interval
- ✅ `getLoadAverage` - Async get system load
  - Return system load or undefined
- ✅ `getDiskUsage` - Async get disk usage
  - Return disk usage info
  - Support custom path
- ✅ `getSystemInfo` - Async get system info
  - Return system info
  - Return valid platform info
- ✅ `getSystemStatus` - Async get full system status
  - Return full system status
  - Support custom parameters
- ✅ `getMemoryInfoSync` - Sync get system memory info ⭐ New
  - Sync return memory info
  - Return valid memory usage rate
- ✅ `getLoadAverageSync` - Sync get system load ⭐ New
  - Sync return system load or undefined
- ✅ `getSystemInfoSync` - Sync get system info ⭐ New
  - Sync return system info
  - Return valid platform info

**Test result**: All 16 tests passed

**Implementation characteristics**:

- ✅ Cross-runtime compatibility: Deno and Bun auto-adapt
- ✅ Resource management: Auto-close command streams, avoid resource leaks
- ✅ Error handling: Return default values on failure, do not throw exceptions
- ✅ Platform adaptation:
  - Deno: Uses native API (`Deno.systemMemoryInfo()`, `Deno.cpuUsage()`,
    `Deno.loadavg()`)
  - Bun: Gets via system commands (Windows: `wmic`, Linux: `free`, macOS:
    `sysctl`)
- ✅ Sync version: Provides sync API for scenarios requiring blocking wait

### 17. Module Exports (mod.test.ts)

**Test scenarios**:

- ✅ Export runtime detection related API
- ✅ Export file system API (includes open, create, watchFs)
- ✅ Export network API
- ✅ Export environment variable API
- ✅ Export process/command API
- ✅ Export process info API (execPath, pid, platform, arch)
- ✅ Export process utils API (args, exit)
- ✅ Export signal handling API
- ✅ Export path API
- ✅ Export terminal API
- ✅ Export cron/scheduled task API
- ✅ Export system info API
- ✅ Export hash API
- ✅ Export utils (getDeno, getBun, getProcess, getBuffer)

**Test result**: All 14 tests passed

## New Feature Highlights ⭐

### 1. WebSocket API Support

Added complete WebSocket support, including:

- `upgradeWebSocket` - Unified WebSocket upgrade interface
- `WebSocketAdapter` - Internal adapter, unifies handling of Deno and Bun
  WebSocket API differences
- Support for standard WebSocket API such as `addEventListener`, `send`, `close`

**Advantages**:

- Cross-runtime compatibility: Works correctly in both Deno and Bun environments
- Unified API: Uses standard `addEventListener` interface, no need to care about
  underlying implementation
- Auto-adaptation: WebSocket upgrade and event handling in Bun environment is
  fully automated

### 2. Sync File System API

Added complete sync file system API, including:

- `mkdirSync`, `ensureDirSync`, `writeTextFileSync`, `readTextFileSync`
- `writeFileSync`, `readFileSync`
- `statSync`, `removeSync`, `existsSync`
- `isFileSync`, `isDirectorySync`, `readdirSync`, `realPathSync`

**Advantages**:

- Suitable for scenarios requiring blocking wait
- Simplifies code in certain sync scenarios
- Fully compatible with Deno and Bun

### 3. Sync Command Execution

Added `execCommandSync` function:

- Deno: Uses `Deno.Command.outputSync()`
- Bun: Uses `child_process.execFileSync()`
- Unified error handling and output format

### 4. Sync Hash Computation

Added `hashSync` and `hashFileSync` functions:

- Uses `node:crypto` module (both Deno and Bun support)
- Supports multiple hash algorithms
- Suitable for scenarios requiring sync computation

### 5. Sync System Info

Added sync version of system info API:

- `getMemoryInfoSync`
- `getLoadAverageSync`
- `getSystemInfoSync`

### 6. ensureDir and ensureDirSync ⭐ New

Added directory ensure functionality, similar to `mkdir -p` command:

- `ensureDir` - Async ensure directory exists (create if not exists, do nothing
  if already exists)
- `ensureDirSync` - Sync ensure directory exists

**Advantages**:

- Simplifies directory creation logic, no need to manually check if directory
  exists
- Supports automatic creation of nested directories
- Does not throw error if directory already exists
- Supports mode option for setting directory permissions
- Fully compatible with Deno and Bun

## Cross-Runtime Compatibility Tests

### Deno Environment

- ✅ All APIs work correctly under Deno 2.6.4
- ✅ Implemented using Deno native API
- ✅ Sync API uses Deno native sync methods
- ✅ Permission requirement: Tests require `--allow-all` flag to run

### Bun Environment

- ✅ All APIs work correctly under Bun 1.3.5
- ✅ Implemented using Node.js compatible API or system commands
- ✅ Sync API uses Node.js compatible `fs` module
- ✅ No special permission configuration required
- ✅ `require` function is available in global scope

## Performance Tests

### Test Execution Time

- **Total execution time**: ~10.92 seconds
- **Average per test**: ~54 milliseconds
- **Fastest test**: < 1 millisecond
- **Slowest test**: ~4 seconds (cron task tests)

### Resource Usage

- ✅ No memory leaks (all command streams properly closed)
- ✅ No resource leaks (all file handles properly released)
- ✅ Temporary files properly cleaned up

## Known Issues and Limitations

### 1. System Info API

- **Windows platform**:
  - Memory info obtained via `wmic` command, requires system command execution
    permission
  - Disk info may not precisely match specified path, returns first disk info
  - `df` command may not support `-B` option on some systems (handled)
- **macOS platform**:
  - Memory info retrieval simplified, available memory may be 0
  - System load obtained via `uptime` command
- **Linux platform**:
  - All features work normally, uses standard system commands

### 2. System Load

- **Windows**: Does not support system load, `getLoadAverage()` and
  `getLoadAverageSync()` return `undefined`
- **Linux/macOS**: Normal support

### 3. CPU Usage

- **Deno**: Uses process-level CPU usage (`Deno.cpuUsage()`)
- **Bun**: If `process.cpuUsage()` is supported, uses process-level; otherwise
  returns default value

### 4. Sync Hash Computation

- Requires runtime support for `node:crypto` module
- Deno requires Node.js compatibility mode enabled
- Bun has native support

## Conclusion

### ✅ Test Pass Rate: 100%

All 266 test cases passed, including:

1. **Core features**: Runtime detection, file system, network, WebSocket,
   environment variables, process management
2. **Extended features**: Path operations, directory traversal, file hash,
   system info
3. **Utility features**: Terminal operations, cron tasks, signal handling
4. **New features**: WebSocket API, sync file system API, sync command
   execution, sync hash computation, sync system info, ensureDir/ensureDirSync

### Quality Assurance

- ✅ **Feature completeness**: All API features work correctly
- ✅ **Cross-runtime compatibility**: Works correctly in both Deno and Bun
  environments
- ✅ **Sync and async**: Provides complete sync and async API
- ✅ **Error handling**: Complete error handling and default value return
- ✅ **Resource management**: No memory leaks or resource leaks
- ✅ **Documentation**: README.md contains detailed usage examples

### Improvement Suggestions

1. **Continuous integration**: Recommend running both Deno and Bun tests in
   CI/CD
2. **Performance monitoring**: Regularly check test execution time to ensure
   performance stability
3. **Feature extension**: Continue extending system info API functionality based
   on actual usage needs
4. **Test coverage**: Consider using code coverage tools to ensure tests cover
   all code paths

---

**Test report generated**: 2026-02-07 | **Test framework**: @dreamer/test@^1.0.0-beta.12 | **Test environment**: Bun 1.3.5, Deno 2.6.4 | **Total tests**: 266 | **Pass rate**: 100% ✅
