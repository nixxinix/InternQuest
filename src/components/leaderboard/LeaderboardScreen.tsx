"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { saveSettings } from "@/app/actions/profile";
import { LIVE, initialModeFor, initialMotionFor, useAppAccount } from "@/components/providers/AccountProvider";
import { GameModeProvider, useFeatures, useVocab } from "@/components/providers/GameModeProvider";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { Tabs } from "@/components/ui/Tabs";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { viewerFromAccount } from "@/lib/account/account";
import { cn } from "@/lib/cn";
import { SCHOOLS } from "@/lib/catalog/schools";
import type { BoardData } from "@/lib/game/board";
import {
  LEADERBOARD_LEVEL,
  personalBest,
  rankBoard,
  resetText,
  unlockDistance,
  type BoardEntry,
  type BoardGroup,
  type Period,
  type WeekTotals,
} from "@/lib/game/leaderboard";
import { SAMPLE_BOARD, SAMPLE_LAST_WEEK } from "@/lib/sample/leaderboard";
import { SAMPLE_NEW_VIEWER, SAMPLE_VIEWER, type Viewer } from "@/lib/sample/viewer";

/** Rows shown before the list is cut; your own row is always added. */
const LIMIT = 50;

/**
 * W10 Leaderboard (Full Quest, Level 3 and up). Signed in: the board comes
 * from the server (`board`: usernames and EXP only, week resets Monday in
 * Manila). Design preview: a sample board, with review switches ?mode=,
 * ?state=new (locked), ?state=hidden (opted out), ?state=off (turned off in Settings).
 */
export function LeaderboardScreen({ board }: { board: BoardData | null }) {
  const params = useSearchParams();
  const account = useAppAccount();
  const state = account ? null : params.get("state");
  return (
    <GameModeProvider initialMode={initialModeFor(account, params.get("mode"))} initialMotion={initialMotionFor(account)}>
      <ToastProvider>
        <Leaderboard
          viewer={account ? viewerFromAccount(account) : state === "new" ? SAMPLE_NEW_VIEWER : SAMPLE_VIEWER}
          startHidden={account ? !account.settings.showOnLeaderboard : state === "hidden"}
          turnedOff={account ? !account.settings.leaderboard : state === "off"}
          entries={board?.entries ?? SAMPLE_BOARD}
          lastWeek={board ? board.lastWeek : SAMPLE_LAST_WEEK}
        />
      </ToastProvider>
    </GameModeProvider>
  );
}

function Leaderboard({
  viewer,
  startHidden,
  turnedOff,
  entries,
  lastWeek,
}: {
  viewer: Viewer;
  startHidden: boolean;
  turnedOff: boolean;
  entries: BoardEntry[];
  lastWeek: WeekTotals | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const f = useFeatures();
  const toast = useToast();
  const [hidden, setHidden] = useState(startHidden);
  const [now] = useState(() => new Date());

  const period: Period = params.get("period") === "all" ? "all" : "week";
  const group: BoardGroup = params.get("group") === "school" && viewer.school ? "school" : "overall";
  const setParam = (key: string, value: string | null) => {
    const q = new URLSearchParams(window.location.search);
    if (value === null) q.delete(key);
    else q.set(key, value);
    router.replace(q.toString() ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  // ---- States where there's no board to show ----
  if (!f.leaderboard) {
    return (
      <Frame viewer={viewer}>
        <Notice
          title="The leaderboard is part of Full Quest"
          body="Light and Plain keep things simple, with no rankings. Your EXP and applications still count."
          action={<ButtonLink href="/settings#play-style">Change play style</ButtonLink>}
        />
      </Frame>
    );
  }
  if (turnedOff) {
    return (
      <Frame viewer={viewer}>
        <Notice
          title="You turned the leaderboard off"
          body="It's hidden everywhere until you turn it back on."
          action={<ButtonLink href="/settings#game">Turn it on in Settings</ButtonLink>}
        />
      </Frame>
    );
  }
  if (viewer.level < LEADERBOARD_LEVEL) {
    return (
      <Frame viewer={viewer}>
        <section aria-labelledby="locked-h" className="on-bezel mt-4 max-w-2xl p-5">
          <PixelIcon name="trophy" scale={5} className="text-lime" />
          <h2 id="locked-h" className="mt-3 font-pixel text-hud uppercase text-lime sm:text-hud-lg">
            Unlocks at Level {LEADERBOARD_LEVEL}
          </h2>
          <p className="mt-1 text-base text-bezel-text">{unlockDistance(viewer)} A few ways to get there:</p>
          <ul className="mt-3 space-y-1">
            <Idea href="/search" exp={20}>
              Confirm an application
            </Idea>
            <Idea href="/tips" exp={10}>
              Finish a tips checklist
            </Idea>
            <Idea href="/quest-log" exp={5}>
              Update a card in your quest log
            </Idea>
          </ul>
        </section>
      </Frame>
    );
  }

  // ---- The board ----
  const yourSchool = viewer.school;
  const schoolName = SCHOOLS.find((s) => s.id === yourSchool)?.name ?? null;
  const board = entries.map((e) => (e.username === viewer.username ? { ...e, hidden } : e));
  const rows = rankBoard(board, { period, group, you: viewer.username, yourSchool });
  const you = rows.find((r) => r.isYou) ?? null;
  const shown = rows.slice(0, LIMIT);
  const cut = you && !shown.includes(you);
  const onlyYouHere = rows.length === 1 && you !== null;

  const youWeek = entries.find((e) => e.username === viewer.username);
  const summary =
    period === "week"
      ? personalBest({ exp: youWeek?.weekExp ?? 0, apps: youWeek?.weekApps ?? 0 }, lastWeek)
      : `All time: ${viewer.totalExp.toLocaleString("en-US")} EXP and ${viewer.applicationsTotal} applications. Every one of them counts.`;

  /** Saves "Show me on the leaderboard" (live), rolling back if the save fails. */
  const persistHidden = async (value: boolean): Promise<boolean> => {
    if (!LIVE) return true;
    try {
      const res = await saveSettings({ showOnLeaderboard: !value });
      return res.ok;
    } catch {
      return false;
    }
  };

  const setHiddenSaved = async (value: boolean, message: string) => {
    const before = hidden;
    setHidden(value);
    if (!(await persistHidden(value))) {
      setHidden(before);
      toast({ message: "Couldn't save that. Check your connection and try again.", tone: "error" });
      return;
    }
    toast({
      message,
      tone: "success",
      action: { label: "Undo", onClick: () => void setHiddenSaved(before, before ? "You're hidden again." : "You're back on the leaderboard.") },
    });
  };

  const toggleHidden = () => {
    const next = !hidden;
    void setHiddenSaved(next, next ? "You're hidden. Only you can see your row." : "You're back on the leaderboard.");
  };

  return (
    <Frame viewer={viewer}>
      <div className="mt-4 max-w-3xl">
        <Tabs
          label="Leaderboard period"
          value={period}
          onChange={(id) => setParam("period", id === "all" ? "all" : null)}
          tabs={[
            { id: "week", label: "This week" },
            { id: "all", label: "All time" },
          ]}
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="font-semibold">Group</span>
              <select
                value={group}
                onChange={(e) => setParam("group", e.target.value === "school" ? "school" : null)}
                className="min-h-tap border-2 border-muted bg-screen px-2 text-base"
              >
                <option value="overall">Overall</option>
                <option value="school" disabled={!schoolName}>
                  {schoolName ?? "My school (add it in Profile)"}
                </option>
              </select>
            </label>
            {period === "week" && <p className="text-sm text-muted">{resetText(now)}</p>}
          </div>

          {/* Personal best leads, so the page is never just a rank (W10). */}
          <p className="on-bezel mt-4 p-4 text-base font-semibold" aria-live="polite">
            <PixelIcon name="star" scale={2} className="mr-2 inline-block align-[-2px] text-lime" />
            {summary}
          </p>

          {onlyYouHere && (
            <p className="mt-4 text-base">You&apos;re the first one here this week. Others will show up as they earn EXP.</p>
          )}

          <table className="mt-4 w-full border-collapse bg-screen text-left">
            <caption className="sr-only">
              {period === "week" ? "This week's" : "All-time"} leaderboard, {group === "school" ? schoolName : "overall"}. Ranked by
              EXP.
            </caption>
            <thead>
              <tr className="border-b-2 border-bezel text-sm">
                <th scope="col" className="w-12 py-2 pl-3 font-semibold">
                  #
                </th>
                <th scope="col" className="py-2 font-semibold">
                  Username
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  {period === "week" ? (
                    <>
                      EXP<span className="hidden sm:inline"> this week</span>
                    </>
                  ) : (
                    "EXP"
                  )}
                </th>
                <th scope="col" className="py-2 pl-3 pr-3 text-right font-semibold">
                  <span className="sm:hidden">Apps</span>
                  <span className="hidden sm:inline">Applications</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <Row key={r.username} row={r} />
              ))}
              {cut && you && (
                <>
                  <tr aria-hidden="true">
                    <td colSpan={4} className="py-1 text-center text-muted">
                      ⋯
                    </td>
                  </tr>
                  <Row row={you} />
                </>
              )}
            </tbody>
          </table>
          <p className="mt-2 text-sm text-muted">Ranked by EXP. Usernames only.</p>
        </Tabs>

        <div className="mt-6 border border-line bg-screen p-4">
          <p className="font-semibold">{hidden ? "You're hidden from others" : "Others can see your username and EXP here"}</p>
          <p className="text-sm text-muted">
            {hidden ? "You still see the board and your own row." : "You can hide yourself anytime. You'll still see the board."}
          </p>
          <Button variant="secondary" className="mt-3" onClick={toggleHidden}>
            {hidden ? "Show me on the leaderboard" : "Hide me from the leaderboard"}
          </Button>
        </div>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------------ */

function Frame({ viewer, children }: { viewer: Viewer; children: ReactNode }) {
  const v = useVocab();
  return (
    <AppShell active="leaderboard" viewer={viewer}>
      <Link
        href="/profile"
        className="inline-flex min-h-tap items-center gap-1.5 font-semibold text-green underline-offset-4 hover:underline lg:hidden"
      >
        <PixelIcon name="chevronRight" scale={2} className="rotate-180" />
        {v("profile")}
      </Link>
      <h1 className="text-2xl font-semibold lg:text-3xl">Leaderboard</h1>
      {children}
    </AppShell>
  );
}

function Row({ row }: { row: ReturnType<typeof rankBoard>[number] }) {
  return (
    <tr
      aria-current={row.isYou ? "true" : undefined}
      className={cn(
        "border-b border-line",
        // Your row sticks to the bottom of the screen when it's scrolled out of view (above the phone nav).
        row.isYou && "sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-10 bg-green-tint font-semibold shadow-[0_-2px_0_var(--color-green)] lg:bottom-0",
      )}
    >
      <td className="py-2.5 pl-3 font-pixel text-hud">{row.rank}</td>
      <td className="py-2.5">
        <span className="break-all">{row.username}</span>
        {row.isYou && <span className="font-normal text-muted"> (you)</span>}
        {row.onlyYou && <span className="block text-xs font-normal text-muted">Only you can see this</span>}
      </td>
      <td className="py-2.5 text-right tabular-nums">{row.exp.toLocaleString("en-US")}</td>
      <td className="py-2.5 pl-3 pr-3 text-right tabular-nums">{row.apps}</td>
    </tr>
  );
}

function Notice({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <section className="mt-4 max-w-2xl border border-line bg-screen p-5">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-base text-muted">{body}</p>
      <div className="mt-4">{action}</div>
    </section>
  );
}

function Idea({ href, exp, children }: { href: string; exp: number; children: string }) {
  return (
    <li>
      <Link href={href} className="flex min-h-tap items-center justify-between gap-3 bg-bezel-raised px-3 hover:text-lime">
        <span>{children}</span>
        <span className="flex flex-none items-center gap-2 whitespace-nowrap font-pixel text-hud-sm uppercase text-lime">
          +{exp} EXP
          <PixelIcon name="chevronRight" scale={2} />
        </span>
      </Link>
    </li>
  );
}
