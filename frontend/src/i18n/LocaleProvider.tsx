import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { setActiveLocale } from "./translate";
import {
  applyDocumentLocale,
  LOCALES,
  readStoredLocale,
  writeStoredLocale,
  type LocaleId,
} from "./locale";

interface LocaleContextValue {
  locale: LocaleId;
  setLocale: (locale: LocaleId) => void;
  dir: "ltr" | "rtl";
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function initLocale(): LocaleId {
  const locale = readStoredLocale();
  applyDocumentLocale(locale);
  return locale;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleId>(initLocale);

  const setLocale = useCallback((next: LocaleId) => {
    writeStoredLocale(next);
    setActiveLocale(next);
    applyDocumentLocale(next);
    setLocaleState(next);
  }, []);

  const value = useMemo(
    (): LocaleContextValue => ({
      locale,
      setLocale,
      dir: LOCALES[locale].dir,
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return context;
}

export { LOCALE_STORAGE_KEY, LOCALES, DEFAULT_LOCALE } from "./locale";
