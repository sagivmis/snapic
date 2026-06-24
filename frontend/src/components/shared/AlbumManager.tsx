import { Link } from "react-router-dom";
import { useTranslation } from "../../i18n";
import type { EventPublic } from "../../types";

interface AlbumManagerProps {
  event: EventPublic;
  manageFrom?: "studio" | "setup";
}

/** Routes photographers to the shared album UI on the event manage page. */
export function AlbumManager({ event, manageFrom = "studio" }: AlbumManagerProps) {
  const { tPath } = useTranslation();
  const { tPath: tManage } = useTranslation("events.manage");
  const { tPath: tStatus } = useTranslation("components.albumStatus");
  const manageUrl = `/e/${event.slug}/manage?from=${manageFrom}&tab=album`;
  const photoCount = event.gallery_photo_count ?? 0;

  return (
    <section className="album-manager">
      <div className="album-manager__header">
        <h2>{tManage("albumTitle")}</h2>
        <p className="album-manager__hint">
          {tStatus("photoCount", { count: photoCount })}
          {event.photo_limit
            ? tPath("studio.clientDetail.albumManager.photoLimit", { limit: event.photo_limit })
            : ""}
        </p>
        <Link to={manageUrl} className="btn btn-primary">
          {tPath("studio.clientDetail.albumManager.openManager")}
        </Link>
      </div>
      <p className="album-manager__note">{tPath("studio.clientDetail.albumManager.note")}</p>
    </section>
  );
}
