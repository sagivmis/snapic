import { Link } from "react-router-dom";
import { useTranslation } from "../../i18n";
import { SiteFooter } from "../layout/SiteFooter";
import "../../styles/LegalPages.scss";

interface LegalSection {
  heading: string;
  body: string;
}

interface LegalDocumentPageProps {
  pageKey: "privacy" | "terms" | "cookies" | "accessibility";
  sectionCount: number;
}

export function LegalDocumentPage({ pageKey, sectionCount }: LegalDocumentPageProps) {
  const { tPath } = useTranslation(`legal.${pageKey}`);
  const { tPath: tLegal } = useTranslation("legal");

  const sections: LegalSection[] = Array.from({ length: sectionCount }, (_, index) => ({
    heading: tPath(`sections.${index}.heading`),
    body: tPath(`sections.${index}.body`),
  }));

  return (
    <div className="legal-page">
      <article className="legal-page__content card-wedding">
        <p className="legal-page__eyebrow">{tLegal("eyebrow")}</p>
        <h1>{tPath("title")}</h1>
        <p className="legal-page__updated">{tPath("lastUpdated")}</p>
        <p className="legal-page__draft-notice">{tLegal("draftNotice")}</p>

        {sections.map((section) => (
          <section key={section.heading} className="legal-page__section">
            <h2>{section.heading}</h2>
            {section.body.split("\n\n").map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </section>
        ))}

        <p className="legal-page__contact">
          {tLegal("questionsPrefix")}{" "}
          <Link to="/contact">{tLegal("contactLink")}</Link>
        </p>
      </article>
      <SiteFooter variant="page" />
    </div>
  );
}
