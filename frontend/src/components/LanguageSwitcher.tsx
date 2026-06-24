import { LOCALES, useLocale, useTranslation, type LocaleId } from "../i18n";
import "../styles/LanguageSwitcher.scss";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  const { tPath } = useTranslation("common.language");

  return (
    <div className="language-switcher" role="group" aria-label={tPath("aria")}>
      {(Object.keys(LOCALES) as LocaleId[]).map((id) => (
        <button
          key={id}
          type="button"
          className={`language-switcher__btn${locale === id ? " language-switcher__btn--active" : ""}`}
          onClick={() => setLocale(id)}
          aria-pressed={locale === id}
        >
          {LOCALES[id].label}
        </button>
      ))}
    </div>
  );
}
