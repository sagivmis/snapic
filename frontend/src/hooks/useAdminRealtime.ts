import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import {
  feedItemFromAuditChange,
  feedItemFromEventChange,
  feedItemFromMatchRunChange,
  feedItemFromSignupChange,
  type AdminLiveFeedItem,
} from "../monitoring/adminLiveFeed";

export type AdminLiveStatus = "offline" | "connecting" | "live";

const REFRESH_DEBOUNCE_MS = 1500;

interface UseAdminRealtimeOptions {
  enabled: boolean;
  onRefresh: () => void | Promise<void>;
  onFeedItem: (item: AdminLiveFeedItem) => void;
}

function handleFeedPayload(
  payload: RealtimePostgresChangesPayload<{ [key: string]: unknown }>,
  mapper: (payload: RealtimePostgresChangesPayload<{ [key: string]: unknown }>) => AdminLiveFeedItem | null,
  onFeedItem: (item: AdminLiveFeedItem) => void,
) {
  const item = mapper(payload);
  if (item) {
    onFeedItem(item);
  }
}

export function useAdminRealtime({
  enabled,
  onRefresh,
  onFeedItem,
}: UseAdminRealtimeOptions): { status: AdminLiveStatus } {
  const [status, setStatus] = useState<AdminLiveStatus>("offline");
  const onRefreshRef = useRef(onRefresh);
  const onFeedItemRef = useRef(onFeedItem);
  const refreshTimerRef = useRef<number | null>(null);

  onRefreshRef.current = onRefresh;
  onFeedItemRef.current = onFeedItem;

  useEffect(() => {
    if (!enabled || !supabase) {
      setStatus("offline");
      return;
    }

    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    function scheduleRefresh() {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        void onRefreshRef.current();
      }, REFRESH_DEBOUNCE_MS);
    }

    setStatus("connecting");

    channel = supabase
      .channel("admin-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "signup_requests" },
        (payload) => {
          handleFeedPayload(payload, feedItemFromSignupChange, (item) => onFeedItemRef.current(item));
          scheduleRefresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        (payload) => {
          handleFeedPayload(payload, feedItemFromEventChange, (item) => onFeedItemRef.current(item));
          scheduleRefresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_log" },
        (payload) => {
          handleFeedPayload(payload, feedItemFromAuditChange, (item) => onFeedItemRef.current(item));
          scheduleRefresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "match_runs" },
        (payload) => {
          handleFeedPayload(payload, feedItemFromMatchRunChange, (item) => onFeedItemRef.current(item));
          scheduleRefresh();
        },
      )
      .subscribe((subscriptionStatus) => {
        if (cancelled) {
          return;
        }
        if (subscriptionStatus === "SUBSCRIBED") {
          setStatus("live");
          return;
        }
        if (subscriptionStatus === "CLOSED" || subscriptionStatus === "CHANNEL_ERROR") {
          setStatus("offline");
        }
      });

    return () => {
      cancelled = true;
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      if (channel && supabase) {
        void supabase.removeChannel(channel);
      }
      setStatus("offline");
    };
  }, [enabled]);

  return { status };
}
