import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { bulkDeleteStudioClients, deleteStudioClient, fetchStudioClients } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { StudioClientsTableSkeleton } from "../../components/studio/StudioSkeletons";
import { clearStudioDashboardCache } from "../../lib/studioCache";
import type { StudioClient } from "../../types";
import "../../styles/StudioLayout.scss";

function deleteConfirmMessage(client: StudioClient, count = 1): string {
  const label = count === 1 ? `"${client.title}"` : `${count} clients`;
  return `Delete ${label} permanently? Photos, searches, and gallery data will be removed. This cannot be undone.`;
}

export function StudioClientsPage() {
  const { getAccessToken } = useAuth();
  const [clients, setClients] = useState<StudioClient[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : "Could not load clients");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

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
        throw new Error("Not signed in");
      }
      await deleteStudioClient(client.id, token);
      clearStudioDashboardCache();
      setNotice(`Deleted ${client.title}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete client");
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
        throw new Error("Not signed in");
      }
      const result = await bulkDeleteStudioClients(
        selectedClients.map((client) => client.id),
        token,
      );
      clearStudioDashboardCache();
      if (result.deleted === 0) {
        throw new Error("No clients were deleted");
      }
      const parts = [`Deleted ${result.deleted} client${result.deleted === 1 ? "" : "s"}.`];
      if (result.denied > 0) {
        parts.push(`${result.denied} could not be deleted (no access).`);
      }
      setNotice(parts.join(" "));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="studio-page" aria-busy={loading || busy}>
      <header className="studio-page__header">
        <h1>Clients</h1>
        <Link to="/studio/clients/new" className="btn btn-primary">
          New client
        </Link>
      </header>

      {someSelected && (
        <div className="studio-clients-table__bulk-bar">
          <span>
            {selected.size} selected
          </span>
          <button type="button" className="btn btn-ghost studio-clients-table__delete-btn" disabled={busy} onClick={() => void handleBulkDelete()}>
            Delete selected
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <StudioClientsTableSkeleton rows={6} />
      ) : clients.length === 0 ? (
        <p>No clients yet.</p>
      ) : (
        <table className="studio-clients-table">
          <thead>
            <tr>
              <th className="studio-clients-table__check-col">
                <input
                  type="checkbox"
                  aria-label="Select all clients"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) {
                      input.indeterminate = someSelected && !allSelected;
                    }
                  }}
                  onChange={toggleAll}
                />
              </th>
              <th>Names</th>
              <th>Date</th>
              <th>Status</th>
              <th>Handoff</th>
              <th>Photos</th>
              <th>Searches</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} className={selected.has(client.id) ? "studio-clients-table__row--selected" : undefined}>
                <td className="studio-clients-table__check-col">
                  <input
                    type="checkbox"
                    aria-label={`Select ${client.title}`}
                    checked={selected.has(client.id)}
                    onChange={() => toggleOne(client.id)}
                  />
                </td>
                <td>
                  <Link to={`/studio/clients/${client.id}`}>{client.title}</Link>
                </td>
                <td>{client.wedding_date ?? "—"}</td>
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
                    Delete
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
