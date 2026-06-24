import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import {
  clearStudioDashboardCache,
  clearStudioMembershipCache,
  getStudioMembershipCache,
  setStudioMembershipCache,
} from "../../lib/studioCache";
import { getStoredStudioOrgId, setStoredStudioOrgId } from "../../lib/studioOrg";
import type { Organization } from "../../types";
import { StudioLayoutLoading, StudioSelectLoading } from "./StudioSkeletons";

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

function applyOrgFromList(organizations: Organization[], orgId: string): Organization | null {
  return organizations.find((org) => org.id === orgId) ?? null;
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
  const [membershipLoaded, setMembershipLoaded] = useState(false);
  const [gateReady, setGateReady] = useState<boolean | null>(null);
  const membershipUserIdRef = useRef<string | null>(null);

  const syncActiveOrg = useCallback((orgs: Organization[], orgId: string) => {
    setStoredStudioOrgId(orgId);
    setActiveOrgIdState(orgId);
    const org = applyOrgFromList(orgs, orgId);
    if (org) {
      setOrganization(org);
      setMemberRole(org.member_role ?? null);
    }
  }, []);

  const setActiveOrgId = useCallback(
    (orgId: string) => {
      clearStudioDashboardCache();
      syncActiveOrg(organizations, orgId);
      const org = applyOrgFromList(organizations, orgId);
      if (org) {
        return;
      }
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
    [getAccessToken, organizations, syncActiveOrg],
  );

  const refreshMembership = useCallback(async () => {
    const token = await getAccessToken();
    const userId = session?.user.id;
    if (!token || !userId) {
      return;
    }
    clearStudioMembershipCache();
    const [orgs, invites] = await Promise.all([
      fetchStudioOrganizations(token),
      fetchStudioInvites(token),
    ]);
    setStudioMembershipCache(userId, orgs, invites);
    setOrganizations(orgs);
    setPendingInvites(invites);
  }, [getAccessToken, session?.user.id]);

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
    if (loading) {
      return;
    }
    if (!session) {
      membershipUserIdRef.current = null;
      setMembershipLoaded(false);
      setGateReady(null);
      return;
    }
    if (isSuperAdmin) {
      setGateReady(true);
      return;
    }

    const userId = session.user.id;
    if (membershipUserIdRef.current !== userId) {
      membershipUserIdRef.current = userId;
      setMembershipLoaded(false);
      setGateReady(null);
    }

    let cancelled = false;

    void (async () => {
      try {
        const cached = getStudioMembershipCache(userId);
        if (cached) {
          if (cancelled) {
            return;
          }
          setOrganizations(cached.organizations);
          setPendingInvites(cached.invites);
          setMembershipLoaded(true);
          return;
        }

        const token = await getAccessToken();
        if (!token || cancelled) {
          return;
        }

        const [orgs, invites] = await Promise.all([
          fetchStudioOrganizations(token),
          fetchStudioInvites(token),
        ]);
        if (cancelled) {
          return;
        }

        setStudioMembershipCache(userId, orgs, invites);
        setOrganizations(orgs);
        setPendingInvites(invites);
        setMembershipLoaded(true);
      } catch {
        if (!cancelled) {
          setGateReady(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, session, isSuperAdmin, getAccessToken]);

  useEffect(() => {
    if (loading || !session || isSuperAdmin || !membershipLoaded) {
      return;
    }

    const orgs = organizations;
    const invites = pendingInvites;

    if (orgs.length === 0 && invites.length === 0) {
      setGateReady(false);
      return;
    }

    const onSelectPage = location.pathname === "/studio/select";
    const mustChoose = orgs.length > 1 || invites.length > 0;
    const { orgId } = resolveOrgSelection(orgs);

    if (onSelectPage && mustChoose) {
      setGateReady(true);
      return;
    }

    if (!mustChoose && orgId) {
      if (onSelectPage) {
        navigate("/studio", { replace: true });
        return;
      }
      syncActiveOrg(orgs, orgId);
      setGateReady(true);
      return;
    }

    if (mustChoose && !orgId) {
      setGateReady(true);
      if (!onSelectPage) {
        navigate("/studio/select", { replace: true });
      }
      return;
    }

    if (mustChoose && orgId) {
      if (!onSelectPage) {
        syncActiveOrg(orgs, orgId);
      }
      setGateReady(true);
      return;
    }

    if (!orgId) {
      setGateReady(false);
      return;
    }

    syncActiveOrg(orgs, orgId);
    setGateReady(true);
  }, [
    loading,
    session,
    isSuperAdmin,
    membershipLoaded,
    organizations,
    pendingInvites,
    location.pathname,
    navigate,
    syncActiveOrg,
  ]);

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
    return location.pathname === "/studio/select" ? <StudioSelectLoading /> : <StudioLayoutLoading />;
  }
  if (!session) {
    return <Navigate to="/login?next=/studio" replace />;
  }
  if (!isSuperAdmin && gateReady === false) {
    return <Navigate to="/studio/signup" replace />;
  }

  return <StudioOrgContext.Provider value={value}>{children}</StudioOrgContext.Provider>;
}
