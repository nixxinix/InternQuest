import "server-only";

/** The site's own address, for links inside emails. Set SITE_URL once there's a real domain. */
export function siteOrigin(): string {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
