import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useStudioMembership } from "./useStudioMembership";
import { eventManagePath, useUserEvents } from "./useUserEvents";
import { isSupabaseConfigured } from "../lib/supabase";

export type MobileTabId = "home" | "studio" | "gallery" | "demo" | "more";

export interface MobileTab {
  id: MobileTabId;
  labelKey: string;
  to?: string;
  opensPicker?: boolean;
  opensMore?: boolean;
}

export interface MobileSheetLink {
  to: string;
  labelKey?: string;
  label?: string;
  namespace?: "nav" | "studio.nav";
  badge?: number;
  end?: boolean;
}

export interface MobileSheetSection {
  titleKey?: string;
  links: MobileSheetLink[];
}

const STUDIO_SUB_LINKS: MobileSheetLink[] = [
  { to: "/studio/clients", labelKey: "clients", namespace: "studio.nav" },
  { to: "/studio/settings", labelKey: "settings", namespace: "studio.nav" },
  { to: "/studio/team", labelKey: "team", namespace: "studio.nav" },
  { to: "/studio/billing", labelKey: "billing", namespace: "studio.nav" },
];

export function useShowMobileChrome(pathname: string): boolean {
  return !/^\/e\/[^/]+$/.test(pathname);
}

export function useMobileNav() {
  const location = useLocation();
  const { session, isSuperAdmin, isPhotographer } = useAuth();
  const { hasStudios, pendingInvites, organizations, loaded } = useStudioMembership();
  const { events, hasEvents } = useUserEvents();

  const showStudioNav = isSuperAdmin || isPhotographer || hasStudios || pendingInvites.length > 0;
  const showForPhotographers = isSupabaseConfigured && loaded && !hasStudios;
  const showChrome = useShowMobileChrome(location.pathname);

  const galleryPath = events.length === 1 ? eventManagePath(events[0]) : undefined;

  const tabs = useMemo((): MobileTab[] => {
    const items: MobileTab[] = [{ id: "home", labelKey: "home", to: "/" }];

    if (showStudioNav) {
      items.push({ id: "studio", labelKey: "studio", to: "/studio" });
    }

    if (session && hasEvents) {
      items.push({
        id: "gallery",
        labelKey: "gallery",
        to: galleryPath,
        opensPicker: events.length > 1,
      });
    }

    if (session) {
      items.push({ id: "more", labelKey: "more", opensMore: true });
    } else {
      items.push({ id: "demo", labelKey: "demo", to: "/demo" });
      items.push({ id: "more", labelKey: "more", opensMore: true });
    }

    return items.slice(0, 4);
  }, [session, showStudioNav, hasEvents, galleryPath, events.length]);

  function isTabActive(tab: MobileTab): boolean {
    const path = location.pathname;
    switch (tab.id) {
      case "home":
        return path === "/";
      case "studio":
        return path.startsWith("/studio") && !path.startsWith("/studio/signup");
      case "gallery":
        return events.some((event) => path.startsWith(`/e/${event.slug}`));
      case "demo":
        return path === "/demo" || path.startsWith("/demo/");
      default:
        return false;
    }
  }

  const sheetSections = useMemo((): MobileSheetSection[] => {
    const sections: MobileSheetSection[] = [];

    if (session && events.length > 0) {
      sections.push({
        titleKey: "yourEvents",
        links: events.map((event) => ({
          to: eventManagePath(event),
          label: event.title,
        })),
      });
    }

    if (showStudioNav) {
      const studioLinks = [...STUDIO_SUB_LINKS];
      if (organizations.length > 1) {
        studioLinks.unshift({ to: "/studio/select", labelKey: "switchStudio" });
      }
      if (pendingInvites.length > 0) {
        studioLinks.unshift({
          to: "/studio/select",
          labelKey: "pendingInvites",
          badge: pendingInvites.length,
        });
      }
      sections.push({ titleKey: "studio", links: studioLinks });
    }

    const secondary: MobileSheetLink[] = [];
    if (isSupabaseConfigured) {
      secondary.push({ to: "/request-access", labelKey: "requestGallery" });
    }
    if (showForPhotographers) {
      secondary.push({ to: "/for-photographers", labelKey: "forPhotographers" });
    }
    if (session) {
      secondary.push({ to: "/demo", labelKey: "tryDemo", end: true });
    }
    if (secondary.length > 0) {
      sections.push({ links: secondary });
    }

    if (isSuperAdmin) {
      sections.push({
        links: [{ to: "/admin", labelKey: "adminDashboard", end: true }],
      });
    }

    return sections;
  }, [
    session,
    events,
    showStudioNav,
    organizations.length,
    pendingInvites.length,
    showForPhotographers,
    isSuperAdmin,
  ]);

  return {
    showChrome,
    tabs,
    isTabActive,
    sheetSections,
    events,
    galleryPath,
  };
}
