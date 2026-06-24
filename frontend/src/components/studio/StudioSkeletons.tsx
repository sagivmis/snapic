import "../../styles/StudioSkeletons.scss";

export const DASHBOARD_STAT_LABELS = [
  "Live",
  "In progress",
  "Guest searches",
  "Pending handoff",
] as const;

export function StudioStatsSkeleton({
  count = 4,
  labels,
}: {
  count?: number;
  labels?: readonly string[];
}) {
  const items = labels ?? Array.from({ length: count }, () => null);

  return (
    <section
      className={`studio-page__stats${labels ? "" : " studio-skeleton-block"}`}
      aria-hidden={labels ? undefined : true}
    >
      {items.map((label, index) => (
        <div key={label ?? index} className="studio-page__stat">
          <span className="studio-skeleton studio-skeleton--stat-value" aria-hidden="true" />
          {label ? (
            <span className="studio-page__stat-label">{label}</span>
          ) : (
            <span className="studio-skeleton studio-skeleton--label" />
          )}
        </div>
      ))}
    </section>
  );
}

export function StudioClientsTableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="studio-skeleton-table studio-skeleton-block" aria-hidden="true">
      <div className="studio-skeleton studio-skeleton--table-head" />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="studio-skeleton studio-skeleton--table-row" />
      ))}
    </div>
  );
}

export function StudioFormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="studio-skeleton-form studio-skeleton-block" aria-hidden="true">
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="studio-skeleton-form__field">
          <span className="studio-skeleton studio-skeleton--line-short" />
          <span className="studio-skeleton studio-skeleton--input" />
        </div>
      ))}
      <span className="studio-skeleton studio-skeleton--button" />
    </div>
  );
}

export function StudioDashboardContentSkeleton() {
  return (
    <>
      <StudioStatsSkeleton labels={DASHBOARD_STAT_LABELS} />
      <section>
        <h2>Recent clients</h2>
        <StudioClientsTableSkeleton rows={3} />
      </section>
    </>
  );
}

export function StudioClientDetailSkeleton() {
  return (
    <>
      <div className="studio-skeleton-tabs studio-skeleton-block" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <span key={index} className="studio-skeleton studio-skeleton--tab" />
        ))}
      </div>
      <span className="studio-skeleton studio-skeleton--panel studio-skeleton-block" aria-hidden="true" />
    </>
  );
}

export function StudioTeamMembersSkeleton() {
  return (
    <ul className="studio-team-members__grid studio-skeleton-block" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <li key={index} className="studio-team-members__tile studio-team-members__tile--skeleton">
          <span className="studio-skeleton studio-team-members__skeleton-name" />
          <span className="studio-skeleton studio-team-members__skeleton-role" />
        </li>
      ))}
    </ul>
  );
}

export function StudioLayoutLoading() {
  return (
    <div className="studio-layout studio-layout--loading-shell" aria-busy="true" aria-label="Loading studio">
      <aside className="studio-layout__sidebar studio-skeleton-block" aria-hidden="true">
        <span className="studio-skeleton studio-skeleton--brand" />
        <div className="studio-skeleton-nav">
          {Array.from({ length: 5 }, (_, index) => (
            <span key={index} className="studio-skeleton studio-skeleton-nav__item" />
          ))}
        </div>
      </aside>
      <main className="studio-layout__main">
        <div className="studio-page">
          <header className="studio-page__header">
            <div>
              <h1>Dashboard</h1>
              <p>Overview of your client galleries</p>
            </div>
          </header>
          <StudioDashboardContentSkeleton />
        </div>
      </main>
    </div>
  );
}

export function StudioSelectLoading() {
  return (
    <div className="auth-page studio-select studio-select--loading" aria-busy="true" aria-label="Loading studios">
      <span className="studio-skeleton studio-skeleton--eyebrow" aria-hidden="true" />
      <span className="studio-skeleton studio-skeleton--title" aria-hidden="true" />
      <span className="studio-skeleton studio-skeleton--line-medium" aria-hidden="true" />
      <div className="studio-select__list studio-skeleton-block" aria-hidden="true">
        <span className="studio-skeleton studio-skeleton--select-card" />
        <span className="studio-skeleton studio-skeleton--select-card" />
      </div>
    </div>
  );
}
