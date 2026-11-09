"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useVocab } from "@/components/providers/GameModeProvider";
import { matchLabel } from "@/lib/game/progress";
import type { MatchBreakdown } from "@/lib/listings/types";
import { PixelIcon } from "./PixelIcon";
import { SegmentBar } from "./SegmentBar";
import { SkillChip } from "./SkillChip";

const RESOURCE_TYPE_LABEL = { video: "Video", course: "Course", article: "Article", docs: "Docs" } as const;

type MatchPanelProps = {
  match: MatchBreakdown;
  /** Resume tips for this listing's field (SPEC §6 "Quick prep"). */
  quickPrepHref: string;
  quickPrepField: string;
  /**
   * Signed in: "I finished this" under each resource. Resolves to an error
   * message, or null when the server accepted it.
   */
  onFinishResource?: (resourceId: string) => Promise<string | null>;
};

/**
 * Full skills fit on the listing detail page: score, why it matched,
 * matched skills, missing skills with 1 to 2 free resources each, and Quick prep.
 */
export function MatchPanel({ match, quickPrepHref, quickPrepField, onFinishResource }: MatchPanelProps) {
  const v = useVocab();
  const headingId = useId();
  const [finished, setFinished] = useState<Record<string, "busy" | "done" | string>>({});

  const finish = async (id: string) => {
    if (!onFinishResource) return;
    setFinished((f) => ({ ...f, [id]: "busy" }));
    const error = await onFinishResource(id);
    setFinished((f) => ({ ...f, [id]: error ?? "done" }));
  };

  return (
    <section aria-labelledby={headingId} className="border border-line bg-screen">
      <div className="on-bezel px-4 py-3">
        <h2 id={headingId} className="font-pixel text-hud uppercase text-lime">
          Skills fit
        </h2>
        <div className="mt-2 flex items-center gap-3">
          <SegmentBar value={match.pct} max={100} surface="bezel" className="flex-1" />
          <p className="whitespace-nowrap font-semibold">
            {match.pct}% <span className="font-normal text-bezel-text">· {matchLabel(match.pct)}</span>
          </p>
        </div>
      </div>

      <div className="space-y-5 p-4">
        <div>
          <h3 className="text-base font-semibold">Why this matched</h3>
          <dl className="mt-2 space-y-2">
            {match.parts.map((part) => (
              <div key={part.key} className="grid grid-cols-[6.5rem_1fr] items-center gap-x-3 gap-y-0.5">
                <dt className="text-sm font-medium">
                  {part.label}
                  <span className="block text-xs font-normal text-muted">
                    {part.score === null ? "not counted" : `${Math.round(part.weight * 100)}% of score`}
                  </span>
                </dt>
                <dd>
                  {part.score === null ? (
                    <div aria-hidden="true" className="h-2 border border-dashed border-muted" />
                  ) : (
                    <SegmentBar value={part.score} max={1} segments={5} height="sm" />
                  )}
                  <span className="mt-1 block text-sm text-muted">{part.detail}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {match.matched.length > 0 && (
          <div>
            <h3 className="text-base font-semibold">{v("skills")} you have</h3>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {match.matched.map((s) => (
                <li key={s}>
                  <SkillChip name={s} state="matched" />
                </li>
              ))}
            </ul>
          </div>
        )}

        {match.missing.length > 0 ? (
          <div>
            <h3 className="text-base font-semibold">{v("missingSkills")}</h3>
            <p className="text-sm text-muted">Free ways to start learning. You can still apply without them.</p>
            <ul className="mt-2 space-y-3">
              {match.missing.map((m) => (
                <li key={m.name} className="border-l-2 border-dashed border-muted pl-3">
                  <SkillChip name={m.name} state="missing" />
                  {m.resources.length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {m.resources.slice(0, 2).map((r) => (
                        <li key={r.id}>
                          <a
                            href={`/learn/${encodeURIComponent(r.id)}`}
                            target="_blank"
                            rel="noopener"
                            className="flex min-h-tap items-start gap-2 py-2.5 text-green"
                          >
                            <span className="mt-0.5 inline-block flex-none bg-canvas px-1.5 text-xs font-semibold text-ink">
                              {RESOURCE_TYPE_LABEL[r.type]}
                            </span>
                            <span className="underline decoration-2 underline-offset-4">
                              {r.title}
                              <PixelIcon name="external" scale={2} className="ml-1.5 inline-block align-baseline" />
                              <span className="sr-only">(opens in a new tab)</span>
                            </span>
                          </a>
                          {onFinishResource && (
                            <div className="-mt-1 pb-1">
                              {finished[r.id] === "done" ? (
                                <p className="flex items-center gap-1.5 text-sm font-semibold text-green">
                                  <PixelIcon name="check" scale={2} /> Marked as finished
                                </p>
                              ) : (
                                <button
                                  type="button"
                                  disabled={finished[r.id] === "busy"}
                                  onClick={() => void finish(r.id)}
                                  className="inline-flex min-h-tap items-center text-sm font-semibold text-ink underline decoration-2 underline-offset-4 disabled:opacity-60"
                                >
                                  I finished this
                                </button>
                              )}
                              {finished[r.id] && finished[r.id] !== "done" && finished[r.id] !== "busy" && (
                                <p role="status" className="text-sm text-alert">
                                  {finished[r.id]}
                                </p>
                              )}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="bg-green-tint px-3 py-2 text-sm text-ink">
            You have every skill this listing asks for.
          </p>
        )}

        <Link
          href={quickPrepHref}
          className="flex min-h-tap items-center justify-between gap-2 bg-canvas px-3 font-semibold text-ink hover:bg-line"
        >
          <span>Quick prep: resume tips for {quickPrepField}</span>
          <PixelIcon name="chevronRight" scale={2} />
        </Link>
      </div>
    </section>
  );
}
