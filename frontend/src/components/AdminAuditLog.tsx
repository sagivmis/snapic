import type { AuditLogEntry } from "../types";
import { useTranslation } from "../i18n";
import "../styles/AdminAuditLog.scss";

interface AdminAuditLogProps {
  entries: AuditLogEntry[];
  loading?: boolean;
}

function formatAction(action: string): string {
  return action.replace(/\./g, " · ").replace(/_/g, " ");
}

function formatDateTime(value: string | null | undefined, emDash: string): string {
  if (!value) {
    return emDash;
  }
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AdminAuditLog({ entries, loading = false }: AdminAuditLogProps) {
  const { t, tPath } = useTranslation("admin.auditLog");

  return (
    <section className="admin-audit admin__section">
      <h2>{tPath("title")}</h2>
      {loading ? (
        <p className="admin-audit__empty">{tPath("loading")}</p>
      ) : entries.length === 0 ? (
        <p className="admin-audit__empty">{tPath("empty")}</p>
      ) : (
        <div className="admin-audit__table-wrap">
          <table className="admin-audit__table">
            <thead>
              <tr>
                <th>{tPath("columns.when")}</th>
                <th>{tPath("columns.action")}</th>
                <th>{tPath("columns.actor")}</th>
                <th>{tPath("columns.details")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateTime(entry.created_at, t("emDash"))}</td>
                  <td>
                    <span className="admin-audit__action">{formatAction(entry.action)}</span>
                  </td>
                  <td>{entry.actor_email ?? t("emDash")}</td>
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
