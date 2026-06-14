import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL ?? "";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey)
  : null;

export type GlobalRole = "super_admin" | "event_admin" | "guest";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  global_role: GlobalRole;
}
