import "../styles/EventManageSkeleton.scss";

export function EventManageSkeleton() {
  return (
    <div className="event-manage event-manage-skeleton" aria-hidden="true">
      <header className="event-manage-skeleton__header">
        <div>
          <div className="event-manage-skeleton__line event-manage-skeleton__line--eyebrow" />
          <div className="event-manage-skeleton__line event-manage-skeleton__line--title" />
        </div>
        <div className="event-manage-skeleton__actions">
          <div className="event-manage-skeleton__pill" />
          <div className="event-manage-skeleton__pill event-manage-skeleton__pill--ghost" />
        </div>
      </header>

      <div className="event-manage-skeleton__stats">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="event-manage-skeleton__stat">
            <div className="event-manage-skeleton__line event-manage-skeleton__line--stat-value" />
            <div className="event-manage-skeleton__line event-manage-skeleton__line--stat-label" />
          </div>
        ))}
      </div>

      <div className="event-manage-skeleton__tabs">
        <div className="event-manage-skeleton__tab event-manage-skeleton__tab--active" />
        <div className="event-manage-skeleton__tab" />
      </div>

      <section className="event-manage-skeleton__section">
        <div className="event-manage-skeleton__line event-manage-skeleton__line--section-title" />
        <div className="event-manage-skeleton__upload" />
        <div className="event-manage-skeleton__grid">
          {Array.from({ length: 12 }, (_, index) => (
            <div key={index} className="event-manage-skeleton__tile" />
          ))}
        </div>
      </section>
    </div>
  );
}
