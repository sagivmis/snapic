/** Registry of collapsible sidebar sections — add new sections here. */
export type SidebarSectionId = "studio" | "your-events";

export interface SidebarSectionConfig {
  id: SidebarSectionId;
  title: string;
  /** Expanded on first visit when no saved preference exists. */
  defaultExpanded: boolean;
  /** Allow the body to scroll independently (long lists). */
  scrollable?: boolean;
}

export const APP_SIDEBAR_SECTIONS = {
  studio: {
    id: "studio",
    title: "Studio",
    defaultExpanded: true,
  },
  yourEvents: {
    id: "your-events",
    title: "Your events",
    defaultExpanded: false,
    scrollable: true,
  },
} as const satisfies Record<string, SidebarSectionConfig>;

const STORAGE_KEY = "snapic_sidebar_sections";

export function readSidebarSectionCollapsed(sectionId: SidebarSectionId): boolean | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    if (typeof parsed[sectionId] !== "boolean") {
      return null;
    }
    return parsed[sectionId];
  } catch {
    return null;
  }
}

export function writeSidebarSectionCollapsed(sectionId: SidebarSectionId, collapsed: boolean): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    parsed[sectionId] = collapsed;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore storage errors
  }
}
