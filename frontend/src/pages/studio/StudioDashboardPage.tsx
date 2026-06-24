import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchStudioClients, fetchStudioStats } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { useStudioOrg } from "../../components/studio/StudioOrgContext";
import {
  DASHBOARD_STAT_LABELS,
  StudioClientsTableSkeleton,
  StudioStatsSkeleton,
} from "../../components/studio/StudioSkeletons";
import {
  getStudioDashboardCache,
  setStudioDashboardCache,
} from "../../lib/studioCache";
import type { StudioClient, StudioStats } from "../../types";
import "../../styles/StudioLayout.scss";

const STAT_KEYS: (keyof StudioStats)[] = [
  "active_clients",
  "draft_clients",
  "total_searches",
  "pending_handoffs",
];

export function StudioDashboardPage() {
  const { getAccessToken } = useAuth();
  const { activeOrgId } = useStudioOrg();
  const [stats, setStats] = useState<StudioStats | null>(null);
  const [clients, setClients] = useState<StudioClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const orgId = activeOrgId;
    if (!orgId) {
      setLoading(false);
      return;
    }

    const cached = getStudioDashboardCache(orgId);
    if (cached) {
      setStats(cached.stats);
      setClients(cached.clients.slice(0, 5));
      setLoading(false);
    } else {
      setLoading(true);
    }

    const token = await getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const [statsRow, clientRows] = await Promise.all([fetchStudioStats(token), fetchStudioClients(token)]);
      setStats(statsRow);
      setClients(clientRows.slice(0, 5));
      setStudioDashboardCache(orgId, statsRow, clientRows);
    } catch (err) {
      if (!cached) {
        setError(err instanceof Error ? err.message : "Could not load dashboard");
      }
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="studio-page" aria-busy={loading}>
      <header className="studio-page__header">
        <div>
          <h1>Dashboard</h1>
          <p>Overview of your client galleries</p>
        </div>
        <Link to="/studio/clients/new" className="btn btn-primary">
          New client
        </Link>
      </header>

      {loading ? (
        <StudioStatsSkeleton labels={DASHBOARD_STAT_LABELS} />
      ) : (
        stats && (
          <section className="studio-page__stats">
            {STAT_KEYS.map((key, index) => (
              <div key={key} className="studio-page__stat">
                <span className="studio-page__stat-value">{stats[key]}</span>
                <span className="studio-page__stat-label">{DASHBOARD_STAT_LABELS[index]}</span>
              </div>
            ))}
          </section>
        )
      )}

      <section>
        <h2>Recent clients</h2>
        {loading ? (
          <StudioClientsTableSkeleton rows={3} />
        ) : clients.length === 0 ? (
          <p>
            No clients yet. <Link to="/studio/clients/new">Create your first gallery</Link>.
          </p>
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
