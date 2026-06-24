import type { StudioOrgInvite } from "../api/client";
import type { Organization, StudioClient, StudioStats } from "../types";

interface MembershipCache {
  userId: string;
  organizations: Organization[];
  invites: StudioOrgInvite[];
}

interface DashboardCache {
  orgId: string;
  stats: StudioStats;
  clients: StudioClient[];
  fetchedAt: number;
}

const DASHBOARD_CACHE_TTL_MS = 60_000;

let membershipCache: MembershipCache | null = null;
let dashboardCache: DashboardCache | null = null;

export function getStudioMembershipCache(userId: string): MembershipCache | null {
  if (membershipCache?.userId === userId) {
    return membershipCache;
  }
  return null;
}

export function setStudioMembershipCache(
  userId: string,
  organizations: Organization[],
  invites: StudioOrgInvite[],
): void {
  membershipCache = { userId, organizations, invites };
}

export function clearStudioMembershipCache(): void {
  membershipCache = null;
}

export function getStudioDashboardCache(
  orgId: string,
): { stats: StudioStats; clients: StudioClient[] } | null {
  if (
    dashboardCache?.orgId === orgId &&
    Date.now() - dashboardCache.fetchedAt < DASHBOARD_CACHE_TTL_MS
  ) {
    return { stats: dashboardCache.stats, clients: dashboardCache.clients };
  }
  return null;
}

export function setStudioDashboardCache(
  orgId: string,
  stats: StudioStats,
  clients: StudioClient[],
): void {
  dashboardCache = { orgId, stats, clients, fetchedAt: Date.now() };
}

export function clearStudioDashboardCache(): void {
  dashboardCache = null;
}

export function clearStudioCaches(): void {
  clearStudioMembershipCache();
  clearStudioDashboardCache();
}
