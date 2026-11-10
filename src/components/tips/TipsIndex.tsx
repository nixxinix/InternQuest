"use client";

import Link from "next/link";
import { useFeatures } from "@/components/providers/GameModeProvider";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import { upNext, type GuideMeta } from "@/lib/content/tips";
import { findSampleListing } from "@/lib/sample/listings";
import { ChecklistProgress } from "./Checklist";
import { useTips } from "./TipsShell";

/** W8 Tips index: the guide for your current stage first, then all guides. */
export function TipsIndex({ guides }: { guides: GuideMeta[] }) {
  const f = useFeatures();
  const { viewer } = useTips();
  const interview = viewer.upcoming[0];
  const next = upNext({
    interview: interview ? { company: findSampleListing(interview.listingId)?.company ?? "a company", when: interview.when } : null,
    applicationsOut: viewer.applied.length,
  });
  const nextGuide = guides.find((g) => g.slug === next.slug);
  const nextHref = `/tips/${next.slug}${next.anchor ? `#${next.anchor}` : ""}`;

  return (
    <>
      <h1 className="text-2xl font-semibold lg:text-3xl">Tips</h1>
      <p className="mt-1 max-w-prose text-base text-muted">Short guides for each step, from your resume to the first day.</p>

      {nextGuide && (
        <section aria-labelledby="next-h" className={cn("mt-5 p-4", f.avatar ? "on-bezel" : "border-l-4 border-green bg-screen")}>
          <h2 id="next-h" className={f.avatar ? "font-pixel text-hud uppercase text-lime" : "text-sm font-semibold text-muted"}>
            Up next for you
          </h2>
          <p className={cn("mt-1 text-base", f.avatar ? "text-bezel-text" : "text-muted")}>{next.reason}</p>
          <Link
            href={nextHref}
            className={cn(
              "mt-3 inline-flex min-h-tap items-center gap-2 px-4 font-semibold",
              f.avatar ? "bg-lime text-ink shadow-bevel" : "bg-green text-screen shadow-bevel hover:bg-green-press",
            )}
          >
            {next.anchor === "follow-up" ? "How to follow up" : `Read ${nextGuide.title.toLowerCase()}`}
            <PixelIcon name="chevronRight" scale={2} />
          </Link>
        </section>
      )}

      <h2 className="mt-8 text-xl font-semibold">All guides</h2>
      <ul className="mt-3 grid gap-3 md:grid-cols-3">
        {guides.map((g) => (
          <li key={g.slug}>
            <article
              className={cn(
                "relative flex h-full flex-col border bg-screen p-4",
                g.slug === next.slug ? "border-l-4 border-line border-l-green" : "border-line",
                "has-[.stretched-link:focus-visible]:outline-3 has-[.stretched-link:focus-visible]:outline-offset-2 has-[.stretched-link:focus-visible]:outline-ink",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-semibold">
                  <Link href={`/tips/${g.slug}`} className="stretched-link focus-visible:outline-none">
                    {g.title}
                  </Link>
                </h3>
                {g.slug === next.slug && <Tag className="flex-none font-semibold">Up next</Tag>}
              </div>
              <p className="mt-1 flex-1 text-base text-muted">{g.summary}</p>
              <p className="mt-3 flex flex-wrap gap-x-3 text-sm text-muted">
                <span>{g.readMinutes} min read</span>
                <ChecklistProgress slug={g.slug} ids={g.checklistIds} />
              </p>
            </article>
          </li>
        ))}
      </ul>
    </>
  );
}
