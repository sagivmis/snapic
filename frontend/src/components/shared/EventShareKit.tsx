import { buildEventGuestUrl } from "../../api/client";
import { GuestQrCode } from "../GuestQrCode";

interface EventShareKitProps {
  slug: string;
  title: string;
  coupleNames?: string;
}

export function EventShareKit({ slug, title, coupleNames }: EventShareKitProps) {
  const guestUrl = buildEventGuestUrl(slug);

  function copyLink() {
    void navigator.clipboard.writeText(guestUrl);
  }

  return (
    <section className="event-share-kit">
      <h2>Guest link & QR</h2>
      <div className="event-share-kit__row">
        <code>{guestUrl}</code>
        <button type="button" className="btn btn-ghost" onClick={copyLink}>
          Copy
        </button>
      </div>
      <GuestQrCode url={guestUrl} eventTitle={title} coupleNames={coupleNames} />
    </section>
  );
}
