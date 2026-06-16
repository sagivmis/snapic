import type { AdminAttention } from "../types";
import "../styles/AdminAttention.scss";

export type AttentionFocus =
  | "pending_signups"
  | "empty_album"
  | "unindexed"
  | "archive_due"
  | null;

interface AdminAttentionStripProps {
  attention: AdminAttention;
  onFocus: (focus: AttentionFocus) => void;
}

interface AttentionChip {
  key: AttentionFocus;
  count: number;
  label: string;
  detail?: string;
}

export function AdminAttentionStrip({ attention, onFocus }: AdminAttentionStripProps) {
  const chips: AttentionChip[] = [
    {
      key: "pending_signups" as const,
      count: attention.pending_signups,
      label: "Pending signups",
    },
    {
      key: "empty_album" as const,
      count: attention.active_empty_albums,
      label: "Active, no photos",
    },
    {
      key: "unindexed" as const,
      count: attention.events_with_unindexed,
      label: "Need face index",
      detail:
        attention.unindexed_photos > 0
          ? `${attention.unindexed_photos} photo${attention.unindexed_photos === 1 ? "" : "s"}`
          : undefined,
    },
    {
      key: "archive_due" as const,
      count: attention.archive_due_events,
      label: "Past archive date",
    },
  ].filter((chip) => chip.count > 0);

  if (chips.length === 0) {
    return (
      <section className="admin-attention admin-attention--clear" aria-label="Needs attention">
        <p>All clear — nothing needs your attention right now.</p>
      </section>
    );
  }

  return (
    <section className="admin-attention" aria-label="Needs attention">
      <h2 className="admin-attention__title">Needs attention</h2>
      <div className="admin-attention__chips">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            className="admin-attention__chip"
            onClick={() => onFocus(chip.key)}
          >
            <span className="admin-attention__chip-count">{chip.count}</span>
            <span className="admin-attention__chip-label">{chip.label}</span>
            {chip.detail && <span className="admin-attention__chip-detail">{chip.detail}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}
