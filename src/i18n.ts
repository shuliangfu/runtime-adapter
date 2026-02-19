/**
 * @module @dreamer/runtime-adapter/i18n
 *
 * i18n for @dreamer/runtime-adapter: error messages (unsupported runtime,
 * file/process/network errors) and debug labels. No global; use import $tr.
 * Reads LANGUAGE/LC_ALL/LANG via getEnvForLocale to avoid circular dependency
 * (env.ts would otherwise depend on i18n).
 */

import {
  createI18n,
  type I18n,
  type TranslationData,
  type TranslationParams,
} from "@dreamer/i18n";
import enUS from "./locales/en-US.json" with { type: "json" };
import zhCN from "./locales/zh-CN.json" with { type: "json" };

/** Supported locale. */
export type Locale = "en-US" | "zh-CN";

/** Default locale when detection fails. */
export const DEFAULT_LOCALE: Locale = "en-US";

const RUNTIME_ADAPTER_LOCALES: Locale[] = ["en-US", "zh-CN"];

const LOCALE_DATA: Record<string, TranslationData> = {
  "en-US": enUS as TranslationData,
  "zh-CN": zhCN as TranslationData,
};

/** init 时创建的实例，不挂全局 */
let runtimeAdapterI18n: I18n | null = null;

/**
 * 从当前运行时读取环境变量（仅用于 locale 检测）。
 * 内联判断 Deno/Bun，不依赖 env.ts，避免循环依赖。
 */
function getEnvForLocale(key: string): string | undefined {
  const g = globalThis as unknown as {
    Deno?: { env?: { get?(k: string): string | undefined } };
    process?: { env?: Record<string, string> };
  };
  if (typeof g.Deno?.env?.get === "function") {
    return g.Deno.env.get(key);
  }
  if (typeof g.process?.env === "object") {
    return g.process.env[key];
  }
  return undefined;
}

/**
 * Detect locale: LANGUAGE > LC_ALL > LANG.
 */
export function detectLocale(): Locale {
  const langEnv = getEnvForLocale("LANGUAGE") || getEnvForLocale("LC_ALL") ||
    getEnvForLocale("LANG");
  if (!langEnv) return DEFAULT_LOCALE;
  const first = langEnv.split(/[:\s]/)[0]?.trim();
  if (!first) return DEFAULT_LOCALE;
  const match = first.match(/^([a-z]{2})[-_]([A-Z]{2})/i);
  if (match) {
    const normalized = `${match[1].toLowerCase()}-${
      match[2].toUpperCase()
    }` as Locale;
    if (RUNTIME_ADAPTER_LOCALES.includes(normalized)) return normalized;
  }
  const primary = first.substring(0, 2).toLowerCase();
  if (primary === "zh") return "zh-CN";
  if (primary === "en") return "en-US";
  return DEFAULT_LOCALE;
}

/** 内部初始化，导入 i18n 时自动执行，不导出 */
function initRuntimeAdapterI18n(): void {
  if (runtimeAdapterI18n) return;
  const i18n = createI18n({
    defaultLocale: DEFAULT_LOCALE,
    fallbackBehavior: "default",
    locales: [...RUNTIME_ADAPTER_LOCALES],
    translations: LOCALE_DATA as Record<string, TranslationData>,
  });
  i18n.setLocale(detectLocale());
  runtimeAdapterI18n = i18n;
}

initRuntimeAdapterI18n();

/**
 * 框架专用翻译。lang 不传时使用当前 locale。
 */
export function $tr(
  key: string,
  params?: TranslationParams,
  lang?: Locale,
): string {
  if (!runtimeAdapterI18n) initRuntimeAdapterI18n();
  if (!runtimeAdapterI18n) return key;
  if (lang !== undefined) {
    const prev = runtimeAdapterI18n.getLocale();
    runtimeAdapterI18n.setLocale(lang);
    try {
      return runtimeAdapterI18n.t(key, params);
    } finally {
      runtimeAdapterI18n.setLocale(prev);
    }
  }
  return runtimeAdapterI18n.t(key, params);
}
