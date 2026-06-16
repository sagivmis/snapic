import "../styles/AdminDashboardSkeletons.scss";
import "../styles/AdminAttention.scss";
import "../styles/AdminSignupRequests.scss";

export function AdminStatsSkeleton() {
  return (
    <section className="admin__stats admin-skeleton-block" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="admin__stat admin-skeleton-stat">
          <span className="admin-skeleton admin-skeleton--value" />
          <span className="admin-skeleton admin-skeleton--label" />
        </div>
      ))}
    </section>
  );
}

export function AdminAttentionSkeleton() {
  return (
    <section className="admin-attention admin-skeleton-block admin-skeleton-attention" aria-hidden="true">
      <div className="admin-skeleton admin-skeleton--title" />
      <div className="admin-skeleton-attention__chips">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="admin-skeleton admin-skeleton--chip" />
        ))}
      </div>
    </section>
  );
}

export function AdminSignupRequestsSkeleton() {
  return (
    <section className="admin-signups admin__section admin-skeleton-block" aria-hidden="true">
      <div className="admin-skeleton-signups__header">
        <div className="admin-skeleton admin-skeleton--title" />
        <div className="admin-skeleton-signups__tabs">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="admin-skeleton admin-skeleton--tab" />
          ))}
        </div>
      </div>
      <div className="admin-skeleton-signups__list">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="admin-skeleton admin-skeleton--signup-row" />
        ))}
      </div>
    </section>
  );
}

export function AdminEventsTableSkeleton() {
  return (
    <div className="admin-events admin-skeleton-block admin-skeleton-events" aria-hidden="true">
      <div className="admin-skeleton-events__toolbar">
        <div className="admin-skeleton admin-skeleton--search" />
        <div className="admin-skeleton-events__filters">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="admin-skeleton admin-skeleton--filter" />
          ))}
        </div>
      </div>
      <div className="admin-skeleton-events__table">
        <div className="admin-skeleton admin-skeleton--table-head" />
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="admin-skeleton admin-skeleton--table-row" />
        ))}
      </div>
    </div>
  );
}
