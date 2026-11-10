/**
 * Dedupe key for listings (SPEC §5.3): normalized company + title + location,
 * so the same job found through two sources is stored once.
 */

/** Words that don't change which company it is ("Kalye Logistics Inc." = "Kalye Logistics"). */
const COMPANY_SUFFIXES = /\b(inc|corp|corporation|co|company|ltd|llc|opc|phils?|philippines)\b/g;

export function normalizePart(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function dedupeKey(company: string, title: string, area: string): string {
  const c = normalizePart(company).replace(COMPANY_SUFFIXES, " ").replace(/\s+/g, " ").trim();
  // Only the city part of the area: "Cubao, Quezon City" and "Quezon City" are the same place.
  const parts = area.split(",");
  const city = normalizePart(parts[parts.length - 1] ?? area);
  return [c, normalizePart(title), city].join("|");
}
