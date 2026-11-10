"use client";

import Link from "next/link";
import type { Ref } from "react";
import { ApplyButton, FullPostingLink, ReportButton } from "@/components/listing/ListingActions";
import { Button } from "@/components/ui/Button";
import { MatchPanel } from "@/components/ui/MatchPanel";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { Tag } from "@/components/ui/Tag";
import type { City } from "@/lib/catalog/cities";
import { FIELDS, fieldLabel } from "@/lib/catalog/fields";
import { deadlineText, formatKm, postedText, toBreakdown } from "@/lib/listings/present";
import { SOURCE_LABEL, WORK_TYPE_LABEL } from "@/lib/listings/types";
import type { MatchResult } from "@/lib/matching/score";
import type { SampleListing } from "@/lib/sample/listings";

type ListingPanelProps = {
  listing: SampleListing;
  match: MatchResult | null;
  city: City | null;
  saved: boolean;
  onToggleSave: (id: string) => void;
  /** Signed in: "I finished this" under learning resources. */
  onFinishResource?: (resourceId: string) => Promise<string | null>;
  onEmail: () => void;
  /** The full detail page, for opening in a new tab or sharing. */
  detailHref: string;
  headingRef?: Ref<HTMLHeadingElement>;
};

/**
 * Desktop Search's right-hand panel (W4): the listing detail without leaving
 * the results. Same content order as the detail page (W5).
 */
export function ListingPanel({ listing, match, city, saved, onToggleSave, onFinishResource, onEmail, detailHref, headingRef }: ListingPanelProps) {
  const due = deadlineText(listing.deadlineInDays);
  const shortField = FIELDS.find((f) => f.id === listing.field)?.short ?? fieldLabel(listing.field);
  const where = [listing.area, match?.distanceKm != null ? formatKm(match.distanceKm) : null].filter(Boolean).join(" · ");

  const facts = [
    { label: "Where", value: where },
    { label: "Work type", value: WORK_TYPE_LABEL[listing.workType] },
    { label: "Allowance", value: listing.allowance ?? "Not stated" },
    { label: "OJT hours", value: listing.hours ? `${listing.hours} hours` : "Not stated" },
    { label: "School MOA", value: listing.moa ? "Can sign one" : "Not offered" },
  ];

  return (
    <article aria-labelledby={`panel-${listing.id}`} className="space-y-4">
      <div className="border border-line bg-screen p-5">
        <p className="text-sm font-semibold text-muted">{fieldLabel(listing.field)}</p>
        <h2 id={`panel-${listing.id}`} ref={headingRef} tabIndex={-1} className="mt-1 text-2xl font-semibold focus-visible:outline-none">
          {listing.title}
        </h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-lg">
          <span>{listing.company}</span>
          {listing.verified && <Tag tone="verified">Verified</Tag>}
        </p>
        <p className="mt-1 text-sm text-muted">
          {SOURCE_LABEL[listing.source]} · {postedText(listing.postedDaysAgo)}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-px border border-line bg-line">
          {facts.map((f) => (
            <div key={f.label} className={f.label === "Where" ? "col-span-2 bg-screen p-2.5" : "bg-screen p-2.5"}>
              <dt className="text-xs text-muted">{f.label}</dt>
              <dd className="text-sm font-semibold">{f.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex gap-2">
          <ApplyButton listing={listing} onEmail={onEmail} className="flex-1" />
          <Button
            variant="secondary"
            size="lg"
            icon={<PixelIcon name={saved ? "bookmarkFilled" : "bookmark"} scale={2} />}
            onClick={() => onToggleSave(listing.id)}
          >
            {saved ? "Saved" : "Save"}
          </Button>
        </div>
        {due && (
          <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-alert">
            <PixelIcon name="clock" scale={2} />
            {due}
          </p>
        )}
      </div>

      {match ? (
        <MatchPanel
          match={toBreakdown(listing, match, city)}
          quickPrepHref={`/tips/resume#${listing.field}`}
          quickPrepField={`${shortField} roles`}
          onFinishResource={onFinishResource}
        />
      ) : (
        <p className="border border-line bg-screen p-4 text-base">
          Add skills to your profile to see how well you fit.{" "}
          <Link href="/profile" className="font-semibold text-green underline decoration-2 underline-offset-4">
            Edit my skills
          </Link>
        </p>
      )}

      <section aria-labelledby={`about-${listing.id}`} className="border border-line bg-screen p-5">
        <h3 id={`about-${listing.id}`} className="text-lg font-semibold">
          About this internship
        </h3>
        <p className="mt-2 text-base">{listing.snippet}</p>
        {listing.source === "jsearch" && (
          <p className="mt-2 text-sm text-muted">A short preview found through JSearch. The full posting is on the company&apos;s site.</p>
        )}
        <div className="mt-1 flex flex-wrap gap-x-4">
          <FullPostingLink listing={listing} />
          <Link
            href={detailHref}
            className="inline-flex min-h-tap items-center gap-1 font-semibold text-green underline-offset-4 hover:underline"
          >
            Open full page <PixelIcon name="chevronRight" scale={2} />
          </Link>
        </div>
      </section>

      <aside aria-label="Safety" className="border-l-4 border-ink bg-screen p-4">
        <p className="flex items-start gap-2 font-semibold">
          <PixelIcon name="shield" scale={2} className="mt-1 text-ink [--sprite-accent:var(--color-line)]" />
          Real internships never ask you to pay.
        </p>
        <div className="mt-1">
          <ReportButton listingId={listing.id} listingTitle={listing.title} />
        </div>
      </aside>
    </article>
  );
}
