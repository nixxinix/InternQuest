"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useRef, useState, type MouseEvent } from "react";
import { useReward } from "@/components/game/useReward";
import { AppShell } from "@/components/layout/AppShell";
import { sendClickBeacon } from "@/components/listing/ListingActions";
import { ApplyReturnSheet, EmailApplySheet } from "@/components/listing/ListingSheets";
import { markApplyClicked, usePendingApplyPrompt } from "@/components/listing/usePendingApply";
import { GameModeProvider } from "@/components/providers/GameModeProvider";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Checkbox, SelectField } from "@/components/ui/Field";
import { ListingCard } from "@/components/ui/ListingCard";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { ToastProvider } from "@/components/ui/Toast";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/browser/useMediaQuery";
import { cn } from "@/lib/cn";
import { findCityById } from "@/lib/catalog/cities";
import { FIELDS, isFieldId } from "@/lib/catalog/fields";
import { canonicalSkill } from "@/lib/catalog/skills";
import { picksQuery, withQuery } from "@/lib/listings/picks";
import {
  MAX_QUERY_LENGTH,
  PAGE_SIZE,
  POSTED_OPTIONS,
  RADIUS_OPTIONS,
  SORTS,
  SORT_LABEL,
  activeFilters,
  readSearchFilters,
  searchListings,
  searchQuery,
  withoutFilter,
  type FilterKey,
  type SearchFilters,
  type SearchSort,
} from "@/lib/listings/search";
import { WORK_TYPE_LABEL, type WorkType } from "@/lib/listings/types";
import { scoreListing } from "@/lib/matching/score";
import { isClosed } from "@/lib/sample/listings";
import { SAMPLE_VIEWER, type Viewer } from "@/lib/sample/viewer";
import { viewerFromAccount } from "@/lib/account/account";
import { useFindListing, useListings } from "@/components/providers/ListingsProvider";
import { initialModeFor, initialMotionFor, useAppAccount } from "@/components/providers/AccountProvider";
import { finishResource, markViewedMatch } from "@/app/actions/game";
import { LIVE } from "@/components/providers/AccountProvider";
import { useSaveAndConfirm } from "@/components/questlog/useSaveAndConfirm";
import { ListingPanel } from "./ListingPanel";

/** URL params that aren't filters but must survive a filter change. */
const KEEP_PARAMS = ["mode", "state"];

const CHIP =
  "inline-flex min-h-tap flex-none items-center gap-1.5 whitespace-nowrap border-2 px-3 text-base transition-colors duration-(--motion-fast)";
const CHIP_ON = "border-green bg-green font-semibold text-screen";
const CHIP_OFF = "border-muted bg-screen text-ink hover:border-ink";
const ROW = "-mx-gutter flex gap-2 overflow-x-auto px-gutter pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0";

/**
 * W4 Search. Signed in: matches use the real profile (listings still come
 * from the sample set until Phase 1c). Design preview: the sample user, with
 * review-only switches ?mode=full|light|plain and ?state=error.
 */
export function SearchScreen() {
  const params = useSearchParams();
  const account = useAppAccount();
  return (
    <GameModeProvider initialMode={initialModeFor(account, params.get("mode"))} initialMotion={initialMotionFor(account)}>
      <ToastProvider>
        <Search initial={account ? viewerFromAccount(account) : SAMPLE_VIEWER} />
      </ToastProvider>
    </GameModeProvider>
  );
}

function Search({ initial }: { initial: Viewer }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const uid = useId();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  const listings = useListings();
  const findListing = useFindListing();
  const [viewer, setViewer] = useState(initial);
  const { reward, fromServer, levelUpDialog } = useReward(viewer, setViewer);
  const { prompt, dismiss } = usePendingApplyPrompt();

  // ---- state from the URL ----
  const filters = readSearchFilters(params);
  const fq = searchQuery(filters);
  const failed = params.get("state") === "error";

  // ---- local UI state ----
  const [qText, setQText] = useState(filters.q);
  const [moreOpen, setMoreOpen] = useState(false);
  const [emailFor, setEmailFor] = useState<string | null>(null);
  const [paging, setPaging] = useState({ key: fq, n: PAGE_SIZE });
  const shown = paging.key === fq ? paging.n : PAGE_SIZE; // a new search starts from the top
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelHeading = useRef<HTMLHeadingElement>(null);

  const city = findCityById(viewer.cityId);
  const profile = { skills: viewer.skills, fields: [viewer.field], workType: viewer.workType, city };
  const result = searchListings(listings, profile, filters);
  const active = activeFilters(filters, city !== null);
  const visible = result.items.slice(0, shown);

  // Links to the full detail page carry the user's picks, so it can show the match there too.
  const detailQuery = picksQuery({ field: viewer.field, skills: viewer.skills, city, remoteOk: true });
  const detailHref = (id: string) => withQuery(`/listings/${id}`, detailQuery);

  // ---- URL updates (read fresh from the address bar, so a delayed update never uses stale filters) ----
  const navigate = (next: SearchFilters, open: string | null, how: "push" | "replace") => {
    const current = new URLSearchParams(window.location.search);
    const q = new URLSearchParams(searchQuery(next));
    for (const k of KEEP_PARAMS) {
      const val = current.get(k);
      if (val) q.set(k, val);
    }
    if (open) q.set("open", open);
    const url = q.toString() ? `${pathname}?${q}` : pathname;
    if (how === "push") router.push(url, { scroll: false });
    else router.replace(url, { scroll: false });
  };
  const setFilters = (patch: Partial<SearchFilters>) =>
    navigate({ ...readSearchFilters(new URLSearchParams(window.location.search)), ...patch }, null, "replace");

  const onQueryChange = (text: string) => {
    setQText(text);
    if (typing.current) clearTimeout(typing.current);
    typing.current = setTimeout(() => setFilters({ q: text.trim().slice(0, MAX_QUERY_LENGTH) }), 350);
  };
  const clearFilter = (key: FilterKey) => {
    if (key === "q") setQText("");
    navigate(withoutFilter(filters, key), null, "replace");
  };
  const clearAll = () => {
    setQText("");
    navigate({ ...readSearchFilters(new URLSearchParams()), sort: filters.sort }, null, "replace");
  };

  // ---- desktop side panel ----
  const openId = params.get("open");
  const openListing = openId ? findListing(openId) : null;
  const panelListing =
    openListing && !isClosed(openListing) ? openListing : result.items[0] ? findListing(result.items[0].id) : null;
  const panelMatch =
    panelListing && viewer.skills.length > 0
      ? scoreListing(
          {
            skills: viewer.skills,
            fields: [viewer.field],
            workType: viewer.workType,
            location: city ? { lat: city.lat, lng: city.lng } : null,
            radiusKm: filters.radiusKm,
          },
          panelListing,
          canonicalSkill,
        )
      : null;

  const openInPanel = (id: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    // Phones, new-tab clicks, and modified clicks keep the normal link.
    if (!isDesktop || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    navigate(filters, id, "push");
    // Move keyboard and screen reader users to what they just opened.
    requestAnimationFrame(() => panelHeading.current?.focus({ preventScroll: true }));
    // Tutorial: "View your top match" (+10 once, decided by the server).
    if (LIVE && !viewer.tutorial.viewedMatch) {
      setViewer((v0) => ({ ...v0, tutorial: { ...v0.tutorial, viewedMatch: true } }));
      markViewedMatch(id)
        .then((r) => {
          if (r.ok && r.reward && r.reward.amount > 0) fromServer(r.reward, "Tutorial step done: you viewed a match.");
        })
        .catch(() => {});
    }
  };

  // ---- actions ----
  const quest = useSaveAndConfirm(setViewer, { reward, fromServer });
  const toggleSave = (id: string) => quest.toggleSave(id, viewer.saved.includes(id));
  const confirmApplied = (id: string) => void quest.confirmApplied(id);

  /** "I finished this" on a learning resource: the server checks the open time and grants EXP. */
  const finishLearning = async (resourceId: string): Promise<string | null> => {
    try {
      const r = await finishResource(resourceId);
      if (!r.ok) return r.error;
      fromServer(r.reward, `Nice work on ${r.skillName}.`);
      return null;
    } catch {
      return "Couldn't reach InternQuest. Check your connection and try again.";
    }
  };

  const emailListing = emailFor ? findListing(emailFor) : null;
  const moreCount = (["field", "posted", "remote"] as FilterKey[]).filter((k) => active.includes(k)).length;

  return (
    <AppShell active="search" viewer={viewer}>
      <h1 className="text-2xl font-semibold lg:text-3xl">Search</h1>

      <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1fr)_28rem]">
        {/* ------------------------------ Results column ------------------------------ */}
        <div>
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              if (typing.current) clearTimeout(typing.current);
              setFilters({ q: qText.trim().slice(0, MAX_QUERY_LENGTH) });
            }}
            className="flex"
          >
            <label htmlFor={`${uid}-q`} className="sr-only">
              Search by role, company, or place
            </label>
            <div className="relative flex-1">
              <input
                id={`${uid}-q`}
                type="search"
                value={qText}
                maxLength={MAX_QUERY_LENGTH}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Role, company, or place"
                autoComplete="off"
                enterKeyHint="search"
                className="block min-h-12 w-full border-2 border-r-0 border-ink bg-screen px-3 text-base placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
              />
            </div>
            <button
              type="submit"
              aria-label="Search"
              className="flex min-h-12 w-12 flex-none items-center justify-center bg-ink text-screen hover:bg-bezel-raised"
            >
              <PixelIcon name="search" scale={3} />
            </button>
          </form>

          {/* Filters: one swipeable row on phones, wrapping on desktop. */}
          <div className={cn(ROW, "mt-3")} role="group" aria-label="Filters">
            {city ? (
              <SelectChip
                label="Distance"
                value={String(filters.radiusKm)}
                on={active.includes("radius")}
                onChange={(val) => setFilters({ radiusKm: Number(val) })}
                options={RADIUS_OPTIONS.map((r) => ({ value: String(r), label: `Within ${r} km` }))}
              />
            ) : (
              <ButtonLink href="/profile" variant="secondary" className="flex-none">
                Add your city for distance
              </ButtonLink>
            )}
            <SelectChip
              label="Work type"
              value={filters.workType ?? ""}
              on={filters.workType !== null}
              onChange={(val) => setFilters({ workType: val ? (val as WorkType) : null })}
              options={[
                { value: "", label: "Any work type" },
                ...(["onsite", "hybrid", "remote"] as WorkType[]).map((w) => ({ value: w, label: `${WORK_TYPE_LABEL[w]} only` })),
              ]}
            />
            <ToggleChip on={filters.paid} onClick={() => setFilters({ paid: !filters.paid })}>
              Paid only
            </ToggleChip>
            <ToggleChip on={filters.moa} onClick={() => setFilters({ moa: !filters.moa })}>
              MOA available
            </ToggleChip>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              className={cn(CHIP, moreCount ? CHIP_ON : "border-dashed border-muted bg-canvas text-ink hover:border-ink")}
            >
              <PixelIcon name="gear" scale={2} />
              More filters
              {moreCount > 0 && <span className="bg-screen px-1.5 text-sm text-ink">{moreCount}</span>}
            </button>
          </div>

          {/* Count, sort, and clear */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <p className="text-base" aria-live="polite">
              <span className="font-semibold">{result.total}</span> {result.total === 1 ? "result" : "results"}
              {active.length > 0 && result.total > 0 && (
                <>
                  {" · "}
                  <button
                    type="button"
                    onClick={clearAll}
                    className="inline-flex min-h-tap items-center font-semibold text-green underline decoration-2 underline-offset-4"
                  >
                    Clear filters
                  </button>
                </>
              )}
            </p>
            <label className={cn("flex items-center gap-2 text-sm", result.total === 0 && "hidden")}>
              <span className="text-muted">Sort</span>
              <select
                value={result.sortUsed}
                onChange={(e) => setFilters({ sort: e.target.value as SearchSort })}
                className="min-h-tap border-2 border-muted bg-screen px-2 text-base"
              >
                {SORTS.map((s) => (
                  <option key={s} value={s} disabled={s === "match" && viewer.skills.length === 0}>
                    {SORT_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Results */}
          <div className="mt-3">
            {failed ? (
              <ErrorState
                title="We couldn't load listings"
                body="Check your connection and try again. Your filters are kept."
                action={
                  <Button
                    onClick={() => {
                      // Review switch only: drop ?state=error and keep everything else.
                      const q = new URLSearchParams(window.location.search);
                      q.delete("state");
                      router.replace(withQuery(pathname, q.toString()), { scroll: false });
                    }}
                  >
                    Try again
                  </Button>
                }
              />
            ) : result.items.length === 0 ? (
              <NoResults filters={filters} active={active} removedBy={result.removedBy} onClear={clearFilter} onClearAll={clearAll} />
            ) : (
              <>
                <ul className="grid gap-3">
                  {visible.map((item, i) => (
                    <li key={item.id}>
                      <ListingCard
                        listing={item}
                        href={detailHref(item.id)}
                        featured={result.sortUsed === "match" && i === 0}
                        selected={isDesktop && panelListing?.id === item.id}
                        saved={viewer.saved.includes(item.id)}
                        onToggleSave={toggleSave}
                        onOpen={openInPanel(item.id)}
                      />
                    </li>
                  ))}
                </ul>
                {result.items.length > shown && (
                  <Button
                    variant="secondary"
                    block
                    className="mt-4"
                    onClick={() => setPaging({ key: fq, n: shown + PAGE_SIZE })}
                  >
                    Show more ({result.items.length - shown} left)
                  </Button>
                )}
                <p className="mt-4 text-xs text-muted">These are sample listings while InternQuest is being built.</p>
              </>
            )}
          </div>
        </div>

        {/* ------------------------------ Desktop detail panel ------------------------------ */}
        {isDesktop && panelListing && !failed && result.items.length > 0 && (
          <div className="sticky top-8 max-h-[calc(100dvh-4rem)] overflow-y-auto">
            <ListingPanel
              key={panelListing.id}
              listing={panelListing}
              match={panelMatch}
              city={city}
              saved={viewer.saved.includes(panelListing.id)}
              onToggleSave={toggleSave}
              onFinishResource={LIVE ? finishLearning : undefined}
              onEmail={() => setEmailFor(panelListing.id)}
              detailHref={detailHref(panelListing.id)}
              headingRef={panelHeading}
            />
          </div>
        )}
      </div>

      {/* ------------------------------ Sheets ------------------------------ */}
      <Sheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="More filters"
        description="Results update as you change these."
      >
        <div className="space-y-4">
          <SelectField
            label="Field"
            value={filters.field ?? ""}
            onChange={(e) => setFilters({ field: isFieldId(e.target.value) ? e.target.value : null })}
            options={[{ value: "", label: "Any field" }, ...FIELDS.map((f) => ({ value: f.id, label: f.label }))]}
          />
          <SelectField
            label="Posted"
            value={filters.postedWithinDays ? String(filters.postedWithinDays) : ""}
            onChange={(e) => setFilters({ postedWithinDays: e.target.value ? Number(e.target.value) : null })}
            options={[{ value: "", label: "Any time" }, ...POSTED_OPTIONS.map((d) => ({ value: String(d), label: `In the past ${d} days` }))]}
          />
          {filters.workType === null ? (
            <Checkbox
              label="Include remote listings"
              checked={filters.remote}
              onChange={(e) => setFilters({ remote: e.target.checked })}
            />
          ) : (
            <p className="text-sm text-muted">Showing {WORK_TYPE_LABEL[filters.workType].toLowerCase()} listings only.</p>
          )}
        </div>
        <Button block className="mt-5" onClick={() => setMoreOpen(false)}>
          Show {result.total} {result.total === 1 ? "result" : "results"}
        </Button>
      </Sheet>

      {emailListing && emailListing.apply.kind === "email" && (
        <EmailApplySheet
          open
          onClose={() => setEmailFor(null)}
          email={emailListing.apply.email}
          subject={`OJT application: ${emailListing.title}`}
          onOpenEmail={() => {
            markApplyClicked(emailListing);
            sendClickBeacon(emailListing.id);
          }}
        />
      )}
      <ApplyReturnSheet pending={prompt} onClose={dismiss} viewer="member" startHref="/start" onConfirm={confirmApplied} />
      {levelUpDialog}
    </AppShell>
  );
}

/* ------------------------------------------------------------------------ */

function ToggleChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={cn(CHIP, on ? CHIP_ON : CHIP_OFF)}>
      <PixelIcon name={on ? "check" : "plus"} scale={2} />
      {children}
    </button>
  );
}

/** A native select that looks like a chip: keyboard, screen reader, and phone pickers come for free. */
function SelectChip({
  label,
  value,
  on,
  onChange,
  options,
}: {
  label: string;
  value: string;
  on: boolean;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label
      className={cn(
        CHIP,
        "relative pr-8 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink",
        on ? CHIP_ON : CHIP_OFF,
      )}
    >
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-tap cursor-pointer appearance-none bg-transparent pr-1 text-base text-current focus-visible:outline-none [&>option]:text-ink"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <PixelIcon name="chevronRight" scale={2} className="pointer-events-none absolute right-2.5 rotate-90" />
    </label>
  );
}

const FILTER_FIX: Record<FilterKey, (f: SearchFilters) => string> = {
  q: (f) => `Clear “${f.q}”`,
  field: () => "Any field",
  radius: () => "Wider distance",
  workType: () => "Any work type",
  remote: () => "Include remote",
  paid: () => "Include unpaid",
  moa: () => "Without MOA too",
  posted: () => "Posted any time",
};

/** Empty results: says which filters caused it and how many each one hides (W4). */
function NoResults({
  filters,
  active,
  removedBy,
  onClear,
  onClearAll,
}: {
  filters: SearchFilters;
  active: FilterKey[];
  removedBy: Partial<Record<FilterKey, number>>;
  onClear: (key: FilterKey) => void;
  onClearAll: () => void;
}) {
  const fixes = active
    .map((k) => ({ key: k, n: removedBy[k] ?? 0 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);

  if (active.length === 0) {
    return (
      <EmptyState
        title="No open listings right now"
        body="New listings come in every day. Check back soon, or look at the tips while you wait."
        action={<ButtonLink href="/tips">Read the tips</ButtonLink>}
      />
    );
  }
  return (
    <EmptyState
      title="No matches with these filters"
      body={
        fixes.length
          ? "Loosening one of these brings some back:"
          : "No single filter is the cause. Try clearing them and starting wider."
      }
      action={
        <div className="flex flex-col items-center gap-2">
          {fixes.map((x) => (
            <Button key={x.key} variant="secondary" onClick={() => onClear(x.key)}>
              {FILTER_FIX[x.key](filters)}{" "}
              <span className="font-normal text-muted">
                (+{x.n} {x.n === 1 ? "result" : "results"})
              </span>
            </Button>
          ))}
          <Button variant={fixes.length ? "ghost" : "primary"} onClick={onClearAll}>
            Clear all filters
          </Button>
        </div>
      }
    />
  );
}
