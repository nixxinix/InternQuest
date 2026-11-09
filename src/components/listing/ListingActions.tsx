"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { MatchPanel } from "@/components/ui/MatchPanel";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { cn } from "@/lib/cn";
import { canonicalSkill, skillName } from "@/lib/catalog/skills";
import { MAX_SKILLS, picksQuery, readPicks, withQuery } from "@/lib/listings/picks";
import { deadlineText, toBreakdown } from "@/lib/listings/present";
import { DEFAULT_RADIUS_KM } from "@/lib/matching/config";
import { scoreListing } from "@/lib/matching/score";
import { isClosed, type SampleListing } from "@/lib/sample/listings";
import { ApplyReturnSheet, EmailApplySheet, GuestSaveSheet, ReportSheet } from "./ListingSheets";
import { markApplyClicked, usePendingApplyPrompt } from "./usePendingApply";

/* ------------------------------------------------------------------------ */
/* Apply button: link (via /go/:id in a new tab), email (sheet), or closed   */
/* ------------------------------------------------------------------------ */

export function sendClickBeacon(id: string) {
  try {
    navigator.sendBeacon?.(`/go/${encodeURIComponent(id)}`);
  } catch {
    // Logging is best effort; applying must never fail because of it.
  }
}

const APPLY_CLASS =
  "inline-flex min-h-12 items-center justify-center gap-2 bg-green px-6 text-lg font-semibold text-screen shadow-bevel hover:bg-green-press active:translate-y-px active:shadow-bevel-pressed";

export function ApplyButton({ listing, onEmail, className }: { listing: SampleListing; onEmail: () => void; className?: string }) {
  if (isClosed(listing)) {
    return (
      <Button size="lg" disabled className={className}>
        Closed
      </Button>
    );
  }
  if (listing.apply.kind === "email") {
    return (
      <button type="button" onClick={onEmail} className={cn(APPLY_CLASS, className)}>
        Apply by email
      </button>
    );
  }
  return (
    <a
      href={`/go/${encodeURIComponent(listing.id)}`}
      target="_blank"
      rel="noopener"
      onClick={() => markApplyClicked(listing)}
      className={cn(APPLY_CLASS, className)}
    >
      Apply
      <PixelIcon name="external" scale={2} />
      <span className="sr-only">(opens the company&apos;s site in a new tab)</span>
    </a>
  );
}

/* ------------------------------------------------------------------------ */
/* Main island                                                               */
/* ------------------------------------------------------------------------ */

export function ListingActions({
  listing,
  quickPrepField,
  fieldShort,
}: {
  listing: SampleListing;
  quickPrepField: string;
  fieldShort: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const picks = readPicks(params);
  const query = picksQuery(picks);
  const startHref = withQuery("/start", query);

  const [emailOpen, setEmailOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [editSkills, setEditSkills] = useState(false);
  const { prompt, dismiss } = usePendingApplyPrompt();

  const closed = isClosed(listing);
  const subject = `OJT application: ${listing.title}`;

  const match =
    picks.skills.length > 0
      ? scoreListing(
          {
            skills: picks.skills,
            fields: picks.field ? [picks.field] : [],
            workType: null,
            location: picks.city ? { lat: picks.city.lat, lng: picks.city.lng } : null,
            radiusKm: DEFAULT_RADIUS_KM,
          },
          listing,
          canonicalSkill,
        )
      : null;

  const setSkills = (next: string[]) => {
    const q = new URLSearchParams(params.toString());
    if (next.length) q.set("skills", next.slice(0, MAX_SKILLS).join(","));
    else q.delete("skills");
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const toggleSkill = (id: string) =>
    setSkills(picks.skills.includes(id) ? picks.skills.filter((s) => s !== id) : [...picks.skills, id]);

  const quickPicker = (
    <section aria-labelledby="quick-pick-h" className="border border-line bg-screen p-4">
      <h2 id="quick-pick-h" className="text-lg font-semibold">
        {match ? "Update your skills" : "See how you match"}
      </h2>
      <p className="text-base text-muted">Which of these do you have? Tap all that apply.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {listing.skills.map((s) => {
          const on = picks.skills.map(canonicalSkill).includes(canonicalSkill(s.id));
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggleSkill(s.id)}
              className={cn(
                "inline-flex min-h-tap items-center gap-1.5 border-2 px-3 text-base",
                on ? "border-green bg-green font-semibold text-screen" : "border-muted bg-screen text-ink hover:border-ink",
              )}
            >
              <PixelIcon name={on ? "check" : "plus"} scale={2} />
              {skillName(s.id)}
              {!s.required && <span className={cn("text-sm", on ? "text-screen" : "text-muted")}>(nice to have)</span>}
            </button>
          );
        })}
      </div>
      {match && (
        <Button variant="ghost" className="mt-2" onClick={() => setEditSkills(false)}>
          Done
        </Button>
      )}
    </section>
  );

  // Closed: no skills fit and no Save. The only useful next step is similar open listings.
  if (closed) {
    const similarHref = withQuery("/", picksQuery({ ...picks, field: listing.field }));
    return (
      <>
        <div className="hidden border border-line bg-screen p-5 lg:block">
          <Button size="lg" block disabled>
            Closed
          </Button>
          <p className="mt-3 text-sm text-muted">This listing has stopped taking applications.</p>
        </div>
        <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-bezel bg-screen px-gutter pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 lg:hidden">
          <div className="mx-auto max-w-xl">
            <Link
              href={similarHref}
              className="flex min-h-12 w-full items-center justify-center bg-green px-6 text-lg font-semibold text-screen shadow-bevel"
            >
              See open {fieldShort} listings
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Desktop action card (phones use the sticky bar at the bottom). */}
      <div className="hidden border border-line bg-screen p-5 lg:block">
        <ApplyButton listing={listing} onEmail={() => setEmailOpen(true)} className="w-full" />
        <Button variant="secondary" block className="mt-2" icon={<PixelIcon name="bookmark" scale={2} />} onClick={() => setSaveOpen(true)}>
          Save
        </Button>
        <p className="mt-3 text-sm text-muted">
          {closed
            ? "This listing has stopped taking applications."
            : listing.apply.kind === "link"
              ? "You'll apply on the company's site. Come back after and we'll help you keep track."
              : "This company takes applications by email. We'll show you exactly what to send."}
        </p>
        {deadlineText(listing.deadlineInDays) && !closed && (
          <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-alert">
            <PixelIcon name="clock" scale={2} />
            {deadlineText(listing.deadlineInDays)}
          </p>
        )}
      </div>

      {/* Skills fit */}
      <div className="mt-0 space-y-3 lg:mt-4">
        {match && !editSkills ? (
          <>
            <MatchPanel
              match={toBreakdown(listing, match, picks.city)}
              quickPrepHref={`/tips/resume#${listing.field}`}
              quickPrepField={quickPrepField}
            />
            <button
              type="button"
              onClick={() => setEditSkills(true)}
              className="inline-flex min-h-tap items-center text-sm font-semibold text-green underline decoration-2 underline-offset-4"
            >
              Not right? Update your skills
            </button>
          </>
        ) : (
          quickPicker
        )}
      </div>

      {/* Phone action bar: replaces the bottom nav on detail pages (decision #29). */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-bezel bg-screen px-gutter pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 lg:hidden">
        <div className="mx-auto flex max-w-xl gap-2">
          <Button variant="secondary" size="lg" icon={<PixelIcon name="bookmark" scale={2} />} onClick={() => setSaveOpen(true)}>
            Save
          </Button>
          <ApplyButton listing={listing} onEmail={() => setEmailOpen(true)} className="flex-1" />
        </div>
      </div>

      {listing.apply.kind === "email" && (
        <EmailApplySheet
          open={emailOpen}
          onClose={() => setEmailOpen(false)}
          email={listing.apply.email}
          subject={subject}
          onOpenEmail={() => {
            markApplyClicked(listing);
            sendClickBeacon(listing.id);
          }}
        />
      )}
      <GuestSaveSheet
        listingId={saveOpen ? listing.id : null}
        listingTitle={listing.title}
        startHref={startHref}
        onClose={() => setSaveOpen(false)}
      />
      <ApplyReturnSheet pending={prompt} onClose={dismiss} viewer="guest" startHref={startHref} />
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* Small islands used by the server-rendered page                           */
/* ------------------------------------------------------------------------ */

/** "Back to listings" that keeps the visitor's picks. */
export function BackToListings() {
  const params = useSearchParams();
  return <BackLink href={withQuery("/", picksQuery(readPicks(params)))} />;
}

export function BackLink({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex min-h-tap items-center gap-1.5 font-semibold text-green underline-offset-4 hover:underline">
      <PixelIcon name="chevronRight" scale={2} className="rotate-180" />
      Back to listings
    </Link>
  );
}

/** "Read the full posting" for aggregator listings: also counts as an Apply click. */
export function FullPostingLink({ listing }: { listing: SampleListing }) {
  if (listing.apply.kind !== "link" || isClosed(listing)) return null;
  return (
    <a
      href={`/go/${encodeURIComponent(listing.id)}`}
      target="_blank"
      rel="noopener"
      onClick={() => markApplyClicked(listing)}
      className="inline-flex min-h-tap items-center gap-2 font-semibold text-green underline decoration-2 underline-offset-4"
    >
      Read the full posting
      <PixelIcon name="external" scale={2} />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

export function ReportButton({ listingTitle }: { listingTitle: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-tap items-center gap-1.5 font-semibold text-ink underline decoration-2 underline-offset-4"
      >
        <PixelIcon name="alert" scale={2} />
        Report this listing
      </button>
      <ReportSheet open={open} onClose={() => setOpen(false)} listingTitle={listingTitle} />
    </>
  );
}
