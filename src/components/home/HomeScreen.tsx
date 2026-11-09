"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useReward } from "@/components/game/useReward";
import { AppShell } from "@/components/layout/AppShell";
import { saveSettings } from "@/app/actions/profile";
import { useSaveAndConfirm } from "@/components/questlog/useSaveAndConfirm";
import { useFindListing, useListings } from "@/components/providers/ListingsProvider";
import { LIVE, initialModeFor, initialMotionFor, useAppAccount } from "@/components/providers/AccountProvider";
import { GameModeProvider, useFeatures, useGameMode, useVocab } from "@/components/providers/GameModeProvider";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ListingCard } from "@/components/ui/ListingCard";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { EmptyState } from "@/components/ui/States";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { viewerFromAccount } from "@/lib/account/account";
import { findCityById } from "@/lib/catalog/cities";
import { exploreListings } from "@/lib/listings/explore";
import { picksQuery, withQuery } from "@/lib/listings/picks";
import { closingSoon, deadlineText } from "@/lib/listings/present";
import { SAMPLE_NEW_VIEWER, SAMPLE_VIEWER, type Viewer } from "@/lib/sample/viewer";

const TOP_MATCHES = 3;
/** Below this, a listing isn't shown on Home as a match. Display rule only; tune with pilot feedback. */
const MIN_HOME_MATCH_PCT = 40;

/**
 * W3 Home. Signed in: the real account (EXP and quests arrive in Phase 3).
 * Design preview (no Supabase): a sample user, with review-only switches
 * ?mode=full|light|plain and ?state=new.
 */
export function HomeScreen() {
  const params = useSearchParams();
  const account = useAppAccount();
  const viewer = account ? viewerFromAccount(account) : params.get("state") === "new" ? SAMPLE_NEW_VIEWER : SAMPLE_VIEWER;
  return (
    <GameModeProvider initialMode={initialModeFor(account, params.get("mode"))} initialMotion={initialMotionFor(account)}>
      <ToastProvider>
        <Home initial={viewer} />
      </ToastProvider>
    </GameModeProvider>
  );
}

function Home({ initial }: { initial: Viewer }) {
  const listings = useListings();
  const findListing = useFindListing();
  const f = useFeatures();
  const v = useVocab();
  const { setMode } = useGameMode();
  const toast = useToast();

  const [viewer, setViewer] = useState(initial);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const { reward, fromServer, levelUpDialog } = useReward(viewer, setViewer);

  const city = findCityById(viewer.cityId);
  const picks = { field: viewer.field, skills: viewer.skills, city, remoteOk: true };
  const inLog = [...viewer.saved, ...viewer.applied, ...(viewer.pendingConfirm ? [viewer.pendingConfirm] : [])];
  // Only real fits on Home: a 25% listing isn't a "top match". The rest are one tap away in Search.
  const matches = exploreListings(listings, { ...picks, workType: viewer.workType, excludeIds: inLog })
    .items.filter((m) => (m.match?.pct ?? 0) >= MIN_HOME_MATCH_PCT)
    .slice(0, TOP_MATCHES);
  const soon = closingSoon(listings, viewer.saved);
  const pending = viewer.pendingConfirm ? findListing(viewer.pendingConfirm) : null;

  const quest = useSaveAndConfirm(setViewer, { reward, fromServer });
  const confirmApplied = () => {
    if (!pending) return;
    // A confirmed application also counts toward the weekly quest ("Send 4 applications").
    void quest.confirmApplied(pending.id, (v0) => ({
      ...v0,
      weeklyQuest: v0.weeklyQuest ? { ...v0.weeklyQuest, done: Math.min(v0.weeklyQuest.total, v0.weeklyQuest.done + 1) } : null,
    }));
  };
  const toggleSave = (id: string) => quest.toggleSave(id, viewer.saved.includes(id));

  const questOrTutorial = viewer.isNew ? (
    <Tutorial viewer={viewer} />
  ) : f.weeklyQuest && viewer.weeklyQuest ? (
    <WeeklyQuest quest={viewer.weeklyQuest} soonTitle={soon[0]?.company ?? null} soonDays={soon[0]?.deadlineInDays ?? null} />
  ) : null;

  return (
    <AppShell active="home" viewer={viewer}>
      <h1 className="text-2xl font-semibold lg:text-3xl">
        {viewer.isNew ? `Welcome, ${viewer.username}` : `Good to see you, ${viewer.username}`}
      </h1>

      {/* "Too much?" nudge: first sessions, Full Quest only (SPEC §10). */}
      {viewer.isNew && f.avatar && !nudgeDismissed && (
        <div className="mt-4 flex flex-col gap-2 border border-line bg-screen p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-base">Too much game? Light mode keeps just the EXP bar.</p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                setMode("light");
                if (LIVE) {
                  let ok = false;
                  try {
                    ok = (await saveSettings({ mode: "light" })).ok;
                  } catch {
                    ok = false;
                  }
                  if (!ok) {
                    setMode("full");
                    toast({ message: "Couldn't switch just now. Try again, or use Settings.", tone: "error" });
                    return;
                  }
                }
                toast({ message: "Switched to Light. Change it anytime in Settings." });
              }}
            >
              Switch to Light
            </Button>
            <Button variant="ghost" onClick={() => setNudgeDismissed(true)}>
              Keep it
            </Button>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        {/* ---------------- Main column ---------------- */}
        <div className="space-y-8">
          {pending && (
            <section aria-labelledby="pending-h" className="border-l-4 border-green bg-screen p-4">
              <h2 id="pending-h" className="text-lg font-semibold">
                Did you send your application to {pending.company}?
              </h2>
              <p className="text-base text-muted">
                You opened &ldquo;{pending.title}&rdquo; earlier. We&apos;ll move it to Applied.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={confirmApplied}>Yes, I applied</Button>
                <Button
                  variant="secondary"
                  onClick={() => void quest.notYet(pending.id)}
                >
                  Not yet, keep it saved
                </Button>
              </div>
            </section>
          )}

          {questOrTutorial && <div className="lg:hidden">{questOrTutorial}</div>}

          <section aria-labelledby="matches-h">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="matches-h" className="text-xl font-semibold">
                {v("homeMatches")}
              </h2>
              <Link
                href="/search"
                className="inline-flex min-h-tap items-center gap-1 font-semibold text-green underline-offset-4 hover:underline"
              >
                See all <PixelIcon name="chevronRight" scale={2} />
              </Link>
            </div>
            {matches.length === 0 ? (
              <div className="mt-3">
                <EmptyState
                  title="No new matches right now"
                  body="Adding a couple more skills, or turning on remote listings, usually brings more in."
                  action={<ButtonLink href="/profile">Edit my skills</ButtonLink>}
                />
              </div>
            ) : (
              <ul className="mt-3 grid gap-3 xl:grid-cols-2">
                {matches.map((m, i) => (
                  <li key={m.id} className={i === 0 ? "xl:col-span-2" : undefined}>
                    <ListingCard
                      listing={m}
                      href={withQuery(`/listings/${m.id}`, picksQuery(picks))}
                      featured={i === 0}
                      saved={viewer.saved.includes(m.id)}
                      onToggleSave={toggleSave}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ---------------- Right rail (stacks under the matches on phones) ---------------- */}
        <div className="space-y-6">
          {questOrTutorial && <div className="hidden lg:block">{questOrTutorial}</div>}

          {viewer.upcoming.length > 0 && (
            <RailSection title="Coming up" id="upcoming-h">
              <ul className="divide-y divide-line">
                {viewer.upcoming.map((u) => {
                  const l = findListing(u.listingId);
                  return (
                    <li key={u.listingId} className="py-3">
                      <p className="font-semibold">
                        {u.what} · {u.company ?? l?.company}
                      </p>
                      <p className="text-sm text-muted">
                        {u.when} · {u.how}
                      </p>
                      <Link
                        href="/tips/interview"
                        className="mt-1 inline-flex min-h-tap items-center gap-1 font-semibold text-green underline decoration-2 underline-offset-4"
                      >
                        Prepare for your interview <PixelIcon name="chevronRight" scale={2} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </RailSection>
          )}

          {soon.length > 0 && (
            <RailSection title="Closing soon" id="soon-h" note="From your saved listings">
              <ul className="divide-y divide-line">
                {soon.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={withQuery(`/listings/${l.id}`, picksQuery(picks))}
                      className="flex min-h-tap items-center justify-between gap-3 py-3 hover:bg-canvas"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{l.title}</span>
                        <span className="block truncate text-sm text-muted">{l.company}</span>
                      </span>
                      <span className="flex flex-none items-center gap-1 text-sm font-semibold text-alert">
                        <PixelIcon name="clock" scale={2} />
                        {deadlineText(l.deadlineInDays)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </RailSection>
          )}
        </div>
      </div>

      {levelUpDialog}
    </AppShell>
  );
}

/* ------------------------------------------------------------------------ */

function RailSection({ title, id, note, children }: { title: string; id: string; note?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border border-line bg-screen px-4 pt-3">
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      {note && <p className="text-sm text-muted">{note}</p>}
      {children}
    </section>
  );
}

/** Full Quest only. Week 2 onward (SPEC §10 gradual unlock). */
function WeeklyQuest({
  quest,
  soonTitle,
  soonDays,
}: {
  quest: { goal: string; done: number; total: number };
  soonTitle: string | null;
  soonDays: number | null;
}) {
  const left = quest.total - quest.done;
  const note =
    left <= 0
      ? "Quest done for this week. Anything more is a bonus, and resting counts too."
      : left === 1 && soonTitle && soonDays !== null
        ? `One more and this week's quest is done. ${soonTitle} closes in ${soonDays} ${soonDays === 1 ? "day" : "days"}, if it's a fit.`
        : `${left} to go this week. Resets Monday.`;
  return (
    <section aria-labelledby="quest-h" className="on-bezel p-4">
      <h2 id="quest-h" className="font-pixel text-hud uppercase text-lime">
        Weekly quest
      </h2>
      <p className="mt-1 text-lg font-semibold">{quest.goal}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className="flex gap-1.5" aria-hidden="true">
          {Array.from({ length: quest.total }, (_, i) => (
            <span key={i} className={i < quest.done ? "size-5 bg-lime" : "size-5 border-2 border-bezel-text"} />
          ))}
        </span>
        <span className="text-sm text-bezel-text">
          {Math.min(quest.done, quest.total)} of {quest.total}
        </span>
      </div>
      <p className="mt-3 text-base text-bezel-text">{note}</p>
    </section>
  );
}

/** First week: replaces the weekly quest. In Plain it's a plain "Getting started" list. */
function Tutorial({ viewer }: { viewer: Viewer }) {
  const f = useFeatures();
  const t = viewer.tutorial;
  const steps: { done: boolean; label: string; href?: string; bonus?: boolean }[] = [
    { done: t.profile, label: f.avatar ? "Finish your character sheet" : "Finish your profile" },
    { done: t.viewedMatch, label: "View your top match", href: "#matches-h" },
    { done: t.saved, label: "Save a listing", href: "#matches-h" },
    { done: t.applied, label: "Bonus: confirm your first application", bonus: true },
  ];
  const doneCount = steps.filter((s) => s.done && !s.bonus).length;
  return (
    <section aria-labelledby="tut-h" className={f.avatar ? "on-bezel p-4" : "border border-line bg-screen p-4"}>
      <h2 id="tut-h" className={f.avatar ? "font-pixel text-hud uppercase text-lime" : "text-lg font-semibold"}>
        {f.avatar ? "Your first quest" : "Getting started"}
      </h2>
      <p className={f.avatar ? "mt-1 text-sm text-bezel-text" : "mt-1 text-sm text-muted"}>
        {doneCount} of 3 done{f.exp ? ". Finish all three to reach Level 2." : "."}
      </p>
      <ul className="mt-3 space-y-1">
        {steps.map((s) => (
          <li key={s.label}>
            {s.href && !s.done ? (
              <a href={s.href} className="flex min-h-tap items-center gap-3 underline-offset-4 hover:underline">
                <Box done={s.done} dark={f.avatar} />
                <span className={s.bonus ? "opacity-80" : undefined}>{s.label}</span>
              </a>
            ) : (
              <span className="flex min-h-tap items-center gap-3">
                <Box done={s.done} dark={f.avatar} />
                <span className={s.done ? "line-through opacity-70" : s.bonus ? "opacity-80" : undefined}>{s.label}</span>
              </span>
            )}
            <span className="sr-only">{s.done ? "(done)" : "(to do)"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Box({ done, dark }: { done: boolean; dark: boolean }) {
  return done ? (
    <span aria-hidden="true" className={dark ? "flex size-6 flex-none items-center justify-center bg-lime text-ink" : "flex size-6 flex-none items-center justify-center bg-green text-screen"}>
      <PixelIcon name="check" scale={2} />
    </span>
  ) : (
    <span aria-hidden="true" className={dark ? "size-6 flex-none border-2 border-bezel-text" : "size-6 flex-none border-2 border-muted"} />
  );
}
