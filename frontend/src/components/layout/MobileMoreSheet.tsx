import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { SiteFooter } from "../layout/SiteFooter";
import { useTranslation } from "../../i18n";
import type { MobileSheetSection } from "../../hooks/useMobileNav";
import "../../styles/MobileNav.scss";

interface MobileMoreSheetProps {
  open: boolean;
  onClose: () => void;
  sections: MobileSheetSection[];
}

export function MobileMoreSheet({ open, onClose, sections }: MobileMoreSheetProps) {
  const navigate = useNavigate();
  const { session, profile, signOut } = useAuth();
  const { tPath } = useTranslation("nav");
  const { t: tCommon } = useTranslation("common");
  const { tPath: tStudioNav } = useTranslation("studio.nav");
  const { tPath: tMobile } = useTranslation("nav.mobile");

  useEffect(() => {
    if (!open) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  function resolveLabel(link: MobileSheetSection["links"][number]): string {
    if (link.label) {
      return link.label;
    }
    if (!link.labelKey) {
      return "";
    }
    if (link.namespace === "studio.nav") {
      return tStudioNav(link.labelKey);
    }
    if (link.labelKey === "pendingInvites" && link.badge != null) {
      return tPath("pendingInvites", { count: link.badge });
    }
    return tPath(link.labelKey);
  }

  function handleNavigate(to: string) {
    onClose();
    navigate(to);
  }

  return (
    <div className="mobile-sheet" role="presentation">
      <button type="button" className="mobile-sheet__backdrop" aria-label={tMobile("closeSheet")} onClick={onClose} />
      <div className="mobile-sheet__panel" role="dialog" aria-modal="true" aria-label={tMobile("moreTitle")}>
        <div className="mobile-sheet__handle" aria-hidden="true" />
        <header className="mobile-sheet__header">
          <h2>{tMobile("moreTitle")}</h2>
          <button type="button" className="mobile-sheet__close" onClick={onClose}>
            {tCommon("close")}
          </button>
        </header>

        <div className="mobile-sheet__body">
          {sections.map((section, index) => (
            <section key={section.titleKey ?? `section-${index}`} className="mobile-sheet__section">
              {section.titleKey && <h3>{tPath(section.titleKey)}</h3>}
              <ul>
                {section.links.map((link) => (
                  <li key={`${link.to}-${link.labelKey ?? link.label}`}>
                    <button type="button" className="mobile-sheet__link" onClick={() => handleNavigate(link.to)}>
                      {resolveLabel(link)}
                      {link.badge != null && link.labelKey !== "pendingInvites" && (
                        <span className="mobile-sheet__badge">{link.badge}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="mobile-sheet__section mobile-sheet__section--footer">
            <LanguageSwitcher />
            {session ? (
              <>
                <p className="mobile-sheet__email">{profile?.email ?? session.user.email}</p>
                <button type="button" className="btn btn-ghost mobile-sheet__sign-out" onClick={() => void signOut()}>
                  {tCommon("signOut")}
                </button>
              </>
            ) : (
              <Link to="/login" className="mobile-sheet__sign-in" onClick={onClose}>
                {tCommon("signIn")}
              </Link>
            )}
            <SiteFooter variant="inline" />
          </section>
        </div>
      </div>
    </div>
  );
}
