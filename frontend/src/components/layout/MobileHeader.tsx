import { Link } from "react-router-dom";
import { useTranslation } from "../../i18n";
import "../../styles/MobileNav.scss";

export function MobileHeader() {
  const { t } = useTranslation("common");

  return (
    <header className="mobile-header">
      <Link to="/" className="mobile-header__brand">
        {t("brand")}
      </Link>
    </header>
  );
}
