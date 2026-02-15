# @dreamer/runtime-adapter Windows 兼容性深度分析

[English](../en-US/WIN_COMPAT.md) | 中文 (Chinese)

> 分析日期：2025-02-07\
> 分析范围：runtime-adapter 全部源码模块

---

## 一、总结

| 状态         | 说明                                                   |
| ------------ | ------------------------------------------------------ |
| **基本兼容** | 大部分 API 在 Windows 上可正常运行                     |
| **部分限制** | 若干 API 存在平台差异或需额外权限                      |
| **已知风险** | wmic 弃用、chown 不支持、relative 跨盘符问题（已修复） |

---

## 二、模块级分析

### 2.1 路径 API (`path.ts`) ✅ 基本兼容

| 函数         | Windows 支持 | 说明                                                                                              |
| ------------ | ------------ | ------------------------------------------------------------------------------------------------- |
| `join`       | ✅           | 反斜杠转正斜杠，支持 `C:\` 风格                                                                   |
| `dirname`    | ✅           | 正确处理 Windows 路径                                                                             |
| `basename`   | ✅           | 正确处理 Windows 路径                                                                             |
| `extname`    | ✅           | 无平台依赖                                                                                        |
| `resolve`    | ✅           | 支持 `C:/path` 绝对路径                                                                           |
| `normalize`  | ✅           | 处理 `C:\`、`..`、`.`                                                                             |
| `isAbsolute` | ✅           | 识别 `C:\`、`C:/`                                                                                 |
| `isRelative` | ✅           | 无平台依赖                                                                                        |
| `relative`   | ✅           | **已修复**：跨盘符时返回目标路径（如 `relative("C:/a/b", "D:/x/y")` → `D:/x/y`，与 Node.js 一致） |

---

### 2.2 文件系统 API (`file.ts`) ⚠️ 部分限制

| 函数                     | Windows 支持 | 说明                                                       |
| ------------------------ | ------------ | ---------------------------------------------------------- |
| `readFile` / `writeFile` | ✅           | Deno/Bun 均支持 Windows 路径                               |
| `mkdir` / `ensureDir`    | ✅           | `mode` 在 Windows 上效果有限                               |
| `remove` / `rename`      | ✅           | 正常工作                                                   |
| `stat` / `exists`        | ✅           | 正常工作                                                   |
| `copyFile`               | ✅           | 正常工作                                                   |
| `chmod`                  | ⚠️           | Windows 仅映射为只读属性，仅 `444`/`666` 有效              |
| `chown`                  | ❌           | **Windows 不支持**，会抛出 `EPERM`                         |
| `symlink`                | ⚠️           | 需管理员或启用开发者模式，否则抛出 `EPERM`                 |
| `watchFs`                | ✅           | Deno.watchFs / fs.watch 均支持 Windows                     |
| `makeTempDir`            | ✅           | Bun 用 `os.tmpdir()`，如 `C:\Users\xxx\AppData\Local\Temp` |
| `makeTempFile`           | ✅           | 同上                                                       |
| `realPath`               | ✅           | 正常工作                                                   |
| `walk`                   | ✅           | 无平台依赖                                                 |

**建议**：文档中明确说明 `chown`、`symlink` 在 Windows 上的限制。

---

### 2.3 进程/命令 API (`process.ts`) ✅ 基本兼容

| 函数              | Windows 支持 | 说明                                         |
| ----------------- | ------------ | -------------------------------------------- |
| `createCommand`   | ✅           | Deno.Command / Bun.spawn 均支持 Windows      |
| `execCommandSync` | ✅           | 使用 `execFileSync`，PATH 中可执行文件可找到 |

**注意**：Windows 上执行需加 `.exe` 的命令（如
`deno`）时，系统会自动解析，无问题。

---

### 2.4 进程信息 API (`process-info.ts`) ✅ 兼容

| 函数       | Windows 支持 | 说明                         |
| ---------- | ------------ | ---------------------------- |
| `execPath` | ✅           | 返回如 `C:\path\to\deno.exe` |
| `pid`      | ✅           | 正常                         |
| `platform` | ✅           | 返回 `"windows"`             |
| `arch`     | ✅           | 返回 `x86_64` / `arm64`      |
| `version`  | ✅           | 正常                         |

---

### 2.5 信号 API (`signal.ts`) ✅ 已处理

| 函数                   | Windows 支持 | 说明                               |
| ---------------------- | ------------ | ---------------------------------- |
| `addSignalListener`    | ✅           | SIGTERM 在 Windows+Deno 下静默跳过 |
| `removeSignalListener` | ✅           | 同上                               |

---

### 2.6 终端 API (`terminal.ts`) ✅ 已处理

| 函数              | Windows 支持 | 说明                                           |
| ----------------- | ------------ | ---------------------------------------------- |
| `isTerminal`      | ✅           | 正常                                           |
| `setStdinRaw`     | ✅           | Deno 在 Windows 上失败时捕获异常并返回 `false` |
| `readStdin`       | ✅           | 正常                                           |
| `writeStdoutSync` | ✅           | 正常                                           |

---

### 2.7 系统信息 API (`system-info.ts`) ✅ 已实现

| 函数             | Windows 支持 | 说明                                                 |
| ---------------- | ------------ | ---------------------------------------------------- |
| `getMemoryInfo`  | ✅           | 优先 wmic，失败则用 PowerShell Get-CimInstance       |
| `getCpuUsage`    | ✅           | Deno/Bun 原生 API                                    |
| `getLoadAverage` | ✅           | 已设计为返回 `undefined`                             |
| `getDiskUsage`   | ✅           | 优先 wmic，失败则用 PowerShell Get-CimInstance       |
| `getSystemInfo`  | ✅           | Bun 用 os.cpus()；Deno 用 wmic/PowerShell 获取核心数 |

**wmic 弃用时间线**（微软官方）：

- Windows 10 21H1：开始弃用
- Windows 11 22H2/23H2：作为可选功能提供
- Windows 11 24H2：默认不安装
- Windows 11 25H2：计划完全移除

**已实现**：PowerShell 备选方案，例如：

```powershell
# 内存
Get-CimInstance Win32_OperatingSystem | Select-Object TotalVisibleMemorySize, FreePhysicalMemory

# 磁盘
Get-CimInstance Win32_LogicalDisk | Select-Object Size, FreeSpace
```

---

### 2.8 其他模块

| 模块         | Windows 支持 | 说明                   |
| ------------ | ------------ | ---------------------- |
| `env.ts`     | ✅           | 无平台依赖             |
| `network.ts` | ✅           | HTTP/WebSocket 跨平台  |
| `hash.ts`    | ✅           | Web Crypto API 跨平台  |
| `cron.ts`    | ✅           | node-cron 支持 Windows |
| `detect.ts`  | ✅           | 无平台依赖             |
| `utils.ts`   | ✅           | 无平台依赖             |

---

## 三、待修复/改进项

### 高优先级

1. ~~**`path.relative()` 跨盘符**~~ ✅ 已修复
   - 当 `from` 和 `to` 盘符不同时，返回 `to` 的绝对路径（与 Node.js 一致）。

### 中优先级

2. ~~**`system-info.ts` 的 wmic 替代**~~ ✅ 已实现
   - 已添加 PowerShell Get-CimInstance 备选，当 wmic 不可用时自动回退。

3. **`chown` 文档与行为**
   - 在文档中明确说明 Windows 上会抛出 EPERM，建议调用前用 `platform()` 判断。

### 低优先级

4. **`symlink` 文档**
   - 明确说明 Windows 上需要管理员或开发者模式。

---

## 四、测试建议

1. 在 Windows 上运行完整测试套件：`deno test -A tests` 和 `bun test tests`。
2. 增加 `path.relative()` 跨盘符的用例（可在 CI 中按平台跳过）。
3. 在 Windows 11 24H2 环境验证 system-info 的退化/备选逻辑。

---

## 五、结论

runtime-adapter 在 Windows 上**基本兼容**，大部分 API 可正常使用。当前状态：

- `path.relative()` 跨盘符行为不符合预期 → ✅ 已修复
- `system-info` 依赖的 wmic 即将被 Windows 弃用 → ✅ 已添加 PowerShell 备选
- `chown` 在 Windows 上不被支持（需文档说明）
