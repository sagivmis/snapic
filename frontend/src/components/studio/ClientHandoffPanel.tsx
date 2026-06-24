import { Link } from "react-router-dom";
import { buildEventGuestUrl } from "../../api/client";
import { useTranslation } from "../../i18n";
import { GuestQrCode } from "../GuestQrCode";
import type { StudioClient } from "../../types";

interface ClientHandoffPanelProps {
  client: StudioClient;
  onInvite: (email: string) => Promise<void>;
  onGoLive: () => Promise<void>;
  busy: boolean;
}

export function ClientHandoffPanel({ client, onInvite, onGoLive, busy }: ClientHandoffPanelProps) {
  const { tPath } = useTranslation("studio.clientDetail.handoff");
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
    { label: tPath("photosUploaded"), done: client.gallery_photo_count > 0 },
    {
      label: tPath("facesIndexed"),
      done: client.unindexed_photo_count === 0 && client.gallery_photo_count > 0,
    },
    {
      label: tPath("coupleInvited"),
      done: client.handoff_status === "invited" || client.handoff_status === "live",
    },
    { label: tPath("galleryLive"), done: client.status === "active" },
  ];

  return (
    <section className="studio-handoff">
      <h2>{tPath("title")}</h2>
      <ul className="studio-handoff__checklist">
        {checklist.map((item) => (
          <li key={item.label} className={item.done ? "studio-handoff__done" : ""}>
            {item.done ? "✓" : "○"} {item.label}
          </li>
        ))}
      </ul>

      <form className="studio-form" onSubmit={handleInviteSubmit}>
        <h3>{tPath("inviteCoupleTitle")}</h3>
        <label htmlFor="couple-email">{tPath("coupleEmailLabel")}</label>
        <input
          id="couple-email"
          name="email"
          type="email"
          defaultValue={client.client_email ?? ""}
          placeholder={tPath("coupleEmailPlaceholder")}
        />
        <button type="submit" className="btn btn-secondary" disabled={busy}>
          {tPath("sendInvite")}
        </button>
      </form>

      <div className="studio-handoff__share">
        <h3>{tPath("shareKitTitle")}</h3>
        <p>
          {tPath("guestLink")} <code>{guestUrl}</code>
        </p>
        <GuestQrCode url={guestUrl} eventTitle={client.title} coupleNames={coupleNames} />
      </div>

      <div className="studio-handoff__actions">
        {client.status !== "active" && (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void onGoLive()}>
            {tPath("goLive")}
          </button>
        )}
        <Link className="btn btn-secondary" to={`/e/${client.slug}`} target="_blank" rel="noreferrer">
          {tPath("previewGuestPage")}
        </Link>
      </div>
    </section>
  );
}
