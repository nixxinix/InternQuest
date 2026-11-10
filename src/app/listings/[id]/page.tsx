import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { AccountScope } from "@/components/providers/AccountScope";
import { SiteFooter } from "@/components/layout/SiteFooter";
import {
  BackLink,
  BackToListings,
  FullPostingLink,
  ListingActions,
  ReportButton,
} from "@/components/listing/ListingActions";
import { ListingFrame } from "@/components/listing/ListingFrame";
import { ButtonLink } from "@/components/ui/Button";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { Tag } from "@/components/ui/Tag";
import { FIELDS, fieldLabel } from "@/lib/catalog/fields";
import { deadlineText, postedText } from "@/lib/listings/present";
import { SOURCE_LABEL, WORK_TYPE_LABEL } from "@/lib/listings/types";
import { isAiEnabled } from "@/lib/ai/server";
import { isClosed } from "@/lib/listings/listing";
import { getListing, getListingIds } from "@/lib/listings/server";

/** The newest open listings are prerendered at build time; others render on first visit, then stay cached. */
export async function generateStaticParams() {
  return (await getListingIds()).map((id) => ({ id }));
}

export async function generateMetadata({ params }: PageProps<"/listings/[id]">): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) return { title: "Listing not found" };
  return {
    title: `${listing.title} at ${listing.company}`,
    description: listing.snippet.slice(0, 155),
  };
}

/** W5 Listing detail. Static parts render on the server; the match and actions are a client island. */
export default async function ListingPage({ params }: PageProps<"/listings/[id]">) {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) notFound();

  const closed = isClosed(listing);
  const due = deadlineText(listing.deadlineInDays);
  const shortField = FIELDS.find((f) => f.id === listing.field)?.short ?? fieldLabel(listing.field);

  const facts: { label: string; value: string }[] = [
    { label: "Where", value: listing.area },
    { label: "Work type", value: WORK_TYPE_LABEL[listing.workType] },
    { label: "Allowance", value: listing.allowance ?? "Not stated" },
    { label: "OJT hours", value: listing.hours ? `${listing.hours} hours` : "Not stated" },
    { label: "School MOA", value: listing.moa ? "Can sign one" : "Not offered" },
    { label: "Deadline", value: closed ? "Closed" : (due ?? "No deadline given") },
  ];

  return (
    // Signed in: the intern app frame (sidebar) and the saved profile for the match; signed out: the public page.
    <AccountScope>
      <ListingFrame header={<PublicHeader />} footer={<SiteFooter />}>
        <Suspense fallback={<BackLink />}>
          <BackToListings />
        </Suspense>

        {/* The last row takes any spare height, so the tall right column never
            pushes gaps between the left column's sections. */}
        <div className="mt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-[auto_auto_minmax(0,1fr)] lg:items-start lg:gap-x-10">
          {/* ---- Header and facts ---- */}
          <div className="lg:col-start-1 lg:row-start-1">
            <p className="text-sm font-semibold text-muted">{fieldLabel(listing.field)}</p>
            <h1 className="mt-1 text-2xl font-semibold lg:text-3xl">{listing.title}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-lg">
              <span>{listing.company}</span>
              {listing.verified && <Tag tone="verified">Verified</Tag>}
            </p>
            <p className="mt-1 text-sm text-muted">
              {SOURCE_LABEL[listing.source]} · {postedText(listing.postedDaysAgo)}
            </p>

            {closed && (
              <div className="mt-4 border-l-4 border-alert bg-alert-tint p-4">
                <p className="font-semibold">This listing is closed.</p>
                <p className="mt-1 text-base">It stopped taking applications. Here are open ones in the same field.</p>
                {/* Phones get this as the sticky bottom button instead. */}
                <div className="mt-3 hidden lg:block">
                  <ButtonLink href={`/?field=${listing.field}`} variant="secondary">
                    See open {shortField} listings
                  </ButtonLink>
                </div>
              </div>
            )}

            <dl className="mt-5 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3">
              {facts.map((f) => (
                <div key={f.label} className="bg-screen p-3">
                  <dt className="text-xs text-muted">{f.label}</dt>
                  <dd className={f.label === "Deadline" && due && !closed ? "font-semibold text-alert" : "font-semibold"}>
                    {f.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* ---- Actions and skills fit (client) ---- */}
          <div className="mt-6 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:mt-0">
            <Suspense fallback={<ActionsSkeleton />}>
              <ListingActions listing={listing} quickPrepField={`${shortField} roles`} fieldShort={shortField} aiEnabled={isAiEnabled()} />
            </Suspense>
          </div>

          {/* ---- About ---- */}
          <section aria-labelledby="about-h" className="mt-8 lg:col-start-1 lg:row-start-2">
            <h2 id="about-h" className="text-xl font-semibold">
              About this internship
            </h2>
            <p className="mt-2 max-w-prose text-base">{listing.snippet}</p>
            {listing.source === "jsearch" && (
              <p className="mt-3 max-w-prose text-sm text-muted">
                This is a short preview found through JSearch. The full posting is on the company&apos;s site.
              </p>
            )}
            <div className="mt-2">
              <FullPostingLink listing={listing} />
            </div>
          </section>

          {/* ---- Safety ---- */}
          <aside aria-label="Safety" className="mt-8 border-l-4 border-ink bg-screen p-4 lg:col-start-1 lg:row-start-3">
            <p className="flex items-start gap-2 font-semibold">
              <PixelIcon name="shield" scale={2} className="mt-1 text-ink [--sprite-accent:var(--color-line)]" />
              Real internships never ask you to pay.
            </p>
            <p className="mt-1 max-w-prose text-base text-muted">
              No legit company charges for training, uniforms, IDs, or a &ldquo;slot&rdquo; before you start. If this one
              does, tell us and we&apos;ll look into it.
            </p>
            <div className="mt-2">
              <ReportButton listingId={listing.id} listingTitle={listing.title} />
            </div>
          </aside>
        </div>
      </ListingFrame>
    </AccountScope>
  );
}

function ActionsSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-3">
      <div className="hidden h-36 animate-shimmer bg-line lg:block" />
      <div className="h-64 animate-shimmer bg-line" />
    </div>
  );
}
