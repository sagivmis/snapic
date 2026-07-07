import { useId } from "react";
import { useTranslation } from "../../i18n";

const FAQ_KEYS = ["pricing", "privacy", "setup", "branding"] as const;

export function PhotographerFaq() {
  const { tPath } = useTranslation("forPhotographers");
  const baseId = useId();

  return (
    <section className="photographers-faq" aria-labelledby={`${baseId}-title`}>
      <div className="photographers-section-head">
        <p className="photographers-section-head__eyebrow">{tPath("faqEyebrow")}</p>
        <h2 id={`${baseId}-title`}>{tPath("faqTitle")}</h2>
      </div>
      <div className="photographers-faq__list">
        {FAQ_KEYS.map((key) => (
          <details key={key} className="photographers-faq__item card-wedding">
            <summary>{tPath(`faq.${key}.question`)}</summary>
            <p>{tPath(`faq.${key}.answer`)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
