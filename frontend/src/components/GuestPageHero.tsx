import type { ReactNode } from "react";
import type { DecorationTheme } from "../utils/guestBranding";
import "../styles/GuestPageHero.scss";

interface GuestPageHeroProps {
  displayName: string;
  weddingDate?: string | null;
  welcomeMessage?: string | null;
  headline?: string;
  description?: string;
  compact?: boolean;
  decorationTheme?: DecorationTheme;
  studioBrand?: ReactNode;
}

function formatWeddingDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function GuestPageHero({
  displayName,
  weddingDate,
  welcomeMessage,
  headline,
  description,
  compact = false,
  decorationTheme = "classic",
  studioBrand,
}: GuestPageHeroProps) {
  const themeClass =
    decorationTheme !== "none" ? `guest-page-hero--decoration-${decorationTheme}` : "";

  return (
    <header
      className={`guest-page-hero${compact ? " guest-page-hero--compact" : ""}${themeClass ? ` ${themeClass}` : ""}`}
    >
      {decorationTheme !== "none" && (
        <div className="guest-page-hero__frame" aria-hidden="true">
          <span className="guest-page-hero__corner guest-page-hero__corner--tl" />
          <span className="guest-page-hero__corner guest-page-hero__corner--tr" />
          <span className="guest-page-hero__corner guest-page-hero__corner--bl" />
          <span className="guest-page-hero__corner guest-page-hero__corner--br" />
        </div>
      )}

      <div className="guest-page-hero__content">
        {studioBrand}

        <div className="guest-page-hero__names-wrap">
          <h1 className="guest-page-hero__names">{displayName}</h1>
          {weddingDate && (
            <p className="guest-page-hero__date">{formatWeddingDate(weddingDate)}</p>
          )}
        </div>

        {!compact && welcomeMessage && (
          <p className="guest-page-hero__welcome">{welcomeMessage}</p>
        )}

        {headline && <h2 className="guest-page-hero__headline">{headline}</h2>}
        {description && <p className="guest-page-hero__desc">{description}</p>}
      </div>
    </header>
  );
}
