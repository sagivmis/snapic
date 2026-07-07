import { useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { PageMeta } from "../components/PageMeta";
import { PhotographerFaq } from "../components/marketing/PhotographerFaq";
import { StickyMobileCta } from "../components/marketing/StickyMobileCta";
import { useStudioMembership } from "../hooks/useStudioMembership";
import { useTranslation } from "../i18n";
import { buildStudioSignupUrl } from "../lib/attribution";
import { track } from "../lib/analytics";
import "../styles/ForPhotographers.scss";
import "../styles/Marketing.scss";

const BENEFIT_KEYS = ["uploadOnce", "realTime", "branded"] as const;
const STEP_KEYS = ["create", "upload", "share"] as const;
const STEP_NUMBERS = ["01", "02", "03"] as const;
const PLAN_KEYS = ["perEvent", "annual", "unlimited"] as const;
const SOCIAL_KEYS = ["one", "two", "three"] as const;
const FEATURED_PLAN = "annual";

export function ForPhotographersPage() {
  const { tPath } = useTranslation("forPhotographers");
  const { hasStudios, loaded } = useStudioMembership();
  const signupUrl = buildStudioSignupUrl();

  useEffect(() => {
    track("for_photographers_page_viewed");
  }, []);

  if (loaded && hasStudios) {
    return <Navigate to="/studio/select" replace />;
  }

  return (
    <div className="photographers-page">
      <PageMeta
        title={tPath("metaTitle")}
        description={tPath("metaDescription")}
        path="/for-photographers"
      />

      <header className="photographers-hero">
        <div className="photographers-hero__content">
          <p className="photographers-hero__eyebrow">{tPath("eyebrow")}</p>
          <h1>{tPath("title")}</h1>
          <p className="photographers-hero__lead">{tPath("lead")}</p>
          <div className="photographers-hero__actions">
            <Link
              to={signupUrl}
              className="btn btn-primary"
              onClick={() => track("for_photographers_cta_clicked", { placement: "hero" })}
            >
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

      <section className="photographers-social">
        <div className="photographers-section-head">
          <p className="photographers-section-head__eyebrow">{tPath("socialEyebrow")}</p>
          <h2>{tPath("socialTitle")}</h2>
          <p className="photographers-section-head__lead">{tPath("socialLead")}</p>
        </div>
        <div className="photographers-social__grid">
          {SOCIAL_KEYS.map((key) => (
            <figure key={key} className="photographers-social__card card-wedding">
              <blockquote>{tPath(`social.${key}.quote`)}</blockquote>
              <figcaption>
                {tPath(`social.${key}.name`)}
                <cite>{tPath(`social.${key}.role`)}</cite>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

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
            const planUrl = buildStudioSignupUrl({ plan: key });
            return (
              <li
                key={key}
                className={`photographers-pricing__card card-wedding${featured ? " photographers-pricing__card--featured" : ""}`}
              >
                {featured && <span className="photographers-pricing__badge">{tPath("mostPopular")}</span>}
                <h3>{tPath(`plans.${key}.name`)}</h3>
                <p className="photographers-pricing__price">{tPath(`plans.${key}.price`)}</p>
                <p className="photographers-pricing__detail">{tPath(`plans.${key}.detail`)}</p>
                <Link
                  to={planUrl}
                  className="btn btn-secondary photographers-pricing__cta"
                  onClick={() => track("for_photographers_plan_clicked", { plan: key })}
                >
                  {tPath("planCta")}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <PhotographerFaq />

      <section className="photographers-cta card-wedding">
        <div>
          <h2>{tPath("ctaTitle")}</h2>
          <p>{tPath("ctaLead")}</p>
        </div>
        <Link
          to={signupUrl}
          className="btn btn-primary"
          onClick={() => track("for_photographers_cta_clicked", { placement: "footer" })}
        >
          {tPath("startStudio")}
        </Link>
      </section>

      <div className="landing__sticky-spacer" aria-hidden="true" />
      <StickyMobileCta
        label={tPath("stickyCta")}
        href={signupUrl}
        onClick={() => track("for_photographers_cta_clicked", { placement: "sticky_mobile" })}
      />
    </div>
  );
}
