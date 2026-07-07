import { Link } from "react-router-dom";
import { useTranslation } from "../../i18n";
import { SiteFooter } from "../../components/layout/SiteFooter";
import "../../styles/LegalPages.scss";

export function ContactPage() {
  const { tPath } = useTranslation("legal.contact");
  const { tPath: tLegal } = useTranslation("legal");

  return (
    <div className="legal-page">
      <article className="legal-page__content card-wedding">
        <p className="legal-page__eyebrow">{tLegal("eyebrow")}</p>
        <h1>{tPath("title")}</h1>
        <p className="legal-page__lead">{tPath("lead")}</p>

        <section className="legal-page__section">
          <h2>{tPath("generalHeading")}</h2>
          <p>{tPath("generalBody")}</p>
          <p>
            <a href={`mailto:${tPath("generalEmail")}`}>{tPath("generalEmail")}</a>
          </p>
        </section>

        <section className="legal-page__section">
          <h2>{tPath("privacyHeading")}</h2>
          <p>{tPath("privacyBody")}</p>
          <p>
            <a href={`mailto:${tPath("privacyEmail")}`}>{tPath("privacyEmail")}</a>
          </p>
        </section>

        <section className="legal-page__section">
          <h2>{tPath("weddingDayHeading")}</h2>
          <p>{tPath("weddingDayBody")}</p>
        </section>

        <p className="legal-page__contact">
          {tPath("legalPrefix")}{" "}
          <Link to="/privacy">{tLegal("footer.privacy")}</Link>
          {" · "}
          <Link to="/terms">{tLegal("footer.terms")}</Link>
        </p>
      </article>
      <SiteFooter variant="page" />
    </div>
  );
}
