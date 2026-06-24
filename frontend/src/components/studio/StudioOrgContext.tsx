import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  fetchStudioInvites,
  fetchStudioMe,
  fetchStudioOrganizations,
  type StudioOrgInvite,
} from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { getStoredStudioOrgId, setStoredStudioOrgId } from "../../lib/studioOrg";
import type { Organization } from "../../types";
import { StudioLayoutLoading } from "./StudioSkeletons";

interface StudioOrgContextValue {
  organization: Organization | null;
  organizations: Organization[];
  pendingInvites: StudioOrgInvite[];
  memberRole: string | null;
  activeOrgId: string | null;
  setActiveOrgId: (orgId: string) => void;
  setOrganization: (org: Organization) => void;
  refreshOrganization: () => Promise<Organization | null>;
  refreshMembership: () => Promise<void>;
}

const StudioOrgContext = createContext<StudioOrgContextValue | null>(null);

export function useStudioOrg(): StudioOrgContextValue {
  const value = useContext(StudioOrgContext);
  if (!value) {
    throw new Error("useStudioOrg must use StudioOrgProvider");
  }
  return value;
}

function resolveOrgSelection(organizations: Organization[]): {
  orgId: string | null;
  needsPicker: boolean;
} {
  if (organizations.length === 0) {
    return { orgId: null, needsPicker: false };
  }
  const stored = getStoredStudioOrgId();
  if (stored && organizations.some((org) => org.id === stored)) {
    return { orgId: stored, needsPicker: false };
  }
  if (organizations.length === 1) {
    return { orgId: organizations[0].id, needsPicker: false };
  }
  return { orgId: null, needsPicker: true };
}

export function StudioOrgProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { getAccessToken, loading, session, isSuperAdmin } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [pendingInvites, setPendingInvites] = useState<StudioOrgInvite[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [memberRole, setMemberRole] = useState<string | null>(null);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);
  const [gateReady, setGateReady] = useState<boolean | null>(null);

  const setActiveOrgId = useCallback(
    (orgId: string) => {
      setStoredStudioOrgId(orgId);
      setActiveOrgIdState(orgId);
      void getAccessToken().then((token) => {
        if (!token) {
          return;
        }
        void fetchStudioMe(token, orgId).then((me) => {
          setOrganization(me.organization);
          setMemberRole(me.member_role);
        });
      });
    },
    [getAccessToken],
  );

  const refreshMembership = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      return;
    }
    const [orgs, invites] = await Promise.all([
      fetchStudioOrganizations(token),
      fetchStudioInvites(token),
    ]);
    setOrganizations(orgs);
    setPendingInvites(invites);
    return;
  }, [getAccessToken]);

  const refreshOrganization = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      return null;
    }
    const orgId = activeOrgId ?? getStoredStudioOrgId();
    if (!orgId) {
      return null;
    }
    const me = await fetchStudioMe(token, orgId);
    setOrganization(me.organization);
    setMemberRole(me.member_role);
    return me.organization;
  }, [activeOrgId, getAccessToken]);

  useEffect(() => {
    if (loading || !session) {
      return;
    }
    if (isSuperAdmin) {
      setGateReady(true);
      return;
    }

    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          setGateReady(false);
          return;
        }
        const [orgs, invites] = await Promise.all([
          fetchStudioOrganizations(token),
          fetchStudioInvites(token),
        ]);
        setOrganizations(orgs);
        setPendingInvites(invites);

        if (orgs.length === 0 && invites.length === 0) {
          setGateReady(false);
          return;
        }

        const { orgId, needsPicker } = resolveOrgSelection(orgs);

        if (needsPicker || (orgs.length === 0 && invites.length > 0)) {
          setGateReady(true);
          if (location.pathname !== "/studio/select") {
            navigate("/studio/select", { replace: true });
          }
          return;
        }

        if (!orgId) {
          setGateReady(false);
          return;
        }
        setStoredStudioOrgId(orgId);
        setActiveOrgIdState(orgId);
        const me = await fetchStudioMe(token, orgId);
        setOrganization(me.organization);
        setMemberRole(me.member_role);
        setGateReady(true);
      } catch {
        setGateReady(false);
      }
    })();
  }, [loading, session, isSuperAdmin, getAccessToken, navigate, location.pathname]);

  const value = useMemo(
    () => ({
      organization,
      organizations,
      pendingInvites,
      memberRole,
      activeOrgId,
      setActiveOrgId,
      setOrganization,
      refreshOrganization,
      refreshMembership,
    }),
    [
      organization,
      organizations,
      pendingInvites,
      memberRole,
      activeOrgId,
      setActiveOrgId,
      refreshOrganization,
      refreshMembership,
    ],
  );

  if (loading || gateReady === null) {
    return <StudioLayoutLoading />;
  }
  if (!session) {
    return <Navigate to="/login?next=/studio" replace />;
  }
  if (!isSuperAdmin && gateReady === false) {
    return <Navigate to="/studio/signup" replace />;
  }

  return <StudioOrgContext.Provider value={value}>{children}</StudioOrgContext.Provider>;
}
