"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseConfig } from "./env";

/** Supabase in the browser: only the public anon key; row-level security protects the data. */
export function createBrowserSupabase() {
  const { url, anonKey } = requireSupabaseConfig();
  return createBrowserClient(url, anonKey);
}
