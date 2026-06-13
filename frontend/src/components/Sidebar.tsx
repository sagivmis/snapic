import type { AppTab } from "../navigation";
import { NAV_ITEMS } from "../navigation";
import "../styles/Sidebar.scss";

interface SidebarProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  hasPortrait: boolean;
  galleryCount: number;
  matchCount: number | null;
  canMatch: boolean;
  loading: boolean;
  threshold: number;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  onThresholdChange: (value: number) => void;
  onMatch: () => void;
}

function StepIcon({ complete }: { complete: boolean }) {
  return (
    <span className={`step-icon ${complete ? "step-icon--complete" : "step-icon--pending"}`}>
      {complete ? "✓" : ""}
    </span>
  );
}

function NavButton({
  item,
  active,
  complete,
  badge,
  onClick,
}: {
  item: (typeof NAV_ITEMS)[number];
  active: boolean;
  complete: boolean;
  badge?: number | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`nav-btn ${active ? "nav-btn--active" : ""}`}
    >
      <StepIcon complete={complete} />
      <span className="nav-btn__body">
        <span className="nav-btn__title-row">
          <span className="nav-btn__title">{item.label}</span>
          {badge != null && badge > 0 && <span className="nav-btn__badge">{badge}</span>}
        </span>
        <span className="nav-btn__desc">{item.description}</span>
      </span>
    </button>
  );
}

export function Sidebar({
  activeTab,
  onTabChange,
  hasPortrait,
  galleryCount,
  matchCount,
  canMatch,
  loading,
  threshold,
  showAdvanced,
  onToggleAdvanced,
  onThresholdChange,
  onMatch,
}: SidebarProps) {
  const matchSection = (
    <div className="sidebar__match">
      <button type="button" onClick={onToggleAdvanced} className="sidebar__sensitivity-toggle">
        {showAdvanced ? "Hide" : "Show"} sensitivity
      </button>

      {showAdvanced && (
        <div>
          <label htmlFor="threshold" className="sidebar__threshold-label">
            Match sensitivity: {threshold.toFixed(2)}
          </label>
          <input
            id="threshold"
            type="range"
            min={0.3}
            max={0.7}
            step={0.01}
            value={threshold}
            onChange={(event) => onThresholdChange(Number(event.target.value))}
            className="sidebar__threshold-input"
          />
          <p className="sidebar__threshold-hint">
            Lower = more photos found, higher = stricter matching.
          </p>
        </div>
      )}

      <button
        type="button"
        disabled={!canMatch || loading}
        onClick={onMatch}
        className="btn-primary full-width"
      >
        {loading ? (
          <>
            <span className="spinner" />
            Searching...
          </>
        ) : (
          "Find my photos"
        )}
      </button>
    </div>
  );

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar__brand">
          <p className="sidebar__brand-title">Snapic</p>
          <p className="sidebar__brand-sub">Wedding memories</p>
        </div>

        <nav className="sidebar__nav">
          <NavButton
            item={NAV_ITEMS[0]}
            active={activeTab === "portrait"}
            complete={hasPortrait}
            onClick={() => onTabChange("portrait")}
          />
          <NavButton
            item={NAV_ITEMS[1]}
            active={activeTab === "gallery"}
            complete={galleryCount > 0}
            badge={galleryCount > 0 ? galleryCount : undefined}
            onClick={() => onTabChange("gallery")}
          />
          <NavButton
            item={NAV_ITEMS[2]}
            active={activeTab === "results"}
            complete={matchCount != null && matchCount > 0}
            badge={matchCount != null && matchCount > 0 ? matchCount : undefined}
            onClick={() => onTabChange("results")}
          />
        </nav>

        <div className="sidebar__footer">{matchSection}</div>
      </aside>

      <div className="mobile-bar">
        <div className="mobile-bar__tabs">
          {NAV_ITEMS.map((item) => {
            const complete =
              item.id === "portrait"
                ? hasPortrait
                : item.id === "gallery"
                  ? galleryCount > 0
                  : matchCount != null && matchCount > 0;
            const badge =
              item.id === "gallery" && galleryCount > 0
                ? galleryCount
                : item.id === "results" && matchCount != null && matchCount > 0
                  ? matchCount
                  : null;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`mobile-tab ${activeTab === item.id ? "mobile-tab--active" : ""}`}
              >
                <span className="mobile-tab__label">
                  {item.step}. {item.label.split(" ")[0]}
                </span>
                {badge != null && <span className="mobile-tab__meta">{badge}</span>}
                {complete && badge == null && (
                  <span className="mobile-tab__meta mobile-tab__meta--check">✓</span>
                )}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          disabled={!canMatch || loading}
          onClick={onMatch}
          className="btn-primary mobile-bar__cta"
        >
          {loading ? "Searching..." : "Find my photos"}
        </button>
      </div>
    </>
  );
}
