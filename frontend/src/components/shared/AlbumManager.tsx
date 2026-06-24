import { Link } from "react-router-dom";
import type { EventPublic } from "../../types";

interface AlbumManagerProps {
  event: EventPublic;
  manageFrom?: "studio" | "setup";
}

/** Routes photographers to the shared album UI on the event manage page. */
export function AlbumManager({ event, manageFrom = "studio" }: AlbumManagerProps) {
  const manageUrl = `/e/${event.slug}/manage?from=${manageFrom}&tab=album`;

  return (
    <section className="album-manager">
      <div className="album-manager__header">
        <h2>Wedding album</h2>
        <p className="album-manager__hint">
          {event.gallery_photo_count ?? 0} photos
          {event.photo_limit ? ` · limit ${event.photo_limit}` : ""}
        </p>
        <Link to={manageUrl} className="btn btn-primary">
          Open album manager
        </Link>
      </div>
      <p className="album-manager__note">
        Upload photos, organize sections, and index faces using the full album tools.
      </p>
    </section>
  );
}
