import { Link } from "react-router-dom";
import { buildEventGuestUrl } from "../../api/client";
import { GuestQrCode } from "../GuestQrCode";
import type { StudioClient } from "../../types";

interface ClientHandoffPanelProps {
  client: StudioClient;
  onInvite: (email: string) => Promise<void>;
  onGoLive: () => Promise<void>;
  busy: boolean;
}

export function ClientHandoffPanel({ client, onInvite, onGoLive, busy }: ClientHandoffPanelProps) {
  const guestUrl = buildEventGuestUrl(client.slug);
  const coupleNames =
    typeof client.branding.couple_names === "string" ? client.branding.couple_names : client.title;

  async function handleInviteSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    if (email) {
      await onInvite(email);
    }
  }

  const checklist = [
    { label: "Photos uploaded", done: client.gallery_photo_count > 0 },
    { label: "Faces indexed", done: client.unindexed_photo_count === 0 && client.gallery_photo_count > 0 },
    { label: "Couple invited", done: client.handoff_status === "invited" || client.handoff_status === "live" },
    { label: "Gallery live", done: client.status === "active" },
  ];

  return (
    <section className="studio-handoff">
      <h2>Handoff checklist</h2>
      <ul className="studio-handoff__checklist">
        {checklist.map((item) => (
          <li key={item.label} className={item.done ? "studio-handoff__done" : ""}>
            {item.done ? "✓" : "○"} {item.label}
          </li>
        ))}
      </ul>

      <form className="studio-form" onSubmit={handleInviteSubmit}>
        <h3>Invite couple (optional)</h3>
        <label htmlFor="couple-email">Couple email</label>
        <input id="couple-email" name="email" type="email" defaultValue={client.client_email ?? ""} placeholder="couple@example.com" />
        <button type="submit" className="btn btn-secondary" disabled={busy}>
          Send invite
        </button>
      </form>

      <div className="studio-handoff__share">
        <h3>Share kit</h3>
        <p>
          Guest link: <code>{guestUrl}</code>
        </p>
        <GuestQrCode url={guestUrl} eventTitle={client.title} coupleNames={coupleNames} />
      </div>

      <div className="studio-handoff__actions">
        {client.status !== "active" && (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void onGoLive()}>
            Go live
          </button>
        )}
        <Link className="btn btn-secondary" to={`/e/${client.slug}`} target="_blank" rel="noreferrer">
          Preview guest page
        </Link>
      </div>
    </section>
  );
}
