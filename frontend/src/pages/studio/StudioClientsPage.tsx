import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchStudioClients } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import type { StudioClient } from "../../types";
import "../../styles/StudioLayout.scss";

export function StudioClientsPage() {
  const { getAccessToken } = useAuth();
  const [clients, setClients] = useState<StudioClient[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      return;
    }
    try {
      setClients(await fetchStudioClients(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load clients");
    }
  }, [getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="studio-page">
      <header className="studio-page__header">
        <h1>Clients</h1>
        <Link to="/studio/clients/new" className="btn btn-primary">
          New client
        </Link>
      </header>
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
      {clients.length === 0 && <p>No clients yet.</p>}
      {error && <p className="error-banner">{error}</p>}
    </div>
  );
}
