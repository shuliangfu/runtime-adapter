/**
 * 系统信息 API 适配模块
 * 提供统一的系统信息接口，兼容 Deno 和 Bun
 */

import { IS_BUN } from "./detect.ts";
import { createCommand, execCommandSync } from "./process.ts";
import { getDeno, getProcess } from "./utils.ts";
// 静态导入 Node.js 模块（仅在 Bun 环境下使用）
import * as nodeOs from "node:os";

/**
 * 执行命令并返回输出
 * output() 模式下会自动处理流，无需手动关闭
 */
async function execCommand(
  command: string,
  args: string[] = [],
): Promise<string> {
  const cmd = createCommand(command, {
    args,
    stdout: "piped",
  });
  const output = await cmd.output();
  return new TextDecoder().decode(output.stdout);
}

// ==================== Windows PowerShell 备选（wmic 弃用后的替代） ====================

/**
 * 解析 wmic/PowerShell 输出的 Key=Value 格式
 * 兼容 TotalVisibleMemorySize=12345 与 "TotalVisibleMemorySize=12345"
 */
function parseKeyValue(text: string, key: string): number | null {
  const match = text.match(new RegExp(`${key}=(\\d+)`, "i"));
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Windows 内存信息：优先 wmic，失败则用 PowerShell Get-CimInstance
 */
async function getWindowsMemoryAsync(): Promise<MemoryInfo | null> {
  try {
    const text = await execCommand("wmic", [
      "OS",
      "get",
      "TotalVisibleMemorySize,FreePhysicalMemory",
      "/format:value",
    ]);
    const totalKb = parseKeyValue(text, "TotalVisibleMemorySize");
    const freeKb = parseKeyValue(text, "FreePhysicalMemory");
    if (totalKb != null && freeKb != null) {
      const total = totalKb * 1024;
      const free = freeKb * 1024;
      const used = total - free;
      const usagePercent = total > 0 ? (used / total) * 100 : 0;
      return {
        total,
        available: free,
        used,
        free,
        usagePercent: Math.round(usagePercent * 100) / 100,
      };
    }
  } catch {
    // wmic 失败（如 Windows 11 24H2+ 未安装）
  }

  try {
    const ps =
      `$o=Get-CimInstance Win32_OperatingSystem;"TotalVisibleMemorySize="+$o.TotalVisibleMemorySize;"FreePhysicalMemory="+$o.FreePhysicalMemory`;
    const text = await execCommand("powershell", [
      "-NoProfile",
      "-Command",
      ps,
    ]);
    const totalKb = parseKeyValue(text, "TotalVisibleMemorySize");
    const freeKb = parseKeyValue(text, "FreePhysicalMemory");
    if (totalKb != null && freeKb != null) {
      const total = totalKb * 1024;
      const free = freeKb * 1024;
      const used = total - free;
      const usagePercent = total > 0 ? (used / total) * 100 : 0;
      return {
        total,
        available: free,
        used,
        free,
        usagePercent: Math.round(usagePercent * 100) / 100,
      };
    }
  } catch {
    // PowerShell 也失败
  }
  return null;
}

/**
 * Windows 内存信息（同步）：优先 wmic，失败则用 PowerShell
 */
function getWindowsMemorySync(): MemoryInfo | null {
  try {
    const text = execCommandSync("wmic", [
      "OS",
      "get",
      "TotalVisibleMemorySize,FreePhysicalMemory",
      "/format:value",
    ]);
    const totalKb = parseKeyValue(text, "TotalVisibleMemorySize");
    const freeKb = parseKeyValue(text, "FreePhysicalMemory");
    if (totalKb != null && freeKb != null) {
      const total = totalKb * 1024;
      const free = freeKb * 1024;
      const used = total - free;
      const usagePercent = total > 0 ? (used / total) * 100 : 0;
      return {
        total,
        available: free,
        used,
        free,
        usagePercent: Math.round(usagePercent * 100) / 100,
      };
    }
  } catch {
    // wmic 失败
  }

  try {
    const ps =
      `$o=Get-CimInstance Win32_OperatingSystem;"TotalVisibleMemorySize="+$o.TotalVisibleMemorySize;"FreePhysicalMemory="+$o.FreePhysicalMemory`;
    const text = execCommandSync("powershell", ["-NoProfile", "-Command", ps]);
    const totalKb = parseKeyValue(text, "TotalVisibleMemorySize");
    const freeKb = parseKeyValue(text, "FreePhysicalMemory");
    if (totalKb != null && freeKb != null) {
      const total = totalKb * 1024;
      const free = freeKb * 1024;
      const used = total - free;
      const usagePercent = total > 0 ? (used / total) * 100 : 0;
      return {
        total,
        available: free,
        used,
        free,
        usagePercent: Math.round(usagePercent * 100) / 100,
      };
    }
  } catch {
    // PowerShell 也失败
  }
  return null;
}

/**
 * Windows 磁盘信息：优先 wmic，失败则用 PowerShell
 */
async function getWindowsDiskAsync(): Promise<DiskUsage | null> {
  try {
    const text = await execCommand("wmic", [
      "logicaldisk",
      "get",
      "Size,FreeSpace,DeviceID",
      "/format:value",
    ]);
    const size = parseKeyValue(text, "Size");
    const free = parseKeyValue(text, "FreeSpace");
    if (size != null && free != null) {
      const used = size - free;
      const usagePercent = size > 0 ? (used / size) * 100 : 0;
      return {
        total: size,
        used,
        available: free,
        usagePercent: Math.round(usagePercent * 100) / 100,
      };
    }
  } catch {
    // wmic 失败
  }

  try {
    const ps =
      `$d=Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3"|Select-Object -First 1;"Size="+$d.Size;"FreeSpace="+$d.FreeSpace`;
    const text = await execCommand("powershell", [
      "-NoProfile",
      "-Command",
      ps,
    ]);
    const size = parseKeyValue(text, "Size");
    const free = parseKeyValue(text, "FreeSpace");
    if (size != null && free != null) {
      const used = size - free;
      const usagePercent = size > 0 ? (used / size) * 100 : 0;
      return {
        total: size,
        used,
        available: free,
        usagePercent: Math.round(usagePercent * 100) / 100,
      };
    }
  } catch {
    // PowerShell 也失败
  }
  return null;
}

/**
 * Windows CPU 核心数：优先 wmic，失败则用 PowerShell
 */
async function getWindowsCpuCoresAsync(): Promise<number | null> {
  try {
    const text = await execCommand("wmic", [
      "cpu",
      "get",
      "NumberOfCores",
      "/format:value",
    ]);
    const val = parseKeyValue(text, "NumberOfCores");
    if (val != null && val > 0) return val;
  } catch {
    // wmic 失败
  }

  try {
    const ps =
      `(Get-CimInstance Win32_Processor|Measure-Object -Property NumberOfCores -Sum).Sum`;
    const text = await execCommand("powershell", [
      "-NoProfile",
      "-Command",
      ps,
    ]);
    const val = parseInt(text.trim().match(/\d+/)?.[0] ?? "0", 10);
    if (val > 0) return val;
  } catch {
    // PowerShell 也失败
  }
  return null;
}

/**
 * Windows CPU 核心数（同步）：优先 wmic，失败则用 PowerShell
 */
function getWindowsCpuCoresSync(): number | null {
  try {
    const text = execCommandSync("wmic", [
      "cpu",
      "get",
      "NumberOfCores",
      "/format:value",
    ]);
    const val = parseKeyValue(text, "NumberOfCores");
    if (val != null && val > 0) return val;
  } catch {
    // wmic 失败
  }

  try {
    const ps =
      `(Get-CimInstance Win32_Processor|Measure-Object -Property NumberOfCores -Sum).Sum`;
    const text = execCommandSync("powershell", ["-NoProfile", "-Command", ps]);
    const val = parseInt(text.trim().match(/\d+/)?.[0] ?? "0", 10);
    if (val > 0) return val;
  } catch {
    // PowerShell 也失败
  }
  return null;
}

/**
 * 内存信息
 */
export interface MemoryInfo {
  /** 总内存（字节） */
  total: number;
  /** 可用内存（字节） */
  available: number;
  /** 已使用内存（字节） */
  used: number;
  /** 空闲内存（字节） */
  free: number;
  /** 内存使用率（百分比） */
  usagePercent: number;
  /** 交换区总量（字节，可选） */
  swapTotal?: number;
  /** 空闲交换区（字节，可选） */
  swapFree?: number;
}

/**
 * CPU 使用率信息
 */
export interface CpuUsage {
  /** 总 CPU 使用率（百分比） */
  usagePercent: number;
  /** 用户态 CPU 使用率（百分比） */
  userPercent: number;
  /** 系统态 CPU 使用率（百分比） */
  systemPercent: number;
}

/**
 * 系统负载信息（仅 Linux/macOS）
 */
export interface LoadAverage {
  /** 1 分钟平均负载 */
  load1: number;
  /** 5 分钟平均负载 */
  load5: number;
  /** 15 分钟平均负载 */
  load15: number;
}

/**
 * 磁盘使用信息
 */
export interface DiskUsage {
  /** 总空间（字节） */
  total: number;
  /** 已使用空间（字节） */
  used: number;
  /** 可用空间（字节） */
  available: number;
  /** 使用率（百分比） */
  usagePercent: number;
}

/**
 * 系统信息
 */
export interface SystemInfo {
  /** 主机名 */
  hostname: string;
  /** 操作系统平台 */
  platform: string;
  /** CPU 架构 */
  arch: string;
  /** 系统运行时间（秒） */
  uptime: number;
  /** CPU 核心数 */
  cpus?: number;
}

/**
 * 完整的系统状态
 */
export interface SystemStatus {
  /** 系统信息 */
  system: SystemInfo;
  /** 内存信息 */
  memory: MemoryInfo;
  /** CPU 使用率 */
  cpu: CpuUsage;
  /** 系统负载（Linux/macOS） */
  loadAverage?: LoadAverage;
  /** 磁盘使用信息（可选） */
  disk?: DiskUsage;
}

/**
 * 获取系统内存信息
 * @returns 内存信息
 *
 * @example
 * ```typescript
 * import { getMemoryInfo } from "@dreamer/runtime-adapter";
 *
 * const memory = await getMemoryInfo();
 * console.log(`总内存: ${memory.total} 字节`);
 * console.log(`使用率: ${memory.usagePercent}%`);
 * ```
 */
export async function getMemoryInfo(): Promise<MemoryInfo> {
  const deno = getDeno();
  if (deno) {
    try {
      const info = deno.systemMemoryInfo();
      const total = info.total || 0;
      const available = info.available || 0;
      const free = info.free || 0;
      const used = total - available;
      const usagePercent = total > 0 ? (used / total) * 100 : 0;

      return {
        total,
        available,
        used,
        free,
        usagePercent: Math.round(usagePercent * 100) / 100,
        swapTotal: info.swapTotal,
        swapFree: info.swapFree,
      };
    } catch {
      // 如果 Deno.systemMemoryInfo 不可用，返回默认值
      return {
        total: 0,
        available: 0,
        used: 0,
        free: 0,
        usagePercent: 0,
      };
    }
  }

  if (IS_BUN) {
    // Bun 需要通过系统命令获取内存信息
    try {
      const process = getProcess();
      const platform = process?.platform;
      if (platform === "win32") {
        // Windows: 优先 wmic，失败则用 PowerShell（wmic 在 Windows 11 24H2+ 已弃用）
        const mem = await getWindowsMemoryAsync();
        if (mem) return mem;
      } else {
        // Linux/macOS: 使用 free 命令（Linux）或 sysctl（macOS）
        if (platform === "darwin") {
          // macOS: 使用 sysctl
          const text = await execCommand("sysctl", ["-n", "hw.memsize"]);
          const total = parseInt(text.trim());

          // 获取可用内存（需要 vm_stat，这里简化处理）
          // 实际实现可能需要更复杂的解析
          return {
            total,
            available: 0,
            used: 0,
            free: 0,
            usagePercent: 0,
          };
        } else {
          // Linux: 使用 free 命令
          const text = await execCommand("free", ["-b"]);
          const lines = text.split("\n");
          const memLine = lines[1];
          const parts = memLine.split(/\s+/).filter(Boolean);

          if (parts.length >= 4) {
            const total = parseInt(parts[1]);
            const used = parseInt(parts[2]);
            const free = parseInt(parts[3]);
            const available = parseInt(parts[6] || parts[3]);
            const usagePercent = total > 0 ? (used / total) * 100 : 0;

            return {
              total,
              available,
              used,
              free,
              usagePercent: Math.round(usagePercent * 100) / 100,
            };
          }
        }
      }
    } catch {
      // 如果获取失败，返回默认值
    }
  }

  return {
    total: 0,
    available: 0,
    used: 0,
    free: 0,
    usagePercent: 0,
  };
}

/**
 * 获取 CPU 使用率
 *
 * 通过两次采样计算 CPU 使用率（进程级别）。
 *
 * @param interval 采样间隔（毫秒），默认 100ms
 * @returns CPU 使用率信息
 *
 * @example
 * ```typescript
 * import { getCpuUsage } from "@dreamer/runtime-adapter";
 *
 * const cpu = await getCpuUsage();
 * console.log(`CPU 使用率: ${cpu.usagePercent}%`);
 * ```
 */
export async function getCpuUsage(
  interval: number = 100,
): Promise<CpuUsage> {
  const deno = getDeno();
  if (deno) {
    try {
      const start = deno.cpuUsage();
      await new Promise((resolve) => setTimeout(resolve, interval));
      const end = deno.cpuUsage(start);

      // Deno.cpuUsage 返回的是微秒（microseconds）
      // interval 是毫秒，需要转换为微秒
      const totalMicroseconds = interval * 1000;
      const total = end.user + end.system;
      const usagePercent = total > 0
        ? Math.min(100, (total / totalMicroseconds) * 100)
        : 0;
      const userPercent = total > 0
        ? Math.min(100, (end.user / totalMicroseconds) * 100)
        : 0;
      const systemPercent = total > 0
        ? Math.min(100, (end.system / totalMicroseconds) * 100)
        : 0;

      return {
        usagePercent: Math.round(usagePercent * 100) / 100,
        userPercent: Math.round(userPercent * 100) / 100,
        systemPercent: Math.round(systemPercent * 100) / 100,
      };
    } catch {
      return {
        usagePercent: 0,
        userPercent: 0,
        systemPercent: 0,
      };
    }
  }

  if (IS_BUN) {
    // Bun 可能需要通过系统命令获取 CPU 使用率
    // 这里返回进程级别的 CPU 使用率（如果可用）
    try {
      // Bun 可能支持 process.cpuUsage()（Node.js 兼容）
      const process = getProcess();
      if (process?.cpuUsage) {
        const start = process.cpuUsage();
        await new Promise((resolve) => setTimeout(resolve, interval));
        const end = process.cpuUsage(start);

        const totalMicroseconds = interval * 1000;
        const total = end.user + end.system;
        const usagePercent = total > 0
          ? Math.min(100, (total / totalMicroseconds) * 100)
          : 0;
        const userPercent = total > 0
          ? Math.min(100, (end.user / totalMicroseconds) * 100)
          : 0;
        const systemPercent = total > 0
          ? Math.min(100, (end.system / totalMicroseconds) * 100)
          : 0;

        return {
          usagePercent: Math.round(usagePercent * 100) / 100,
          userPercent: Math.round(userPercent * 100) / 100,
          systemPercent: Math.round(systemPercent * 100) / 100,
        };
      }
    } catch {
      // 如果获取失败，返回默认值
    }
  }

  return {
    usagePercent: 0,
    userPercent: 0,
    systemPercent: 0,
  };
}

/**
 * 获取系统负载（Linux/macOS）
 *
 * @returns 系统负载信息，Windows 返回 undefined
 *
 * @example
 * ```typescript
 * import { getLoadAverage } from "@dreamer/runtime-adapter";
 *
 * const load = await getLoadAverage();
 * if (load) {
 *   console.log(`1分钟负载: ${load.load1}`);
 * }
 * ```
 */
export async function getLoadAverage(): Promise<LoadAverage | undefined> {
  const deno = getDeno();
  if (deno) {
    try {
      const loadavg = deno.loadavg();
      if (Array.isArray(loadavg) && loadavg.length >= 3) {
        return {
          load1: loadavg[0],
          load5: loadavg[1],
          load15: loadavg[2],
        };
      }
    } catch {
      // loadavg 在 Windows 上不可用
      return undefined;
    }
  }

  if (IS_BUN) {
    // Bun 需要通过系统命令获取负载信息
    try {
      const process = getProcess();
      const platform = process?.platform;
      if (platform !== "win32") {
        // Linux/macOS: 使用 uptime 命令
        const text = await execCommand("uptime");

        // 解析 uptime 输出: "load average: 0.50, 0.75, 1.00"
        const match = text.match(
          /load average:\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/,
        );
        if (match) {
          return {
            load1: parseFloat(match[1]),
            load5: parseFloat(match[2]),
            load15: parseFloat(match[3]),
          };
        }
      }
    } catch {
      // 如果获取失败，返回 undefined
    }
  }

  return undefined;
}

/**
 * 获取磁盘使用信息
 *
 * @param path 路径，默认为当前工作目录
 * @returns 磁盘使用信息
 *
 * @example
 * ```typescript
 * import { getDiskUsage } from "@dreamer/runtime-adapter";
 *
 * const disk = await getDiskUsage("/");
 * console.log(`磁盘使用率: ${disk.usagePercent}%`);
 * ```
 */
export async function getDiskUsage(
  path: string = ".",
): Promise<DiskUsage> {
  try {
    const deno = getDeno();
    const process = getProcess();
    const platform = deno?.build?.os || process?.platform;

    if (platform === "win32" || platform === "windows") {
      // Windows: 优先 wmic，失败则用 PowerShell（wmic 在 Windows 11 24H2+ 已弃用）
      const disk = await getWindowsDiskAsync();
      if (disk) return disk;
    } else {
      // Linux/macOS: 使用 df 命令
      const text = await execCommand("df", ["-B1", path]); // -B1 表示以字节为单位
      const lines = text.split("\n");

      // 跳过标题行，解析第二行
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/).filter(Boolean);
        if (parts.length >= 4) {
          const total = parseInt(parts[1]);
          const used = parseInt(parts[2]);
          const available = parseInt(parts[3]);
          const usagePercent = total > 0 ? (used / total) * 100 : 0;

          return {
            total,
            used,
            available,
            usagePercent: Math.round(usagePercent * 100) / 100,
          };
        }
      }
    }
  } catch {
    // 如果获取失败，返回默认值
  }

  return {
    total: 0,
    used: 0,
    available: 0,
    usagePercent: 0,
  };
}

/**
 * 获取系统信息
 *
 * @returns 系统信息
 *
 * @example
 * ```typescript
 * import { getSystemInfo } from "@dreamer/runtime-adapter";
 *
 * const info = await getSystemInfo();
 * console.log(`主机名: ${info.hostname}`);
 * console.log(`运行时间: ${info.uptime} 秒`);
 * ```
 */
export async function getSystemInfo(): Promise<SystemInfo> {
  let hostname = "unknown";
  let platform = "unknown";
  let arch = "unknown";
  let uptime = 0;
  let cpus: number | undefined;

  const deno = getDeno();
  if (deno) {
    try {
      hostname = deno.hostname();
      platform = deno.build?.os || "unknown";
      arch = deno.build?.arch || "unknown";
      uptime = deno.osUptime() || 0;

      // Deno 可能没有直接获取 CPU 核心数的 API
      // 可以通过系统命令获取
      try {
        if (platform === "windows") {
          const cores = await getWindowsCpuCoresAsync();
          if (cores != null) cpus = cores;
        } else {
          const text = await execCommand("nproc");
          const cores = parseInt(text.match(/\d+/)?.[0] || "0", 10);
          if (cores > 0) cpus = cores;
        }
      } catch {
        // 忽略错误
      }
    } catch {
      // 如果获取失败，使用默认值
    }
  }

  if (IS_BUN) {
    try {
      const process = getProcess();

      hostname = nodeOs.hostname();
      platform = process?.platform || "unknown";
      arch = process?.arch || "unknown";
      uptime = nodeOs.uptime();
      cpus = nodeOs.cpus().length;
    } catch {
      // 如果获取失败，使用默认值
    }
  }

  return {
    hostname,
    platform,
    arch,
    uptime,
    cpus,
  };
}

/**
 * 获取完整的系统状态
 *
 * 一次性获取所有系统状态信息。
 *
 * @param cpuInterval CPU 采样间隔（毫秒），默认 100ms
 * @param diskPath 磁盘路径，默认为当前工作目录
 * @returns 完整的系统状态
 *
 * @example
 * ```typescript
 * import { getSystemStatus } from "@dreamer/runtime-adapter";
 *
 * const status = await getSystemStatus();
 * console.log("系统信息:", status.system);
 * console.log("内存使用率:", status.memory.usagePercent + "%");
 * console.log("CPU 使用率:", status.cpu.usagePercent + "%");
 * ```
 */
export async function getSystemStatus(
  cpuInterval: number = 100,
  diskPath?: string,
): Promise<SystemStatus> {
  const [system, memory, cpu, loadAverage, disk] = await Promise.all([
    getSystemInfo(),
    getMemoryInfo(),
    getCpuUsage(cpuInterval),
    getLoadAverage(),
    diskPath ? getDiskUsage(diskPath) : Promise.resolve(undefined),
  ]);

  return {
    system,
    memory,
    cpu,
    loadAverage,
    disk,
  };
}

// ==================== 同步系统信息 API ====================
// 注意：这些同步 API 主要用于需要同步操作的场景
// 在可能的情况下，优先使用异步 API

/**
 * 同步获取系统内存信息
 * @returns 内存信息
 *
 * @example
 * ```typescript
 * import { getMemoryInfoSync } from "@dreamer/runtime-adapter";
 * const memory = getMemoryInfoSync();
 * console.log(`总内存: ${memory.total} 字节`);
 * console.log(`使用率: ${memory.usagePercent}%`);
 * ```
 */
export function getMemoryInfoSync(): MemoryInfo {
  const deno = getDeno();
  if (deno) {
    try {
      const info = deno.systemMemoryInfo();
      const total = info.total || 0;
      const available = info.available || 0;
      const free = info.free || 0;
      const used = total - available;
      const usagePercent = total > 0 ? (used / total) * 100 : 0;

      return {
        total,
        available,
        used,
        free,
        usagePercent: Math.round(usagePercent * 100) / 100,
        swapTotal: info.swapTotal,
        swapFree: info.swapFree,
      };
    } catch {
      // 如果 Deno.systemMemoryInfo 不可用，返回默认值
      return {
        total: 0,
        available: 0,
        used: 0,
        free: 0,
        usagePercent: 0,
      };
    }
  }

  if (IS_BUN) {
    // Bun 需要通过系统命令获取内存信息
    try {
      const process = getProcess();
      const platform = process?.platform;
      if (platform === "win32") {
        // Windows: 优先 wmic，失败则用 PowerShell
        const mem = getWindowsMemorySync();
        if (mem) return mem;
      } else {
        // Linux/macOS: 使用 free 命令（Linux）或 sysctl（macOS）
        if (platform === "darwin") {
          // macOS: 使用 sysctl
          const text = execCommandSync("sysctl", ["-n", "hw.memsize"]);
          const total = parseInt(text.trim());

          // 获取可用内存（需要 vm_stat，这里简化处理）
          // 实际实现可能需要更复杂的解析
          return {
            total,
            available: 0,
            used: 0,
            free: 0,
            usagePercent: 0,
          };
        } else {
          // Linux: 使用 free 命令
          const text = execCommandSync("free", ["-b"]);
          const lines = text.split("\n");
          const memLine = lines[1];
          const parts = memLine.split(/\s+/).filter(Boolean);

          if (parts.length >= 4) {
            const total = parseInt(parts[1]);
            const used = parseInt(parts[2]);
            const free = parseInt(parts[3]);
            const available = parseInt(parts[6] || parts[3]);
            const usagePercent = total > 0 ? (used / total) * 100 : 0;

            return {
              total,
              available,
              used,
              free,
              usagePercent: Math.round(usagePercent * 100) / 100,
            };
          }
        }
      }
    } catch {
      // 如果获取失败，返回默认值
    }
  }

  return {
    total: 0,
    available: 0,
    used: 0,
    free: 0,
    usagePercent: 0,
  };
}

/**
 * 同步获取系统负载（Linux/macOS）
 * @returns 系统负载信息，Windows 返回 undefined
 *
 * @example
 * ```typescript
 * import { getLoadAverageSync } from "@dreamer/runtime-adapter";
 * const load = getLoadAverageSync();
 * if (load) {
 *   console.log(`1分钟负载: ${load.load1}`);
 * }
 * ```
 */
export function getLoadAverageSync(): LoadAverage | undefined {
  const deno = getDeno();
  if (deno) {
    try {
      const loadavg = deno.loadavg();
      if (Array.isArray(loadavg) && loadavg.length >= 3) {
        return {
          load1: loadavg[0],
          load5: loadavg[1],
          load15: loadavg[2],
        };
      }
    } catch {
      // loadavg 在 Windows 上不可用
      return undefined;
    }
  }

  if (IS_BUN) {
    // Bun 需要通过系统命令获取负载信息
    try {
      const process = getProcess();
      const platform = process?.platform;
      if (platform !== "win32") {
        // Linux/macOS: 使用 uptime 命令
        const text = execCommandSync("uptime");

        // 解析 uptime 输出: "load average: 0.50, 0.75, 1.00"
        const match = text.match(
          /load average:\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/,
        );
        if (match) {
          return {
            load1: parseFloat(match[1]),
            load5: parseFloat(match[2]),
            load15: parseFloat(match[3]),
          };
        }
      }
    } catch {
      // 如果获取失败，返回 undefined
    }
  }

  return undefined;
}

/**
 * 同步获取系统信息
 * @returns 系统信息
 *
 * @example
 * ```typescript
 * import { getSystemInfoSync } from "@dreamer/runtime-adapter";
 * const info = getSystemInfoSync();
 * console.log(`主机名: ${info.hostname}`);
 * console.log(`运行时间: ${info.uptime} 秒`);
 * ```
 */
export function getSystemInfoSync(): SystemInfo {
  let hostname = "unknown";
  let platform = "unknown";
  let arch = "unknown";
  let uptime = 0;
  let cpus: number | undefined;

  const deno = getDeno();
  if (deno) {
    try {
      hostname = deno.hostname();
      platform = deno.build?.os || "unknown";
      arch = deno.build?.arch || "unknown";
      uptime = deno.osUptime() || 0;

      // Deno 可能没有直接获取 CPU 核心数的 API
      // 可以通过系统命令获取（同步）
      try {
        if (platform === "windows") {
          const cores = getWindowsCpuCoresSync();
          if (cores != null) cpus = cores;
        } else {
          const text = execCommandSync("nproc");
          const cores = parseInt(text.match(/\d+/)?.[0] || "0", 10);
          if (cores > 0) cpus = cores;
        }
      } catch {
        // 忽略错误
      }
    } catch {
      // 如果获取失败，使用默认值
    }
  }

  if (IS_BUN) {
    try {
      const process = getProcess();
      // Bun 支持 Node.js 兼容的 os 模块
      hostname = nodeOs.hostname();
      platform = process?.platform || "unknown";
      arch = process?.arch || "unknown";
      uptime = nodeOs.uptime();
      cpus = nodeOs.cpus().length;
    } catch {
      // 如果获取失败，使用默认值
    }
  }

  return {
    hostname,
    platform,
    arch,
    uptime,
    cpus,
  };
}
