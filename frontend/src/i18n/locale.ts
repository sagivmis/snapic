import en from "./locales/en.json";
import he from "./locales/he.json";
import type { TranslationNode } from "./translate";

export type LocaleId = "en" | "he";

export interface LocaleConfig {
  id: LocaleId;
  label: string;
  dir: "ltr" | "rtl";
  catalog: TranslationNode;
}

export const LOCALES: Record<LocaleId, LocaleConfig> = {
  en: {
    id: "en",
    label: "English",
    dir: "ltr",
    catalog: en as unknown as TranslationNode,
  },
  he: {
    id: "he",
    label: "עברית",
    dir: "rtl",
    catalog: he as unknown as TranslationNode,
  },
};

export const LOCALE_STORAGE_KEY = "snapic_locale";
export const DEFAULT_LOCALE: LocaleId = "en";

export function isLocaleId(value: string): value is LocaleId {
  return value === "en" || value === "he";
}

export function readStoredLocale(): LocaleId {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && isLocaleId(stored)) {
      return stored;
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_LOCALE;
}

export function writeStoredLocale(locale: LocaleId): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore storage errors
  }
}

export function applyDocumentLocale(locale: LocaleId): void {
  const config = LOCALES[locale];
  document.documentElement.lang = locale;
  document.documentElement.dir = config.dir;
}
