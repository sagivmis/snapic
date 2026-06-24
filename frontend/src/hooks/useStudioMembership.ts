import { useEffect, useState } from "react";
import { fetchStudioInvites, fetchStudioOrganizations, type StudioOrgInvite } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { getStudioMembershipCache, setStudioMembershipCache } from "../lib/studioCache";
import type { Organization } from "../types";

export function useStudioMembership() {
  const { session, getAccessToken } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [pendingInvites, setPendingInvites] = useState<StudioOrgInvite[]>([]);
  const [loaded, setLoaded] = useState(!session);

  useEffect(() => {
    if (!session) {
      setOrganizations([]);
      setPendingInvites([]);
      setLoaded(true);
      return;
    }

    const userId = session.user.id;
    const cached = getStudioMembershipCache(userId);
    if (cached) {
      setOrganizations(cached.organizations);
      setPendingInvites(cached.invites);
      setLoaded(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token || cancelled) {
          if (!cancelled) {
            setLoaded(true);
          }
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
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, getAccessToken]);

  return {
    organizations,
    pendingInvites,
    hasStudios: organizations.length > 0,
    loaded,
  };
}
