import type { ReactNode } from "react";
import { useSidebarSection } from "../../hooks/useSidebarSection";
import type { SidebarSectionConfig } from "../../lib/appSidebarSections";

interface AppSidebarSectionProps {
  config: SidebarSectionConfig;
  ariaLabel?: string;
  hasActiveChild?: boolean;
  badge?: number;
  headerExtra?: ReactNode;
  children: ReactNode;
}

export function AppSidebarSection({
  config,
  ariaLabel,
  hasActiveChild = false,
  badge,
  headerExtra,
  children,
}: AppSidebarSectionProps) {
  const { expanded, toggle } = useSidebarSection({
    sectionId: config.id,
    defaultExpanded: config.defaultExpanded,
    hasActiveChild,
  });

  const panelId = `sidebar-section-${config.id}`;

  return (
    <section
      className={`app-sidebar-section${expanded ? " app-sidebar-section--expanded" : ""}${config.scrollable ? " app-sidebar-section--scrollable" : ""}`}
    >
      <button
        type="button"
        className="app-sidebar-section__toggle"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={toggle}
      >
        <span className="app-sidebar-section__chevron" aria-hidden="true" />
        <span className="app-sidebar-section__title">{config.title}</span>
        {badge !== undefined && badge > 0 && (
          <span className="app-sidebar-section__badge">{badge}</span>
        )}
      </button>
      <div id={panelId} className="app-sidebar-section__body" hidden={!expanded}>
        {headerExtra}
        <nav className="app-layout__nav" aria-label={ariaLabel ?? config.title}>
          {children}
        </nav>
      </div>
    </section>
  );
}
