import { useMemo } from "react";
import { createTranslator, type TranslationParams, type Translator } from "./translate";

export function useTranslation(basePath?: string): Translator {
  return useMemo(() => createTranslator(basePath), [basePath]);
}

export type { TranslationParams, Translator };
