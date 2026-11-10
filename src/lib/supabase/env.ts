/**
 * Supabase settings from .env.local (documented in .env.example).
 * NEXT_PUBLIC_ values are read with static names so Next can inline them for the browser.
 */

export function supabaseConfig(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

/** Until a project is connected, the app keeps running on the sample data (design preview). */
export function isSupabaseConfigured(): boolean {
  return supabaseConfig() !== null;
}

export function requireSupabaseConfig(): { url: string; anonKey: string } {
  const config = supabaseConfig();
  if (!config) {
    throw new Error(
      "Supabase isn't connected yet. Copy .env.example to .env.local and fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return config;
}
