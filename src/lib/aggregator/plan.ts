/**
 * What the daily refresh does with a batch of imported listings. Pure and
 * unit tested; refresh.ts applies the plan to the database.
 *
 * - The same posting seen again (same source id) is refreshed, not duplicated.
 * - The same job from another source (same dedupe key, SPEC §5.3) is stored
 *   once. A company's direct post or an admin entry always wins over an
 *   aggregator copy, so it's never overwritten, and a copy it superseded
 *   (publishListing hides it) is never refreshed back to life.
 * - Duplicates inside one batch keep the first.
 */
import type { ImportedListing } from "./types";

export type ExistingListing = { id: string; source: string; source_ref: string | null; dedupe_key: string };

export type ImportPlan = {
  insert: ImportedListing[];
  /** Existing rows to refresh, keeping their id (so links and quest log entries stay valid). */
  update: { id: string; listing: ImportedListing }[];
  skipped: { directWins: number; repeatInBatch: number };
};

export function planImport(incoming: ImportedListing[], existing: ExistingListing[]): ImportPlan {
  const bySourceRef = new Map(existing.filter((e) => e.source_ref).map((e) => [`${e.source}:${e.source_ref}`, e]));
  const byDedupe = new Map(existing.map((e) => [e.dedupe_key, e]));
  const byId = new Map(existing.map((e) => [e.id, e]));

  const plan: ImportPlan = { insert: [], update: [], skipped: { directWins: 0, repeatInBatch: 0 } };
  const seen = new Set<string>();

  for (const l of incoming) {
    if (seen.has(l.dedupeKey)) {
      plan.skipped.repeatInBatch += 1;
      continue;
    }
    seen.add(l.dedupeKey);

    // A post from another source already owns this job: it wins, even if we
    // also have our own older copy of it (a company published the same role
    // after we imported it, and our copy was superseded).
    const owner = byDedupe.get(l.dedupeKey);
    if (owner && owner.source !== l.source) {
      plan.skipped.directWins += 1;
      continue;
    }

    const match = bySourceRef.get(`${l.source}:${l.sourceRef}`) ?? owner ?? byId.get(l.id);
    if (!match) {
      plan.insert.push(l);
    } else if (match.source === l.source) {
      plan.update.push({ id: match.id, listing: l });
    } else {
      plan.skipped.directWins += 1;
    }
  }
  return plan;
}
