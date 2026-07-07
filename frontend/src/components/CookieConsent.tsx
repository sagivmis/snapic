import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "../i18n";
import { readCookieConsent, writeCookieConsent } from "../lib/cookieConsent";
import "../styles/CookieConsent.scss";

export function CookieConsent() {
  const { tPath } = useTranslation("legal.cookieBanner");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(readCookieConsent() === null);
  }, []);

  if (!visible) {
    return null;
  }

  function accept() {
    writeCookieConsent("accepted");
    setVisible(false);
  }

  function decline() {
    writeCookieConsent("declined");
    setVisible(false);
  }

  return (
    <div className="cookie-consent" role="dialog" aria-label={tPath("aria")}>
      <div className="cookie-consent__panel">
        <p className="cookie-consent__text">
          {tPath("message")}{" "}
          <Link to="/cookies" onClick={() => setVisible(false)}>
            {tPath("learnMore")}
          </Link>
        </p>
        <div className="cookie-consent__actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={decline}>
            {tPath("decline")}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={accept}>
            {tPath("accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
