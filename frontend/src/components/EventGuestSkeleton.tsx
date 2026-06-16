import "../styles/EventGuestSkeleton.scss";

export function EventGuestSkeleton() {
  return (
    <div className="event-guest event-guest-skeleton" aria-hidden="true">
      <header className="event-guest-skeleton__header">
        <div className="event-guest-skeleton__line event-guest-skeleton__line--eyebrow" />
        <div className="event-guest-skeleton__line event-guest-skeleton__line--title" />
        <div className="event-guest-skeleton__line event-guest-skeleton__line--desc" />
      </header>
      <div className="event-guest-skeleton__card">
        <div className="event-guest-skeleton__portrait" />
        <div className="event-guest-skeleton__line event-guest-skeleton__line--button" />
      </div>
    </div>
  );
}
