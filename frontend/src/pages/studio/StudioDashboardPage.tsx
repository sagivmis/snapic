import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchStudioClients, fetchStudioStats } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import type { StudioClient, StudioStats } from "../../types";
import "../../styles/StudioLayout.scss";

export function StudioDashboardPage() {
  const { getAccessToken } = useAuth();
  const [stats, setStats] = useState<StudioStats | null>(null);
  const [clients, setClients] = useState<StudioClient[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      return;
    }
    try {
      const [statsRow, clientRows] = await Promise.all([fetchStudioStats(token), fetchStudioClients(token)]);
      setStats(statsRow);
      setClients(clientRows.slice(0, 5));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load dashboard");
    }
  }, [getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="studio-page">
      <header className="studio-page__header">
        <div>
          <h1>Dashboard</h1>
          <p>Overview of your client galleries</p>
        </div>
        <Link to="/studio/clients/new" className="btn btn-primary">
          New client
        </Link>
      </header>

      {stats && (
        <section className="studio-page__stats">
          <div className="studio-page__stat">
            <span className="studio-page__stat-value">{stats.active_clients}</span>
            <span className="studio-page__stat-label">Live</span>
          </div>
          <div className="studio-page__stat">
            <span className="studio-page__stat-value">{stats.draft_clients}</span>
            <span className="studio-page__stat-label">In progress</span>
          </div>
          <div className="studio-page__stat">
            <span className="studio-page__stat-value">{stats.total_searches}</span>
            <span className="studio-page__stat-label">Guest searches</span>
          </div>
          <div className="studio-page__stat">
            <span className="studio-page__stat-value">{stats.pending_handoffs}</span>
            <span className="studio-page__stat-label">Pending handoff</span>
          </div>
        </section>
      )}

      <section>
        <h2>Recent clients</h2>
        {clients.length === 0 ? (
          <p>No clients yet. <Link to="/studio/clients/new">Create your first gallery</Link>.</p>
        ) : (
          <table className="studio-clients-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Status</th>
                <th>Photos</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id}>
                  <td>{client.title}</td>
                  <td>{client.status}</td>
                  <td>{client.gallery_photo_count}</td>
                  <td>
                    <Link to={`/studio/clients/${client.id}`}>Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {error && <p className="error-banner">{error}</p>}
    </div>
  );
}
