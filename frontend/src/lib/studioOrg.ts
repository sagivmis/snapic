export const STUDIO_ORG_STORAGE_KEY = "snapic_studio_org_id";

export function getStoredStudioOrgId(): string | null {
  try {
    return localStorage.getItem(STUDIO_ORG_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredStudioOrgId(orgId: string | null): void {
  try {
    if (orgId) {
      localStorage.setItem(STUDIO_ORG_STORAGE_KEY, orgId);
    } else {
      localStorage.removeItem(STUDIO_ORG_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}
