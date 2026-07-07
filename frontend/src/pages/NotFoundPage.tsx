import { Link } from "react-router-dom";
import { useTranslation } from "../i18n";
import { SiteFooter } from "../components/layout/SiteFooter";
import "../styles/LegalPages.scss";

export function NotFoundPage() {
  const { tPath } = useTranslation("notFound");

  return (
    <div className="legal-page">
      <article className="legal-page__content card-wedding legal-page__content--centered">
        <p className="legal-page__eyebrow">{tPath("eyebrow")}</p>
        <h1>{tPath("title")}</h1>
        <p className="legal-page__lead">{tPath("lead")}</p>
        <Link to="/" className="btn btn-primary">
          {tPath("backHome")}
        </Link>
      </article>
      <SiteFooter variant="page" />
    </div>
  );
}
