"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { cn } from "@/lib/cn";
import { useVocab } from "@/components/providers/GameModeProvider";
import { SOURCE_LABEL, WORK_TYPE_LABEL, type ListingSummary } from "@/lib/listings/types";
import { IconButton } from "./Button";
import { PixelIcon } from "./PixelIcon";
import { SegmentBar } from "./SegmentBar";
import { SkillChip } from "./SkillChip";
import { Tag } from "./Tag";

type ListingCardProps = {
  listing: ListingSummary;
  href: string;
  saved?: boolean;
  onToggleSave?: (id: string) => void;
  /** Visually marks the top result. */
  featured?: boolean;
  /** Highlights the card whose detail is open in the desktop side panel. */
  selected?: boolean;
  /** Lets Search open the listing in its side panel on desktop instead of navigating. */
  onOpen?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

const MAX_CHIPS = 3;

/**
 * A listing in a results list. The whole card opens the detail page (a
 * stretched link). Save is a separate button above that link. The skills fit
 * is readable without opening anything. Before the visitor picks skills
 * (match is null), the card lists the skills the listing asks for instead.
 */
export function ListingCard({ listing, href, saved = false, onToggleSave, featured, selected, onOpen }: ListingCardProps) {
  const v = useVocab();
  const { match } = listing;

  const meta = [
    listing.area,
    listing.distanceKm !== null ? formatKm(listing.distanceKm) : null,
    WORK_TYPE_LABEL[listing.workType],
    listing.allowance,
  ].filter(Boolean);

  return (
    <article
      className={cn(
        "relative border bg-screen p-4",
        featured ? "border-l-4 border-line border-l-green" : "border-line",
        selected && "outline-3 -outline-offset-3 outline-green",
        "has-[.stretched-link:focus-visible]:outline-3 has-[.stretched-link:focus-visible]:outline-offset-2 has-[.stretched-link:focus-visible]:outline-ink",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-semibold">
          <Link
            href={href}
            onClick={onOpen}
            aria-current={selected ? "true" : undefined}
            className="stretched-link focus-visible:outline-none"
          >
            {listing.title}
          </Link>
        </h3>
        {onToggleSave && (
          <IconButton
            label={saved ? `Remove ${listing.title} from saved` : `Save ${listing.title}`}
            aria-pressed={saved}
            onClick={() => onToggleSave(listing.id)}
            className={cn("relative z-10 -mr-2 -mt-2", saved ? "text-green" : "text-muted")}
          >
            <PixelIcon name={saved ? "bookmarkFilled" : "bookmark"} scale={3} />
          </IconButton>
        )}
      </div>

      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-base">
        <span>{listing.company}</span>
        {listing.verified && <Tag tone="verified">Verified</Tag>}
      </p>
      <p className="mt-0.5 flex items-start gap-1.5 text-sm text-muted">
        <PixelIcon name="pin" scale={2} className="mt-0.5" />
        <span>{meta.join(" · ")}</span>
      </p>

      {match ? (
        <>
          <div className="mt-3 flex items-center gap-3">
            <SegmentBar value={match.pct} max={100} className="flex-1" />
            <span className="whitespace-nowrap text-sm font-semibold">{match.pct}% match</span>
          </div>
          <MatchChips
            matched={match.matched}
            missing={match.missing}
            missingNice={match.missingNice ?? []}
            skillsLabel={v("skills")}
            missingLabel={v("missingSkills")}
          />
        </>
      ) : (
        listing.skills &&
        listing.skills.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-muted">Skills asked for</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {listing.skills.slice(0, MAX_CHIPS + 1).map((s) => (
                <li key={s}>
                  <SkillChip name={s} state="neutral" />
                </li>
              ))}
            </ul>
          </div>
        )
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <Tag tone="source">{SOURCE_LABEL[listing.source]}</Tag>
        {listing.deadlineText ? (
          <Tag tone="deadline">{listing.deadlineText}</Tag>
        ) : listing.postedText ? (
          <span className="text-muted">{listing.postedText}</span>
        ) : null}
      </div>
    </article>
  );
}

function MatchChips({
  matched,
  missing,
  missingNice,
  skillsLabel,
  missingLabel,
}: {
  matched: string[];
  missing: string[];
  missingNice: string[];
  skillsLabel: string;
  missingLabel: string;
}) {
  const shown = matched.slice(0, MAX_CHIPS);
  const more = matched.length - shown.length;
  if (shown.length === 0 && missing.length === 0 && missingNice.length === 0) return null;
  return (
    <div className="mt-3 space-y-2">
      {shown.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={`${skillsLabel} you have`}>
          {shown.map((s) => (
            <li key={s}>
              <SkillChip name={s} state="matched" />
            </li>
          ))}
          {more > 0 && <li className="self-center text-sm text-muted">+{more} more</li>}
        </ul>
      )}
      {missing.length > 0 && (
        <div>
          <p className="text-xs text-muted">{missingLabel}</p>
          <ul className="mt-1 flex flex-wrap gap-1.5" aria-label={missingLabel}>
            {missing.map((s) => (
              <li key={s}>
                <SkillChip name={s} state="missing" />
              </li>
            ))}
          </ul>
        </div>
      )}
      {missingNice.length > 0 && (
        <p className="text-sm text-muted">
          <span className="font-semibold">Nice to have:</span> {missingNice.join(", ")}
        </p>
      )}
    </div>
  );
}

function formatKm(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/** Loading placeholder with the same footprint as a ListingCard. */
export function ListingCardSkeleton() {
  return (
    <div aria-hidden="true" className="border border-line bg-screen p-4">
      <div className="h-5 w-3/4 animate-shimmer bg-line" />
      <div className="mt-2 h-4 w-1/2 animate-shimmer bg-line" />
      <div className="mt-2 h-3 w-2/3 animate-shimmer bg-line" />
      <div className="mt-4 h-3 w-full animate-shimmer bg-line" />
      <div className="mt-3 flex gap-1.5">
        <div className="h-6 w-16 animate-shimmer bg-line" />
        <div className="h-6 w-20 animate-shimmer bg-line" />
        <div className="h-6 w-14 animate-shimmer bg-line" />
      </div>
    </div>
  );
}
