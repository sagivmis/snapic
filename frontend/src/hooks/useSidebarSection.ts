import { useCallback, useState } from "react";
import {
  readSidebarSectionCollapsed,
  writeSidebarSectionCollapsed,
  type SidebarSectionId,
} from "../lib/appSidebarSections";

interface UseSidebarSectionOptions {
  sectionId: SidebarSectionId;
  defaultExpanded: boolean;
  /** When true, section opens automatically unless the user collapsed it manually. */
  hasActiveChild?: boolean;
}

export function useSidebarSection({
  sectionId,
  defaultExpanded,
  hasActiveChild = false,
}: UseSidebarSectionOptions) {
  const [collapsedOverride, setCollapsedOverride] = useState<boolean | null>(() =>
    readSidebarSectionCollapsed(sectionId),
  );

  const expanded =
    collapsedOverride === null ? hasActiveChild || defaultExpanded : !collapsedOverride;

  const toggle = useCallback(() => {
    const nextCollapsed = expanded;
    setCollapsedOverride(nextCollapsed);
    writeSidebarSectionCollapsed(sectionId, nextCollapsed);
  }, [expanded, sectionId]);

  return { expanded, toggle };
}
