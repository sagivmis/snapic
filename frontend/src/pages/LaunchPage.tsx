import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageMeta } from "../components/PageMeta";
import { useTranslation } from "../i18n";
import { buildStudioSignupUrl } from "../lib/attribution";
import { track } from "../lib/analytics";
import {
  LAUNCH_DISCOUNT_PERCENT,
  LAUNCH_PROMO_CODE,
  launchCountdownParts,
  launchOfferActive,
} from "../lib/marketing";
import "../styles/Launch.scss";

export function LaunchPage() {
  const { tPath } = useTranslation("launch");
  const [countdown, setCountdown] = useState(() => launchCountdownParts());
  const active = launchOfferActive();
  const signupUrl = buildStudioSignupUrl({ promo: LAUNCH_PROMO_CODE });

  useEffect(() => {
    track("launch_page_viewed", { active, promo: LAUNCH_PROMO_CODE });
  }, [active]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown(launchCountdownParts());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="launch-page">
      <PageMeta
        title={tPath("metaTitle")}
        description={tPath("metaDescription")}
        path="/launch"
      />

      <header className="launch-hero card-wedding">
        <p className="launch-hero__eyebrow">{tPath("eyebrow")}</p>
        <h1>{tPath("title")}</h1>
        <p className="launch-hero__lead">{tPath("lead")}</p>

        {active && !countdown.expired ? (
          <div className="launch-hero__offer" aria-live="polite">
            <span className="launch-hero__discount">
              {tPath("discountBadge", { percent: LAUNCH_DISCOUNT_PERCENT })}
            </span>
            <p className="launch-hero__countdown">
              {tPath("countdown", {
                days: countdown.days,
                hours: countdown.hours,
                minutes: countdown.minutes,
              })}
            </p>
            <p className="launch-hero__code">
              {tPath("promoLabel")}: <strong>{LAUNCH_PROMO_CODE}</strong>
            </p>
          </div>
        ) : (
          <p className="launch-hero__expired">{tPath("expired")}</p>
        )}

        <div className="launch-hero__actions">
          <Link
            to={signupUrl}
            className="btn btn-primary"
            onClick={() => track("launch_cta_clicked", { promo: LAUNCH_PROMO_CODE, active })}
          >
            {active ? tPath("ctaActive") : tPath("ctaExpired")}
          </Link>
          <Link to="/for-photographers" className="btn btn-secondary">
            {tPath("seeFeatures")}
          </Link>
        </div>
      </header>

      <section className="launch-features">
        <h2>{tPath("featuresTitle")}</h2>
        <ul>
          {(["guests", "studio", "season"] as const).map((key) => (
            <li key={key} className="card-wedding">
              <h3>{tPath(`features.${key}.title`)}</h3>
              <p>{tPath(`features.${key}.description`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="launch-footnote">{tPath("footnote")}</p>
    </div>
  );
}
