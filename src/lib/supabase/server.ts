import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { requireSupabaseConfig } from "./env";

/**
 * Supabase for Server Components, Server Actions, and Route Handlers, acting as
 * the signed-in user (row-level security applies). The session lives in cookies.
 */
export async function createServerSupabase() {
  const { url, anonKey } = requireSupabaseConfig();
  const store = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only. The proxy refreshes the session instead.
        }
      },
    },
  });
}

/**
 * Supabase as a visitor (public key, no cookies): for public data such as
 * listings, inside cached functions ("use cache" can't read cookies).
 */
export function createPublicSupabase() {
  const { url, anonKey } = requireSupabaseConfig();
  return createPlainClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Supabase with the service role key: BYPASSES row-level security. Only for
 * server code that must act beyond one user (account creation and deletion,
 * recovery codes, admin actions, scheduled jobs). Never import from a client
 * component; "server-only" makes that a build error.
 */
export function createServiceSupabase() {
  const { url } = requireSupabaseConfig();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing from .env.local.");
  return createPlainClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
