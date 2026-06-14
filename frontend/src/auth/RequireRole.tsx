import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import type { GlobalRole } from "../lib/supabase";

interface RequireRoleProps {
  roles: GlobalRole[];
  children: React.ReactNode;
  fallback?: string;
}

export function RequireRole({ roles, children, fallback = "/login" }: RequireRoleProps) {
  const { loading, profile, session } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-loading">
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to={fallback} state={{ from: location.pathname }} replace />;
  }

  const role = profile?.global_role ?? "guest";
  if (!roles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { loading, session } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-loading">
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
