import type { AuditLogEntry } from "../types";
import "../styles/AdminAuditLog.scss";

interface AdminAuditLogProps {
  entries: AuditLogEntry[];
  loading?: boolean;
}

function formatAction(action: string): string {
  return action.replace(/\./g, " · ").replace(/_/g, " ");
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AdminAuditLog({ entries, loading = false }: AdminAuditLogProps) {
  return (
    <section className="admin-audit admin__section">
      <h2>Audit log</h2>
      {loading ? (
        <p className="admin-audit__empty">Loading recent actions…</p>
      ) : entries.length === 0 ? (
        <p className="admin-audit__empty">No admin actions recorded yet.</p>
      ) : (
        <div className="admin-audit__table-wrap">
          <table className="admin-audit__table">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateTime(entry.created_at)}</td>
                  <td>
                    <span className="admin-audit__action">{formatAction(entry.action)}</span>
                  </td>
                  <td>{entry.actor_email ?? "—"}</td>
                  <td className="admin-audit__meta">
                    {typeof entry.metadata.event_slug === "string" && (
                      <span>/e/{entry.metadata.event_slug}</span>
                    )}
                    {typeof entry.metadata.email === "string" && <span>{entry.metadata.email}</span>}
                    {typeof entry.metadata.couple_names === "string" && (
                      <span>{entry.metadata.couple_names}</span>
                    )}
                    {typeof entry.metadata.slug === "string" && !entry.metadata.event_slug && (
                      <span>/e/{entry.metadata.slug}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
