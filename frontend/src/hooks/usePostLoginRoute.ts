import { useAuth } from "../auth/AuthProvider";
import { useStudioMembership } from "./useStudioMembership";
import { eventManagePath, useUserEvents } from "./useUserEvents";

export type PostLoginDestinationKind =
  | "admin"
  | "couple-onboarding"
  | "couple-home"
  | "studio"
  | "studio-select"
  | "landing";

export interface PostLoginDestination {
  path: string;
  kind: PostLoginDestinationKind;
  loaded: boolean;
}

/**
 * Resolves the best route to send an authenticated user to immediately after
 * login (or when they hit the landing page while signed in). Priority order
 * mirrors the role assumptions in the UX plan: super_admin > couple needing
 * onboarding > existing event member > studio member.
 */
export function usePostLoginRoute(): PostLoginDestination {
  const { session, isSuperAdmin, isPhotographer } = useAuth();
  const { hasStudios, pendingInvites, organizations, loaded: studioLoaded } =
    useStudioMembership();
  const { events, loading: eventsLoading } = useUserEvents();

  if (!session) {
    return { path: "/", kind: "landing", loaded: true };
  }

  if (isSuperAdmin) {
    return { path: "/admin", kind: "admin", loaded: true };
  }

  const loaded = !eventsLoading && studioLoaded;

  const onboardingEvent = events.find(
    (event) => event.is_admin && event.needs_onboarding,
  );
  if (onboardingEvent) {
    return {
      path: eventManagePath(onboardingEvent),
      kind: "couple-onboarding",
      loaded,
    };
  }

  const adminEvent = events.find((event) => event.is_admin);
  if (adminEvent) {
    return {
      path: eventManagePath(adminEvent),
      kind: "couple-home",
      loaded,
    };
  }

  if (isPhotographer || hasStudios || pendingInvites.length > 0) {
    const goesToSelect = organizations.length > 1 || pendingInvites.length > 0;
    return {
      path: goesToSelect ? "/studio/select" : "/studio",
      kind: goesToSelect ? "studio-select" : "studio",
      loaded,
    };
  }

  if (events.length > 0) {
    return {
      path: eventManagePath(events[0]),
      kind: "couple-home",
      loaded,
    };
  }

  return { path: "/", kind: "landing", loaded };
}
