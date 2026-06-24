import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Navigate } from "react-router-dom";
import { fetchStudioMe } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import type { Organization } from "../../types";
import { StudioLayoutLoading } from "./StudioSkeletons";

interface StudioOrgContextValue {
  organization: Organization | null;
  memberRole: string | null;
  setOrganization: (org: Organization) => void;
  refreshOrganization: () => Promise<Organization | null>;
}

const StudioOrgContext = createContext<StudioOrgContextValue | null>(null);

export function useStudioOrg(): StudioOrgContextValue {
  const value = useContext(StudioOrgContext);
  if (!value) {
    throw new Error("useStudioOrg must be used within StudioOrgProvider");
  }
  return value;
}

export function StudioOrgProvider({ children }: { children: ReactNode }) {
  const { getAccessToken, loading, session, isSuperAdmin } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [memberRole, setMemberRole] = useState<string | null>(null);
  const [orgReady, setOrgReady] = useState<boolean | null>(null);

  const refreshOrganization = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      return null;
    }
    const me = await fetchStudioMe(token);
    setOrganization(me.organization);
    setMemberRole(me.member_role);
    return me.organization;
  }, [getAccessToken]);

  useEffect(() => {
    if (loading || !session) {
      return;
    }
    if (isSuperAdmin) {
      setOrgReady(true);
      return;
    }
    void refreshOrganization()
      .then(() => setOrgReady(true))
      .catch(() => setOrgReady(false));
  }, [loading, session, isSuperAdmin, refreshOrganization]);

  const value = useMemo(
    () => ({
      organization,
      memberRole,
      setOrganization,
      refreshOrganization,
    }),
    [organization, memberRole, refreshOrganization],
  );

  if (loading || orgReady === null) {
    return <StudioLayoutLoading />;
  }
  if (!session) {
    return <Navigate to="/login?next=/studio" replace />;
  }
  if (!orgReady) {
    return <Navigate to="/studio/signup" replace />;
  }

  return <StudioOrgContext.Provider value={value}>{children}</StudioOrgContext.Provider>;
}
