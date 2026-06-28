import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "../../i18n";
import type { MobileTab, MobileSheetSection } from "../../hooks/useMobileNav";
import type { UserEventSummary } from "../../types";
import { eventManagePath } from "../../hooks/useUserEvents";
import { MobileMoreSheet } from "./MobileMoreSheet";
import {
  NavIconDemo,
  NavIconGallery,
  NavIconHome,
  NavIconMore,
  NavIconPhotographer,
  NavIconRequest,
  NavIconStudio,
} from "./MobileNavIcons";
import "../../styles/MobileNav.scss";

interface MobileTabBarProps {
  tabs: MobileTab[];
  isTabActive: (tab: MobileTab) => boolean;
  sheetSections: MobileSheetSection[];
  events: UserEventSummary[];
}

function TabIcon({ id, className }: { id: MobileTab["id"]; className?: string }) {
  switch (id) {
    case "home":
      return <NavIconHome className={className} />;
    case "studio":
      return <NavIconStudio className={className} />;
    case "gallery":
      return <NavIconGallery className={className} />;
    case "demo":
      return <NavIconDemo className={className} />;
    case "request":
      return <NavIconRequest className={className} />;
    case "photographers":
      return <NavIconPhotographer className={className} />;
    case "more":
      return <NavIconMore className={className} />;
  }
}

export function MobileTabBar({ tabs, isTabActive, sheetSections, events }: MobileTabBarProps) {
  const { tPath } = useTranslation("nav.mobile");
  const [moreOpen, setMoreOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <nav className="mobile-tab-bar" aria-label={tPath("barAria")}>
        {tabs.map((tab) => {
          const active = isTabActive(tab);
          const className = `mobile-tab-bar__item${active ? " mobile-tab-bar__item--active" : ""}`;

          if (tab.opensMore) {
            return (
              <button
                key={tab.id}
                type="button"
                className={className}
                aria-current={moreOpen ? "page" : undefined}
                onClick={() => setMoreOpen(true)}
              >
                <TabIcon id={tab.id} className="mobile-tab-bar__icon" />
                <span className="mobile-tab-bar__label">{tPath(tab.labelKey)}</span>
              </button>
            );
          }

          if (tab.opensPicker) {
            return (
              <button
                key={tab.id}
                type="button"
                className={className}
                aria-current={active ? "page" : undefined}
                onClick={() => setPickerOpen(true)}
              >
                <TabIcon id={tab.id} className="mobile-tab-bar__icon" />
                <span className="mobile-tab-bar__label">{tPath(tab.labelKey)}</span>
              </button>
            );
          }

          return (
            <Link key={tab.id} to={tab.to ?? "/"} className={className} aria-current={active ? "page" : undefined}>
              <TabIcon id={tab.id} className="mobile-tab-bar__icon" />
              <span className="mobile-tab-bar__label">{tPath(tab.labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} sections={sheetSections} />

      {pickerOpen && (
        <div className="mobile-sheet" role="presentation">
          <button
            type="button"
            className="mobile-sheet__backdrop"
            aria-label={tPath("closeSheet")}
            onClick={() => setPickerOpen(false)}
          />
          <div className="mobile-sheet__panel mobile-sheet__panel--compact" role="dialog" aria-modal="true" aria-label={tPath("pickGallery")}>
            <div className="mobile-sheet__handle" aria-hidden="true" />
            <header className="mobile-sheet__header">
              <h2>{tPath("pickGallery")}</h2>
              <button type="button" className="mobile-sheet__close" onClick={() => setPickerOpen(false)}>
                {tPath("closeSheet")}
              </button>
            </header>
            <ul className="mobile-sheet__event-list">
              {events.map((event) => (
                <li key={event.id}>
                  <Link
                    to={eventManagePath(event)}
                    className="mobile-sheet__link"
                    onClick={() => setPickerOpen(false)}
                  >
                    {event.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
