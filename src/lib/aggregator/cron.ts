/**
 * Scheduled jobs are called by Vercel Cron with "Authorization: Bearer
 * <CRON_SECRET>". Anyone else gets a 401, so the job can't be triggered
 * (and the listings API quota spent) by outsiders.
 */
import { timingSafeEqual } from "node:crypto";

export function cronAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 16 || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
