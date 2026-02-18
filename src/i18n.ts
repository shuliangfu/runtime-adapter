/**
 * @module @dreamer/runtime-adapter/i18n
 *
 * i18n for @dreamer/runtime-adapter: error messages (unsupported runtime,
 * file/process/network errors) and debug labels. Reads LANGUAGE/LC_ALL/LANG
 * directly here to avoid circular dependency (env.ts would otherwise depend on i18n).
 * When lang is not passed, locale is auto-detected from env.
 *
 * 本包统一使用 $t 进行翻译，不提供 tr 方法；所有面向用户或日志的文案均通过
 * locales (en-US.json / zh-CN.json) 配置，禁止在代码中硬编码中英文。
 */

import {
  $i18n,
  getGlobalI18n,
  getI18n,
  type TranslationData,
  type TranslationParams,
} from "@dreamer/i18n";
import enUS from "./locales/en-US.json" with { type: "json" };
import zhCN from "./locales/zh-CN.json" with { type: "json" };

// 不导入 detect.ts，避免循环依赖，使 detect 可安全 import 本模块并用 $t 翻译

/** Supported locale. */
export type Locale = "en-US" | "zh-CN";

/** Default locale when detection fails. */
export const DEFAULT_LOCALE: Locale = "en-US";

const RUNTIME_ADAPTER_LOCALES: Locale[] = ["en-US", "zh-CN"];

let runtimeAdapterTranslationsLoaded = false;

/**
 * 从当前运行时读取环境变量（仅用于 locale 检测）。
 * 内联判断 Deno/Bun，不依赖 detect.ts，避免 i18n → detect 依赖，使 detect 可 import 本模块并用 $t 翻译。
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
 * Falls back to DEFAULT_LOCALE when unset or not in supported list.
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

/**
 * Load runtime-adapter translations into the current I18n instance (once).
 */
export function ensureRuntimeAdapterI18n(): void {
  if (runtimeAdapterTranslationsLoaded) return;
  const i18n = getGlobalI18n() ?? getI18n();
  i18n.loadTranslations("en-US", enUS as TranslationData);
  i18n.loadTranslations("zh-CN", zhCN as TranslationData);
  runtimeAdapterTranslationsLoaded = true;
}

/**
 * Load translations and set current locale. Call once at entry (e.g. mod).
 */
export function initRuntimeAdapterI18n(): void {
  ensureRuntimeAdapterI18n();
  $i18n.setLocale(detectLocale());
}

/**
 * 按 key 翻译，统一入口，无 tr 别名。lang 不传时使用入口处设置的当前 locale。
 * 勿在 $t 内部调用 ensure/init；在入口调用 initRuntimeAdapterI18n()。
 */
export function $t(
  key: string,
  params?: TranslationParams,
  lang?: Locale,
): string {
  if (lang !== undefined) {
    const prev = $i18n.getLocale();
    $i18n.setLocale(lang);
    try {
      return $i18n.t(key, params);
    } finally {
      $i18n.setLocale(prev);
    }
  }
  return $i18n.t(key, params);
}
