/**
 * Checking a registering company's website (SPEC §12 admin review: "Website
 * loads"). The pure host check (`isPrivateHost`) is unit tested, so this file
 * is kept free of the "server-only" import (like src/lib/auth/secrets.ts) even
 * though `checkWebsiteLoads` is only ever called from server code in practice.
 */

/**
 * Best-effort guard against our server fetching an internal address
 * (loopback, private ranges, link-local/cloud metadata, .local/.internal).
 * String-based, not a DNS lookup, so it catches the obvious cases, not every
 * way a hostname could resolve to a private address later.
 */
export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (h === "localhost" || h === "0.0.0.0" || h === "::1" || h === "[::1]") return true;
  if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost")) return true;
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map(Number);
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local, including cloud metadata (169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

export type WebsiteCheck = { loads: boolean; checkedAt: string };

/**
 * A quick, best-effort fetch: did anything answer? Never throws; a timeout,
 * a bad certificate, or a private host all come back as "doesn't load".
 */
export async function checkWebsiteLoads(url: string): Promise<WebsiteCheck> {
  const checkedAt = new Date().toISOString();
  try {
    const u = new URL(url);
    if ((u.protocol !== "https:" && u.protocol !== "http:") || isPrivateHost(u.hostname)) {
      return { loads: false, checkedAt };
    }
    const res = await fetch(u.toString(), {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "InternQuestBot/1.0 (+https://internquest.example; checking a company website)" },
    });
    return { loads: res.status < 500, checkedAt };
  } catch {
    return { loads: false, checkedAt };
  }
}
