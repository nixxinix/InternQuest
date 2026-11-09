"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { ButtonLink, Button } from "@/components/ui/Button";
import { ChipPicker } from "@/components/ui/Field";
import { ListingCard, ListingCardSkeleton } from "@/components/ui/ListingCard";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import { GuestSaveSheet } from "@/components/listing/ListingSheets";
import { useListings } from "@/components/providers/ListingsProvider";
import { CITIES, findCityByName } from "@/lib/catalog/cities";
import { FIELDS } from "@/lib/catalog/fields";
import { STARTER_SKILLS, canonicalSkill, searchSkills, skillName, skillsForField } from "@/lib/catalog/skills";
import { exploreListings } from "@/lib/listings/explore";
import { MAX_SKILLS, readPicks, withQuery } from "@/lib/listings/picks";
import type { ListingSummary } from "@/lib/listings/types";

/* Phones: one swipeable row per question, so listings stay above the fold.
   Desktop (lg): rows wrap inside the sticky left column. */
const ROW =
  "-mx-gutter flex gap-2 overflow-x-auto px-gutter pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0";
const CHIP =
  "inline-flex min-h-tap flex-none cursor-pointer items-center gap-1.5 whitespace-nowrap border-2 px-3 text-base transition-colors duration-(--motion-fast)";
const CHIP_ON = "border-green bg-green font-semibold text-screen";
const CHIP_OFF = "border-muted bg-screen text-ink hover:border-ink";
const FOCUS_WITHIN = "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink";

/**
 * Landing page explorer (W1): field, skills, and city re-rank real listings
 * live. Every pick lives in the URL, so links can be shared and Back works.
 */
export function LandingExplorer() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const uid = useId();
  const listings = useListings();

  // ---- state from the URL (the single source of truth) ----
  const { field, skills, city, remoteOk } = readPicks(params);

  // ---- local UI state ----
  const [cityText, setCityText] = useState(city?.name ?? "");
  const [cityError, setCityError] = useState<string | null>(null);
  const [skillSearchOpen, setSkillSearchOpen] = useState(false);
  const [skillQuery, setSkillQuery] = useState("");
  const [saveFor, setSaveFor] = useState<ListingSummary | null>(null);

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const setSkills = (next: string[]) => update({ skills: next.length ? next.slice(0, MAX_SKILLS).join(",") : null });
  const toggleSkill = (id: string) => setSkills(skills.includes(id) ? skills.filter((s) => s !== id) : [...skills, id]);

  const result = exploreListings(listings, { skills, field, city, remoteOk });

  // Picked skills first, then the field's skills (or starter skills before a field is picked).
  // A synonym of a picked skill isn't suggested again (picking IoT already covers Embedded systems).
  const pickedCanonical = new Set(skills.map(canonicalSkill));
  const suggestions = (field ? skillsForField(field).map((s) => s.id) : STARTER_SKILLS).filter(
    (id) => !pickedCanonical.has(canonicalSkill(id)),
  );
  const skillRow = [...skills, ...suggestions];

  const onCityChange = (text: string) => {
    setCityText(text);
    setCityError(null);
    const match = findCityByName(text);
    if (match) {
      if (match.id !== city?.id) update({ city: match.id });
    } else if (city) {
      update({ city: null });
    }
  };

  const clearCity = () => {
    setCityText("");
    setCityError(null);
    update({ city: null });
  };

  const startHref = withQuery("/start", params.toString());

  return (
    <div className="mt-5 lg:mt-8 lg:grid lg:grid-cols-[22rem_1fr] lg:items-start lg:gap-10">
      {/* ------------------------------ Picker ------------------------------ */}
      {/* Desktop: sticky, and scrolls on its own if taller than the window, so nothing is unreachable. */}
      <section
        aria-label="Your picks"
        className="space-y-4 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:border lg:border-line lg:bg-screen lg:p-5"
      >
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">Your field</legend>
          <div className={ROW}>
            {[{ id: null, label: "Any" } as const, ...FIELDS.map((f) => ({ id: f.id, label: f.short }))].map((opt) => {
              const on = field === opt.id;
              return (
                <label key={opt.id ?? "any"} className={cn(CHIP, on ? CHIP_ON : CHIP_OFF, FOCUS_WITHIN)}>
                  <input
                    type="radio"
                    name={`${uid}-field`}
                    className="sr-only"
                    checked={on}
                    onChange={() => update({ field: opt.id })}
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">
            Your skills{" "}
            <span className="font-normal text-muted">
              {skills.length ? `(${skills.length} picked)` : "(pick a few)"}
            </span>
          </legend>
          <div className={ROW}>
            {skillRow.map((id) => {
              const on = skills.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  disabled={!on && skills.length >= MAX_SKILLS}
                  onClick={() => toggleSkill(id)}
                  className={cn(CHIP, on ? CHIP_ON : CHIP_OFF, "disabled:cursor-not-allowed disabled:opacity-50")}
                >
                  <PixelIcon name={on ? "check" : "plus"} scale={2} />
                  {skillName(id)}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setSkillSearchOpen(true)}
              className={cn(CHIP, "border-dashed border-muted bg-canvas text-ink hover:border-ink")}
            >
              <PixelIcon name="search" scale={2} />
              More skills
            </button>
          </div>
        </fieldset>

        <div>
          {/* Phones: city and Remote side by side. Narrow desktop column: stacked, full width. */}
          <div className="flex items-end gap-2 lg:flex-col lg:items-stretch">
            <div className="min-w-0 flex-1">
              <label htmlFor={`${uid}-city`} className="mb-1.5 block text-sm font-semibold">
                City <span className="font-normal text-muted">(optional)</span>
              </label>
              <div className="relative">
                <input
                  id={`${uid}-city`}
                  list={`${uid}-cities`}
                  value={cityText}
                  onChange={(e) => onCityChange(e.target.value)}
                  onBlur={() => {
                    if (cityText.trim() && !findCityByName(cityText)) {
                      setCityError("We don't know that place yet. Try a city name, like Quezon City.");
                    }
                  }}
                  autoComplete="off"
                  placeholder="e.g. Pasig"
                  aria-invalid={cityError ? true : undefined}
                  aria-describedby={cityError ? `${uid}-city-error` : undefined}
                  className="block min-h-tap w-full border-2 border-muted bg-screen pl-3 pr-11 text-base text-ink placeholder:text-muted aria-invalid:border-alert"
                />
                {cityText && (
                  <button
                    type="button"
                    aria-label="Clear city"
                    onClick={clearCity}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-ink"
                  >
                    <PixelIcon name="close" scale={2} />
                  </button>
                )}
              </div>
              <datalist id={`${uid}-cities`}>
                {CITIES.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.province}
                  </option>
                ))}
              </datalist>
            </div>
            <label className={cn(CHIP, remoteOk ? CHIP_ON : CHIP_OFF, FOCUS_WITHIN)}>
              <input
                type="checkbox"
                className="sr-only"
                checked={remoteOk}
                onChange={(e) => update({ remote: e.target.checked ? null : "0" })}
              />
              <PixelIcon name={remoteOk ? "check" : "plus"} scale={2} />
              Remote OK
            </label>
          </div>
          {cityError && (
            <p id={`${uid}-city-error`} className="mt-1 flex items-start gap-1.5 text-sm font-semibold text-alert">
              <PixelIcon name="alert" scale={2} className="mt-0.5" />
              {cityError}
            </p>
          )}
        </div>
      </section>

      {/* ------------------------------ Results ----------------------------- */}
      <section id="results" aria-labelledby={`${uid}-results`} className="mt-6 scroll-mt-4 lg:mt-0">
        <h2 id={`${uid}-results`} className="text-xl font-semibold">
          {result.mode === "match"
            ? "Your best matches"
            : city
              ? `Newest near ${city.name}`
              : "Newest across the Philippines"}
        </h2>
        <p className="text-sm text-muted" aria-live="polite">
          {result.items.length} {result.items.length === 1 ? "listing" : "listings"}
          {city ? ` within ${result.radiusKm} km of ${city.name}` : ""}
          {remoteOk ? (city ? ", plus remote" : ", including remote") : ""}
          {result.items.length === 0
            ? "."
            : result.mode === "newest"
              ? ". Pick your skills to rank them by fit."
              : ", best fit first."}
        </p>

        {result.items.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title={city ? `Nothing within ${result.radiusKm} km of ${city.name} yet` : "No listings here yet"}
              body={
                !remoteOk
                  ? "Remote listings are hidden right now. Many internships can be done from home."
                  : "New listings come in every day. You can also look across the whole country."
              }
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {!remoteOk && <Button onClick={() => update({ remote: null })}>Show remote listings</Button>}
                  {city && (
                    <Button variant={remoteOk ? "primary" : "secondary"} onClick={clearCity}>
                      Search all of the Philippines
                    </Button>
                  )}
                </div>
              }
            />
          </div>
        ) : (
          <ul className="mt-4 grid gap-3 xl:grid-cols-2">
            {result.items.map((item, i) => (
              <li key={item.id}>
                <ListingCard
                  listing={item}
                  href={withQuery(`/listings/${item.id}`, params.toString())}
                  featured={result.mode === "match" && i === 0}
                  onToggleSave={() => setSaveFor(item)}
                />
              </li>
            ))}
          </ul>
        )}

        <div className="on-bezel mt-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-base">
            <span className="font-semibold">Keep the ones you like.</span>{" "}
            <span className="text-bezel-text">
              Create a character to save listings and track your applications. No email or real name needed.
            </span>
          </p>
          <ButtonLink href={startHref} variant="hud" className="flex-none">
            Create character
          </ButtonLink>
        </div>

        <p className="mt-3 text-xs text-muted">
          These are sample listings while InternQuest is being built. Company names are made up.
        </p>
      </section>

      {/* ------------------------------ Sheets ------------------------------ */}
      <Sheet
        open={skillSearchOpen}
        onClose={() => {
          setSkillSearchOpen(false);
          setSkillQuery("");
        }}
        title="Find your skills"
        description="Tap every skill you have, even a little. You can change these later."
      >
        <label htmlFor={`${uid}-skill-q`} className="sr-only">
          Search skills
        </label>
        <input
          id={`${uid}-skill-q`}
          type="search"
          value={skillQuery}
          onChange={(e) => setSkillQuery(e.target.value)}
          placeholder="Search, e.g. Excel, React, AutoCAD"
          className="block min-h-tap w-full border-2 border-muted bg-screen px-3 text-base placeholder:text-muted"
        />
        <div className="mt-3 max-h-[50dvh] overflow-y-auto">
          {(() => {
            const found = searchSkills(skillQuery);
            return found.length === 0 ? (
              <p className="py-4 text-base text-muted">
                No skill called &ldquo;{skillQuery}&rdquo; yet. Try a shorter word.
              </p>
            ) : (
              <ChipPicker
                legend={skillQuery ? `${found.length} found` : "All skills"}
                options={found.map((s) => s.id)}
                labels={Object.fromEntries(found.map((s) => [s.id, s.name]))}
                value={skills}
                onChange={setSkills}
                max={MAX_SKILLS}
              />
            );
          })()}
        </div>
        <Button block className="mt-4" onClick={() => setSkillSearchOpen(false)}>
          Done
        </Button>
      </Sheet>

      <GuestSaveSheet
        listingId={saveFor?.id ?? null}
        listingTitle={saveFor?.title ?? null}
        startHref={startHref}
        onClose={() => setSaveFor(null)}
      />
    </div>
  );
}

/** Shown while the explorer reads the URL on first load. */
export function LandingExplorerSkeleton() {
  return (
    <div className="mt-5 lg:mt-8 lg:grid lg:grid-cols-[22rem_1fr] lg:gap-10" aria-busy="true">
      <div className="space-y-4" aria-hidden="true">
        <div className="h-4 w-24 animate-shimmer bg-line" />
        <div className="h-11 w-full animate-shimmer bg-line" />
        <div className="h-4 w-24 animate-shimmer bg-line" />
        <div className="h-11 w-full animate-shimmer bg-line" />
        <div className="h-11 w-full animate-shimmer bg-line" />
      </div>
      <div className="mt-6 grid gap-3 lg:mt-0">
        <p className="sr-only">Loading listings</p>
        <ListingCardSkeleton />
        <ListingCardSkeleton />
        <ListingCardSkeleton />
      </div>
    </div>
  );
}
