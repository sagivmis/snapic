import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { clearAnonymousSessionId, getAnonymousSessionId } from "./anonymousSession";
import { clearStudioCaches } from "../lib/studioCache";
import { isSupabaseConfigured, supabase, type Profile } from "../lib/supabase";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isSuperAdmin: boolean;
  isPhotographer: boolean;
  isEventAdmin: boolean;
  signInWithGoogle: (redirectPath?: string) => Promise<void>;
  signInWithMagicLink: (email: string, redirectPath?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  claimAnonymousSessions: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  anonymousSessionId: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error || !data) {
    return null;
  }
  return data as Profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const anonymousSessionId = useMemo(() => getAnonymousSessionId(), []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) {
      setProfile(null);
      return;
    }
    const row = await fetchProfile(session.user.id);
    setProfile(row);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const loginRedirectUrl = useCallback((redirectPath?: string) => {
    const next = redirectPath ?? "/";
    return `${window.location.origin}/login?next=${encodeURIComponent(next)}`;
  }, []);

  const signInWithGoogle = useCallback(async (redirectPath?: string) => {
    if (!supabase) {
      throw new Error("Auth not configured");
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: loginRedirectUrl(redirectPath) },
    });
    if (error) {
      throw error;
    }
  }, [loginRedirectUrl]);

  const signInWithMagicLink = useCallback(async (email: string, redirectPath?: string) => {
    if (!supabase) {
      throw new Error("Auth not configured");
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: loginRedirectUrl(redirectPath) },
    });
    if (error) {
      throw error;
    }
  }, [loginRedirectUrl]);

  const signOut = useCallback(async () => {
    if (!supabase) {
      return;
    }
    await supabase.auth.signOut();
    clearStudioCaches();
    setProfile(null);
  }, []);

  const claimAnonymousSessions = useCallback(async () => {
    if (!supabase || !session) {
      return;
    }
    await supabase.rpc("claim_anonymous_match_runs", {
      p_session_id: anonymousSessionId,
    });
    clearAnonymousSessionId();
  }, [anonymousSessionId, session]);

  const getAccessToken = useCallback(async () => {
    if (!supabase) {
      return null;
    }
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  useEffect(() => {
    // Skip in iframe embeds (guest preview) — avoids duplicate RPCs and parent auth churn.
    if (session && window.self === window.top) {
      void claimAnonymousSessions();
    }
  }, [session, claimAnonymousSessions]);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    isSuperAdmin: profile?.global_role === "super_admin",
    isPhotographer: profile?.global_role === "photographer",
    isEventAdmin:
      profile?.global_role === "event_admin" ||
      profile?.global_role === "photographer" ||
      profile?.global_role === "super_admin",
    signInWithGoogle,
    signInWithMagicLink,
    signOut,
    refreshProfile,
    claimAnonymousSessions,
    getAccessToken,
    anonymousSessionId,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}
