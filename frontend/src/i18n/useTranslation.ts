import { useMemo } from "react";
import { useLocale } from "./LocaleProvider";
import { createTranslator, type TranslationParams, type Translator } from "./translate";

export function useTranslation(basePath?: string): Translator {
  const { locale } = useLocale();
  return useMemo(() => createTranslator(basePath, locale), [basePath, locale]);
}

export type { TranslationParams, Translator };
