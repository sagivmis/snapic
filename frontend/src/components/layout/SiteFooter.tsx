import { Link } from "react-router-dom";
import { useTranslation } from "../../i18n";
import "../../styles/SiteFooter.scss";

interface SiteFooterProps {
  variant?: "inline" | "page";
}

const LEGAL_LINKS = [
  { to: "/privacy", key: "privacy" },
  { to: "/terms", key: "terms" },
  { to: "/cookies", key: "cookies" },
  { to: "/accessibility", key: "accessibility" },
  { to: "/contact", key: "contact" },
] as const;

export function SiteFooter({ variant = "inline" }: SiteFooterProps) {
  const { tPath } = useTranslation("legal.footer");

  return (
    <footer className={`site-footer site-footer--${variant}`}>
      <nav className="site-footer__links" aria-label={tPath("aria")}>
        {LEGAL_LINKS.map((link) => (
          <Link key={link.to} to={link.to}>
            {tPath(link.key)}
          </Link>
        ))}
      </nav>
      <p className="site-footer__copy">{tPath("copyright")}</p>
    </footer>
  );
}
