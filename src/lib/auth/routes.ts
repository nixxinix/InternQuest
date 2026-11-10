/**
 * Which pages need a signed-in user, and where to send people after login.
 * Used by src/proxy.ts. Pure, so it is unit tested.
 */

/** Intern app screens. Everything else (landing, listings, privacy, company and admin previews) stays public. */
export const PROTECTED_PREFIXES = ["/home", "/search", "/quest-log", "/tips", "/profile", "/settings", "/leaderboard"] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const DEFAULT_AFTER_LOGIN = "/home";

/**
 * Only same-site paths are allowed after login, so a link like
 * /login?next=https://evil.example can't send someone to another site.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || typeof next !== "string") return DEFAULT_AFTER_LOGIN;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return DEFAULT_AFTER_LOGIN;
  // Backslashes and control characters (tabs, newlines) can turn into "//" in some browsers.
  if (next.includes("\\") || [...next].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f)) {
    return DEFAULT_AFTER_LOGIN;
  }
  if (next === "/login" || next.startsWith("/login?") || next.startsWith("/login/")) return DEFAULT_AFTER_LOGIN;
  return next.slice(0, 500);
}

/** The login URL for a protected page, remembering where the visitor was going. */
export function loginRedirect(pathname: string, search: string): string {
  const next = safeNext(`${pathname}${search}`);
  return next === DEFAULT_AFTER_LOGIN ? "/login" : `/login?next=${encodeURIComponent(next)}`;
}
