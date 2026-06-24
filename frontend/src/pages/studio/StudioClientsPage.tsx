import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchStudioClients } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { StudioClientsTableSkeleton } from "../../components/studio/StudioSkeletons";
import type { StudioClient } from "../../types";
import "../../styles/StudioLayout.scss";

export function StudioClientsPage() {
  const { getAccessToken } = useAuth();
  const [clients, setClients] = useState<StudioClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      setClients(await fetchStudioClients(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load clients");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="studio-page" aria-busy={loading}>
      <header className="studio-page__header">
        <h1>Clients</h1>
        <Link to="/studio/clients/new" className="btn btn-primary">
          New client
        </Link>
      </header>
      {loading ? (
        <StudioClientsTableSkeleton rows={6} />
      ) : clients.length === 0 ? (
        <p>No clients yet.</p>
      ) : (
        <table className="studio-clients-table">
          <thead>
            <tr>
              <th>Names</th>
              <th>Date</th>
              <th>Status</th>
              <th>Handoff</th>
              <th>Photos</th>
              <th>Searches</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id}>
                <td>
                  <Link to={`/studio/clients/${client.id}`}>{client.title}</Link>
                </td>
                <td>{client.wedding_date ?? "—"}</td>
                <td>{client.status}</td>
                <td>{client.handoff_status}</td>
                <td>{client.gallery_photo_count}</td>
                <td>{client.match_run_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {error && <p className="error-banner">{error}</p>}
    </div>
  );
}
