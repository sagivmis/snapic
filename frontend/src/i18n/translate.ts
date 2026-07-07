import { DEFAULT_LOCALE, LOCALES, readStoredLocale, type LocaleId } from "./locale";
import en from "./locales/en.json";

export type TranslationParams = Record<string, string | number>;
export type TranslationNode = { [key: string]: TranslationNode | string | TranslationNode[] };

let activeLocale: LocaleId = readStoredLocale();

export function getActiveLocale(): LocaleId {
  return activeLocale;
}

export function setActiveLocale(locale: LocaleId): void {
  activeLocale = locale;
}

function isDev(): boolean {
  return import.meta.env.DEV;
}

function warnMissing(key: string, mode: "path" | "global", locale: LocaleId): void {
  if (isDev()) {
    console.warn(`[i18n] Missing ${mode} translation (${locale}): ${key}`);
  }
}

function getCatalog(locale: LocaleId): TranslationNode {
  return LOCALES[locale].catalog;
}

function getFallbackCatalog(): TranslationNode {
  return LOCALES[DEFAULT_LOCALE].catalog;
}

export function interpolate(template: string, params?: TranslationParams): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    const value = params[name];
    return value === undefined ? `{{${name}}}` : String(value);
  });
}

function leafKey(key: string): string {
  const parts = key.split(".").filter(Boolean);
  return parts[parts.length - 1] ?? key;
}

export function resolvePath(
  path: string,
  root: TranslationNode = getCatalog(activeLocale),
  fallback: TranslationNode = getFallbackCatalog(),
): string | undefined {
  const segments = path.split(".").filter(Boolean);
  if (segments.length === 0) {
    return undefined;
  }

  function walk(node: TranslationNode | string | TranslationNode[]): string | undefined {
    let current: TranslationNode | string | TranslationNode[] = node;
    for (const segment of segments) {
      if (typeof current === "string") {
        return undefined;
      }
      if (Array.isArray(current)) {
        const index = Number(segment);
        if (!Number.isInteger(index) || index < 0 || index >= current.length) {
          return undefined;
        }
        current = current[index];
        continue;
      }
      if (current === null || !(segment in current)) {
        return undefined;
      }
      current = current[segment];
    }
    return typeof current === "string" ? current : undefined;
  }

  return walk(root) ?? walk(fallback);
}

export function resolveGlobal(
  key: string,
  root: TranslationNode = getCatalog(activeLocale),
  fallback: TranslationNode = getFallbackCatalog(),
): string | undefined {
  const target = leafKey(key);

  function search(node: TranslationNode | string | TranslationNode[]): string | undefined {
    if (typeof node === "string" || Array.isArray(node)) {
      return undefined;
    }
    for (const [name, value] of Object.entries(node)) {
      if (name === target) {
        if (typeof value === "string") {
          return value;
        }
        continue;
      }
      if (typeof value === "object" && value !== null) {
        const found = search(value);
        if (found !== undefined) {
          return found;
        }
      }
    }
    return undefined;
  }

  return search(root) ?? search(fallback);
}

function joinPath(basePath: string | undefined, key: string): string {
  const trimmedKey = key.trim();
  if (!basePath?.trim()) {
    return trimmedKey;
  }
  if (!trimmedKey) {
    return basePath.trim();
  }
  return `${basePath.trim()}.${trimmedKey}`;
}

export interface Translator {
  t: (key: string, params?: TranslationParams) => string;
  tPath: (key: string, params?: TranslationParams) => string;
}

export function createTranslator(basePath?: string, fixedLocale?: LocaleId): Translator {
  function resolveLocale(): LocaleId {
    return fixedLocale ?? activeLocale;
  }

  function t(key: string, params?: TranslationParams): string {
    const locale = resolveLocale();
    const root = getCatalog(locale);
    const fallback = locale === DEFAULT_LOCALE ? (en as unknown as TranslationNode) : getFallbackCatalog();
    const resolved = resolveGlobal(key, root, fallback);
    if (resolved === undefined) {
      warnMissing(key, "global", locale);
      return key;
    }
    return interpolate(resolved, params);
  }

  function tPath(key: string, params?: TranslationParams): string {
    const locale = resolveLocale();
    const root = getCatalog(locale);
    const fallback = locale === DEFAULT_LOCALE ? (en as unknown as TranslationNode) : getFallbackCatalog();
    const fullPath = joinPath(basePath, key);
    const resolved = resolvePath(fullPath, root, fallback);
    if (resolved === undefined) {
      warnMissing(fullPath, "path", locale);
      return key;
    }
    return interpolate(resolved, params);
  }

  return { t, tPath };
}
