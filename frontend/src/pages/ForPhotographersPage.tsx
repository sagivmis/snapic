import { Link, Navigate } from "react-router-dom";
import { useStudioMembership } from "../hooks/useStudioMembership";
import "../styles/ForPhotographers.scss";

const STEPS = [
  {
    number: "01",
    title: "Create a client gallery",
    description:
      "Add the couple, set branding, and choose whether they co-manage the album or you run it solo.",
  },
  {
    number: "02",
    title: "Upload & index faces",
    description:
      "Drop in the wedding album from your studio dashboard. Snapic indexes every face in the background.",
  },
  {
    number: "03",
    title: "Share the guest link",
    description:
      "Send a link or QR code. Guests upload a selfie and watch their photos appear in real time.",
  },
] as const;

const PLANS = [
  {
    name: "Pay per event",
    price: "From $99",
    detail: "One wedding, one gallery. Perfect for trying Snapic with your next client.",
    featured: false,
  },
  {
    name: "Annual bundle",
    price: "10 or 25 weddings",
    detail: "Lock in volume pricing for a busy season and keep every client gallery under one studio.",
    featured: true,
  },
  {
    name: "Unlimited",
    price: "Subscription",
    detail: "For high-volume studios running guest matching across dozens of events every year.",
    featured: false,
  },
] as const;

const BENEFITS = [
  {
    title: "Upload once",
    description: "You deliver the album; guests find themselves without endless scrolling.",
  },
  {
    title: "Real-time matching",
    description: "Photos stream in as they’re found — the same experience guests get on event day.",
  },
  {
    title: "Studio-branded",
    description: "Your logo, colors, and guest link keep the experience feeling like yours.",
  },
] as const;

export function ForPhotographersPage() {
  const { hasStudios, loaded } = useStudioMembership();

  if (loaded && hasStudios) {
    return <Navigate to="/studio/select" replace />;
  }

  return (
    <div className="photographers-page">
      <header className="photographers-hero">
        <div className="photographers-hero__content">
          <p className="photographers-hero__eyebrow">For wedding photographers</p>
          <h1>Delight every guest with AI photo matching</h1>
          <p className="photographers-hero__lead">
            Upload once from your studio dashboard. Your clients&apos; guests find themselves in every
            photo — no scrolling through hundreds of shots.
          </p>
          <div className="photographers-hero__actions">
            <Link to="/studio/signup" className="btn btn-primary">
              Start your studio
            </Link>
            <Link to="/demo" className="btn btn-secondary">
              Try the guest demo
            </Link>
          </div>
          <ul className="photographers-hero__highlights" aria-label="Key benefits">
            {BENEFITS.map((item) => (
              <li key={item.title}>{item.title}</li>
            ))}
          </ul>
        </div>

        <div className="photographers-hero__visual" aria-hidden="true">
          <div className="photographers-mock">
            <div className="photographers-mock__chrome">
              <span className="photographers-mock__dot" />
              <span className="photographers-mock__dot" />
              <span className="photographers-mock__dot" />
              <span className="photographers-mock__title">Studio · Rivera Wedding</span>
            </div>
            <div className="photographers-mock__body">
              <div className="photographers-mock__sidebar">
                <span className="photographers-mock__nav-item photographers-mock__nav-item--active" />
                <span className="photographers-mock__nav-item" />
                <span className="photographers-mock__nav-item" />
              </div>
              <div className="photographers-mock__main">
                <div className="photographers-mock__search">
                  <span className="photographers-mock__avatar" />
                  <div className="photographers-mock__search-copy">
                    <strong>Finding your photos…</strong>
                    <span>Scanned 34 of 120 · 8 matches so far</span>
                  </div>
                </div>
                <div className="photographers-mock__grid">
                  <span className="photographers-mock__photo photographers-mock__photo--match" />
                  <span className="photographers-mock__photo" />
                  <span className="photographers-mock__photo photographers-mock__photo--match" />
                  <span className="photographers-mock__photo" />
                  <span className="photographers-mock__photo photographers-mock__photo--match" />
                  <span className="photographers-mock__photo" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="photographers-benefits">
        {BENEFITS.map((item) => (
          <article key={item.title} className="photographers-benefits__card card-wedding">
            <h2>{item.title}</h2>
            <p>{item.description}</p>
          </article>
        ))}
      </section>

      <section className="photographers-steps">
        <div className="photographers-section-head">
          <p className="photographers-section-head__eyebrow">How it works</p>
          <h2>From upload to wow in three steps</h2>
        </div>
        <ol className="photographers-steps__list">
          {STEPS.map((step) => (
            <li key={step.number} className="photographers-steps__item card-wedding">
              <span className="photographers-steps__number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="photographers-pricing">
        <div className="photographers-section-head">
          <p className="photographers-section-head__eyebrow">Plans</p>
          <h2>Pricing that scales with your studio</h2>
          <p className="photographers-section-head__lead">
            Start with a single event or commit to a season — upgrade anytime as your volume grows.
          </p>
        </div>
        <ul className="photographers-pricing__grid">
          {PLANS.map((plan) => (
            <li
              key={plan.name}
              className={`photographers-pricing__card card-wedding${plan.featured ? " photographers-pricing__card--featured" : ""}`}
            >
              {plan.featured && <span className="photographers-pricing__badge">Most popular</span>}
              <h3>{plan.name}</h3>
              <p className="photographers-pricing__price">{plan.price}</p>
              <p className="photographers-pricing__detail">{plan.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="photographers-cta card-wedding">
        <div>
          <h2>Ready to give guests a better experience?</h2>
          <p>Set up your studio in minutes and run your first gallery on your next wedding.</p>
        </div>
        <Link to="/studio/signup" className="btn btn-primary">
          Start your studio
        </Link>
      </section>
    </div>
  );
}
