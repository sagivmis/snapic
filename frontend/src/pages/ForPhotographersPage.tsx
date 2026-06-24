import { Link, Navigate } from "react-router-dom";
import { useStudioMembership } from "../hooks/useStudioMembership";
import { useTranslation } from "../i18n";
import "../styles/ForPhotographers.scss";

const BENEFIT_KEYS = ["uploadOnce", "realTime", "branded"] as const;
const STEP_KEYS = ["create", "upload", "share"] as const;
const STEP_NUMBERS = ["01", "02", "03"] as const;
const PLAN_KEYS = ["perEvent", "annual", "unlimited"] as const;
const FEATURED_PLAN = "annual";

export function ForPhotographersPage() {
  const { tPath } = useTranslation("forPhotographers");
  const { hasStudios, loaded } = useStudioMembership();

  if (loaded && hasStudios) {
    return <Navigate to="/studio/select" replace />;
  }

  return (
    <div className="photographers-page">
      <header className="photographers-hero">
        <div className="photographers-hero__content">
          <p className="photographers-hero__eyebrow">{tPath("eyebrow")}</p>
          <h1>{tPath("title")}</h1>
          <p className="photographers-hero__lead">{tPath("lead")}</p>
          <div className="photographers-hero__actions">
            <Link to="/studio/signup" className="btn btn-primary">
              {tPath("startStudio")}
            </Link>
            <Link to="/demo" className="btn btn-secondary">
              {tPath("tryGuestDemo")}
            </Link>
          </div>
          <ul className="photographers-hero__highlights" aria-label={tPath("benefitsAria")}>
            {BENEFIT_KEYS.map((key) => (
              <li key={key}>{tPath(`benefits.${key}.title`)}</li>
            ))}
          </ul>
        </div>

        <div className="photographers-hero__visual" aria-hidden="true">
          <div className="photographers-mock">
            <div className="photographers-mock__chrome">
              <span className="photographers-mock__dot" />
              <span className="photographers-mock__dot" />
              <span className="photographers-mock__dot" />
              <span className="photographers-mock__title">{tPath("mockTitle")}</span>
            </div>
            <div className="photographers-mock__body">
              <div className="photographers-mock__sidebar">
                <span className="photographers-mock__nav-item photographers-mock__nav-item--active" />
                <span className="photographers-mock__nav-item" />
                <span className="photographers-mock__nav-item" />
              </div>
              <div className="photographers-mock__main">
                <div className="photographers-mock__search">
                  <span className="photographers-mock__avatar" />
                  <div className="photographers-mock__search-copy">
                    <strong>{tPath("mockFinding")}</strong>
                    <span>{tPath("mockProgress")}</span>
                  </div>
                </div>
                <div className="photographers-mock__grid">
                  <span className="photographers-mock__photo photographers-mock__photo--match" />
                  <span className="photographers-mock__photo" />
                  <span className="photographers-mock__photo photographers-mock__photo--match" />
                  <span className="photographers-mock__photo" />
                  <span className="photographers-mock__photo photographers-mock__photo--match" />
                  <span className="photographers-mock__photo" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="photographers-benefits">
        {BENEFIT_KEYS.map((key) => (
          <article key={key} className="photographers-benefits__card card-wedding">
            <h2>{tPath(`benefits.${key}.title`)}</h2>
            <p>{tPath(`benefits.${key}.description`)}</p>
          </article>
        ))}
      </section>

      <section className="photographers-steps">
        <div className="photographers-section-head">
          <p className="photographers-section-head__eyebrow">{tPath("stepsEyebrow")}</p>
          <h2>{tPath("stepsTitle")}</h2>
        </div>
        <ol className="photographers-steps__list">
          {STEP_KEYS.map((key, index) => (
            <li key={key} className="photographers-steps__item card-wedding">
              <span className="photographers-steps__number">{STEP_NUMBERS[index]}</span>
              <h3>{tPath(`steps.${key}.title`)}</h3>
              <p>{tPath(`steps.${key}.description`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="photographers-pricing">
        <div className="photographers-section-head">
          <p className="photographers-section-head__eyebrow">{tPath("pricingEyebrow")}</p>
          <h2>{tPath("pricingTitle")}</h2>
          <p className="photographers-section-head__lead">{tPath("pricingLead")}</p>
        </div>
        <ul className="photographers-pricing__grid">
          {PLAN_KEYS.map((key) => {
            const featured = key === FEATURED_PLAN;
            return (
              <li
                key={key}
                className={`photographers-pricing__card card-wedding${featured ? " photographers-pricing__card--featured" : ""}`}
              >
                {featured && <span className="photographers-pricing__badge">{tPath("mostPopular")}</span>}
                <h3>{tPath(`plans.${key}.name`)}</h3>
                <p className="photographers-pricing__price">{tPath(`plans.${key}.price`)}</p>
                <p className="photographers-pricing__detail">{tPath(`plans.${key}.detail`)}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="photographers-cta card-wedding">
        <div>
          <h2>{tPath("ctaTitle")}</h2>
          <p>{tPath("ctaLead")}</p>
        </div>
        <Link to="/studio/signup" className="btn btn-primary">
          {tPath("startStudio")}
        </Link>
      </section>
    </div>
  );
}
