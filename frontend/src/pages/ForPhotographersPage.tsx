import { Link } from "react-router-dom";
import "../styles/Landing.scss";

export function ForPhotographersPage() {
  return (
    <div className="landing">
      <header className="landing__hero">
        <p className="landing__eyebrow">For wedding photographers</p>
        <h1>Delight every guest with AI photo matching</h1>
        <p className="landing__lead">
          Upload once from your studio dashboard. Your clients&apos; guests find themselves in every photo — no
          scrolling through hundreds of shots.
        </p>
        <div className="landing__actions">
          <Link to="/studio/signup" className="btn btn-primary">
            Start your studio
          </Link>
          <Link to="/demo" className="btn btn-secondary">
            Try the demo
          </Link>
        </div>
      </header>
      <section className="landing__section">
        <h2>How it works</h2>
        <ol>
          <li>Create a client gallery in your studio dashboard</li>
          <li>Upload the wedding album and index faces</li>
          <li>Share the guest link or QR — optionally invite the couple to co-manage</li>
        </ol>
      </section>
      <section className="landing__section">
        <h2>Plans</h2>
        <ul>
          <li>Pay per event — from $99</li>
          <li>Annual bundles — 10 or 25 weddings</li>
          <li>Unlimited subscription for high-volume studios</li>
        </ul>
      </section>
    </div>
  );
}
