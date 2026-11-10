/**
 * Rate limits for account actions (SPEC §14). Counted in the database
 * (public.take_rate_limit), so they hold across serverless instances.
 *
 * "Network" limits are per IP address. A whole school lab often shares one
 * address, so those are generous; the per-username limits stop guessing.
 * Tune with pilot feedback.
 */
export const RATE_LIMITS = {
  /** Wrong-or-right login tries for one username. */
  login: { max: 10, windowSeconds: 15 * 60 },
  /** Login tries from one network, any username. */
  loginNetwork: { max: 100, windowSeconds: 15 * 60 },
  /** New accounts from one network (a class signing up together fits). */
  signup: { max: 60, windowSeconds: 60 * 60 },
  /** Username availability checks from one network (the form checks as you type). */
  usernameCheck: { max: 300, windowSeconds: 10 * 60 },
  /** Recovery-code tries for one username. Codes are short, so this stays low. */
  recover: { max: 5, windowSeconds: 60 * 60 },
  recoverNetwork: { max: 30, windowSeconds: 60 * 60 },
  /** Password changes (each one checks the current password). */
  password: { max: 5, windowSeconds: 15 * 60 },
  /** Username changes. */
  rename: { max: 5, windowSeconds: 60 * 60 },
  /** New recovery code sets. */
  recoveryCodes: { max: 10, windowSeconds: 60 * 60 },
  /** Map lookups of new places, per user (cached answers don't count). */
  geocode: { max: 20, windowSeconds: 60 * 60 },
  /** Apply clicks logged from one network (more still redirect, just aren't counted). */
  click: { max: 120, windowSeconds: 60 * 60 },
  /** Quest log changes per user: plenty for real use, stops scripted flooding. */
  questLog: { max: 300, windowSeconds: 10 * 60 },
  /** AI helper requests per user (on top of the 5-a-day cap): stops rapid-fire clicks. */
  ai: { max: 10, windowSeconds: 10 * 60 },
  /** Nominatim's policy: at most 1 request per second from the whole app. */
  nominatim: { max: 1, windowSeconds: 1 },
  /** New company accounts from one network. */
  companySignup: { max: 20, windowSeconds: 60 * 60 },
  /** Company login tries, per email and per network (SPEC §14: rate-limit login). */
  companyLogin: { max: 10, windowSeconds: 15 * 60 },
  companyLoginNetwork: { max: 100, windowSeconds: 15 * 60 },
  /** Listing reports, per network (guests can report too) and per listing. */
  report: { max: 20, windowSeconds: 60 * 60 },
  reportListing: { max: 10, windowSeconds: 24 * 60 * 60 },
} as const;

export type RateLimitKind = keyof typeof RATE_LIMITS;

export function rateLimitBucket(kind: RateLimitKind, subject: string): string {
  return `${kind}:${subject}`.slice(0, 200);
}

export const TOO_MANY_TRIES = "Too many tries. Wait a few minutes, then try again.";
