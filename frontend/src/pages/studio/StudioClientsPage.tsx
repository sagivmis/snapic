import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { bulkDeleteStudioClients, deleteStudioClient, fetchStudioClients } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { StudioClientsTableSkeleton } from "../../components/studio/StudioSkeletons";
import { useTranslation } from "../../i18n";
import { clearStudioDashboardCache } from "../../lib/studioCache";
import type { StudioClient } from "../../types";
import "../../styles/StudioLayout.scss";

export function StudioClientsPage() {
  const { getAccessToken } = useAuth();
  const { t, tPath } = useTranslation("studio.clients");
  const [clients, setClients] = useState<StudioClient[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const deleteConfirmMessage = useCallback(
    (client: StudioClient, count = 1) =>
      count === 1
        ? tPath("deleteConfirm_one", { title: client.title })
        : tPath("deleteConfirm_other", { count }),
    [tPath],
  );

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      setClients(await fetchStudioClients(token));
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : tPath("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, tPath]);

  useEffect(() => {
    void load();
  }, [load]);

  const allSelected = clients.length > 0 && selected.size === clients.length;
  const someSelected = selected.size > 0;

  const selectedClients = useMemo(
    () => clients.filter((client) => selected.has(client.id)),
    [clients, selected],
  );

  function toggleOne(clientId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(clients.map((client) => client.id)));
  }

  async function handleDeleteOne(client: StudioClient) {
    if (!window.confirm(deleteConfirmMessage(client))) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(t("notSignedIn"));
      }
      await deleteStudioClient(client.id, token);
      clearStudioDashboardCache();
      setNotice(tPath("deleted", { title: client.title }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : tPath("deleteFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleBulkDelete() {
    if (selectedClients.length === 0) {
      return;
    }
    if (!window.confirm(deleteConfirmMessage(selectedClients[0], selectedClients.length))) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(t("notSignedIn"));
      }
      const result = await bulkDeleteStudioClients(
        selectedClients.map((client) => client.id),
        token,
      );
      clearStudioDashboardCache();
      if (result.deleted === 0) {
        throw new Error(tPath("noClientsDeleted"));
      }
      const parts = [
        tPath(result.deleted === 1 ? "deletedBulk_one" : "deletedBulk_other", { count: result.deleted }),
      ];
      if (result.denied > 0) {
        parts.push(tPath("deniedBulk", { count: result.denied }));
      }
      setNotice(parts.join(" "));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : tPath("bulkDeleteFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="studio-page" aria-busy={loading || busy}>
      <header className="studio-page__header">
        <h1>{tPath("title")}</h1>
        <Link to="/studio/clients/new" className="btn btn-primary">
          {tPath("newClient")}
        </Link>
      </header>

      {someSelected && (
        <div className="studio-clients-table__bulk-bar">
          <span>
            {selected.size === 1
              ? t("selected_one", { count: selected.size })
              : t("selected_other", { count: selected.size })}
          </span>
          <button type="button" className="btn btn-ghost studio-clients-table__delete-btn" disabled={busy} onClick={() => void handleBulkDelete()}>
            {tPath("deleteSelected")}
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setSelected(new Set())}>
            {t("clear")}
          </button>
        </div>
      )}

      {loading ? (
        <StudioClientsTableSkeleton rows={6} />
      ) : clients.length === 0 ? (
        <p>{tPath("noClients")}</p>
      ) : (
        <table className="studio-clients-table">
          <thead>
            <tr>
              <th className="studio-clients-table__check-col">
                <input
                  type="checkbox"
                  aria-label={t("selectAllClients")}
                  checked={allSelected}
                  ref={(input) => {
                    if (input) {
                      input.indeterminate = someSelected && !allSelected;
                    }
                  }}
                  onChange={toggleAll}
                />
              </th>
              <th>{tPath("tableNames")}</th>
              <th>{tPath("tableDate")}</th>
              <th>{tPath("tableStatus")}</th>
              <th>{tPath("tableHandoff")}</th>
              <th>{tPath("tablePhotos")}</th>
              <th>{tPath("tableSearches")}</th>
              <th aria-label={t("actionsCol")} />
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} className={selected.has(client.id) ? "studio-clients-table__row--selected" : undefined}>
                <td className="studio-clients-table__check-col">
                  <input
                    type="checkbox"
                    aria-label={t("selectClient", { title: client.title })}
                    checked={selected.has(client.id)}
                    onChange={() => toggleOne(client.id)}
                  />
                </td>
                <td>
                  <Link to={`/studio/clients/${client.id}`}>{client.title}</Link>
                </td>
                <td>{client.wedding_date ?? t("emDash")}</td>
                <td>{client.status}</td>
                <td>{client.handoff_status}</td>
                <td>{client.gallery_photo_count}</td>
                <td>{client.match_run_count}</td>
                <td className="studio-clients-table__actions-col">
                  <button
                    type="button"
                    className="btn btn-ghost studio-clients-table__delete-btn"
                    disabled={busy}
                    onClick={() => void handleDeleteOne(client)}
                  >
                    {tPath("delete")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {notice && <p className="studio-clients-table__notice">{notice}</p>}
      {error && <p className="error-banner">{error}</p>}
    </div>
  );
}
