"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { useReward } from "@/components/game/useReward";
import { AppShell } from "@/components/layout/AppShell";
import { useFindListing } from "@/components/providers/ListingsProvider";
import {
  addExternalApplication,
  confirmApplication,
  dismissApplyPrompt,
  moveApplication,
  removeApplication,
  restoreApplication,
  updateApplicationDetails,
} from "@/app/actions/questlog";
import { LIVE, initialModeFor, initialMotionFor, useAppAccount } from "@/components/providers/AccountProvider";
import { GameModeProvider, useFeatures, useVocab } from "@/components/providers/GameModeProvider";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { OutcomeList, QuestLogCard, type QuestLogItem, type QuestLogPatch } from "@/components/ui/QuestLogCard";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { viewerFromAccount } from "@/lib/account/account";
import { findCityById } from "@/lib/catalog/cities";
import type { ServerReward } from "@/lib/game/exp";
import { picksQuery, withQuery } from "@/lib/listings/picks";
import { sampleQuestLog } from "@/lib/sample/questlog";
import { SAMPLE_NEW_VIEWER, SAMPLE_VIEWER, type Viewer } from "@/lib/sample/viewer";
import {
  confirmEntry,
  defaultTab,
  entryDateText,
  expForConfirm,
  expForMove,
  externalEntry,
  groupByStatus,
  manilaDate,
  moveEntry,
  sortColumn,
  type ExternalDraft,
  type LogEntry,
} from "@/lib/tracker/log";
import { OUTCOME_LABEL, STATUSES, STATUS_LABEL, type Outcome, type Status } from "@/lib/tracker/status";
import { AddExternalSheet } from "./AddExternalSheet";

const isStatus = (s: string | null): s is Status => (STATUSES as readonly string[]).includes(s ?? "");

/**
 * W7 Quest log. Signed in: the real log from the database; every change is
 * saved by a server action (rolled back with a retry if it fails).
 * Design preview (no Supabase): sample user and log, with review-only switches
 * ?mode=full|light|plain, ?state=new (empty log), ?state=fail (saves fail and roll back).
 */
export function QuestLogScreen() {
  const params = useSearchParams();
  const account = useAppAccount();
  const state = account ? null : params.get("state");
  const [today] = useState(() => manilaDate(new Date()));
  return (
    <GameModeProvider initialMode={initialModeFor(account, params.get("mode"))} initialMotion={initialMotionFor(account)}>
      <ToastProvider>
        <QuestLog
          today={today}
          initialViewer={account ? viewerFromAccount(account) : state === "new" ? SAMPLE_NEW_VIEWER : SAMPLE_VIEWER}
          initialLog={account ? account.questLog : state === "new" ? [] : sampleQuestLog(today)}
          failSaves={state === "fail"}
        />
      </ToastProvider>
    </GameModeProvider>
  );
}

/** Design preview only: pretends to save (?state=fail makes it fail, to review the rollback). */
function persist(fail: boolean): Promise<SaveResult> {
  return new Promise((resolve, reject) =>
    setTimeout(() => (fail ? reject(new Error("Network error")) : resolve({ ok: true })), fail ? 600 : 0),
  );
}

type SaveResult = { ok: true; entry?: LogEntry; reward?: ServerReward | null } | { ok: false; error: string };

function QuestLog({
  today,
  initialViewer,
  initialLog,
  failSaves,
}: {
  today: string;
  initialViewer: Viewer;
  initialLog: LogEntry[];
  failSaves: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const f = useFeatures();
  const v = useVocab();
  const toast = useToast();

  const findListing = useFindListing();
  const [viewer, setViewer] = useState(initialViewer);
  const { reward, fromServer, levelUpDialog } = useReward(viewer, setViewer);
  const [log, setLog] = useState(initialLog);
  const [confirmedToday, setConfirmedToday] = useState(0);
  const [firstTab] = useState(() => defaultTab(initialLog));
  const [addOpen, setAddOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);
  const [resultFor, setResultFor] = useState<string | null>(null);
  const nextLocalId = useRef(1);

  const tabParam = params.get("tab");
  const tab: Status = isStatus(tabParam) ? tabParam : firstTab;
  const setTab = (next: Status) => {
    const q = new URLSearchParams(window.location.search);
    q.set("tab", next);
    router.replace(`${pathname}?${q}`, { scroll: false });
  };

  const city = findCityById(viewer.cityId);
  const detailQuery = picksQuery({ field: viewer.field, skills: viewer.skills, city, remoteOk: true });
  const deadlineOf = (e: LogEntry) => (e.listingId ? (findListing(e.listingId)?.deadlineInDays ?? null) : null);
  const groups = groupByStatus(log);
  const columns = Object.fromEntries(STATUSES.map((s) => [s, sortColumn(s, groups[s], deadlineOf)])) as Record<Status, LogEntry[]>;

  const toItem = (e: LogEntry): QuestLogItem => ({
    id: e.id,
    title: e.title,
    company: e.company,
    status: e.status,
    outcome: e.outcome,
    dateText: entryDateText(e, today),
    awaitingConfirm: e.awaitingConfirm,
    listingHref: e.listingId ? withQuery(`/listings/${e.listingId}`, detailQuery) : null,
    externalUrl: e.url,
    external: e.listingId === null,
    note: e.note,
    interviewAt: e.interviewAt,
    interviewHow: e.interviewHow,
  });

  /* ---------------- Saving: optimistic, rolled back with a retry if it fails (W7) ---------------- */

  /**
   * Shows the change right away, then saves it (live: the server action `op`).
   * If saving fails, the change is undone and the toast offers a retry.
   */
  const commit = (
    next: LogEntry[],
    before: LogEntry[],
    onSaved?: (saved?: LogEntry, granted?: ServerReward | null) => void,
    op?: () => Promise<SaveResult>,
  ) => {
    setLog(next);
    const run: Promise<SaveResult> = LIVE && op ? op() : persist(failSaves);
    run
      .catch((): SaveResult => ({ ok: false, error: "We couldn't save that change, so it was undone. Check your connection." }))
      .then((r) => {
        if (r.ok) {
          onSaved?.(r.entry, r.reward);
          return;
        }
        setLog(before);
        toast({
          tone: "error",
          message: r.error.includes("undone") ? r.error : `${r.error} Your change was undone.`,
          action: { label: "Try again", onClick: () => commit(next, before, onSaved, op) },
        });
      });
  };

  /** Swaps an entry for the version the server saved (real id, server-decided fields). */
  const replaceEntry = (localId: string, saved?: LogEntry) => {
    if (saved) setLog((l) => l.map((x) => (x.id === localId ? saved : x)));
  };

  const moveMessage = (to: Status, outcome: Outcome | null): string => {
    if (to === "result") {
      if (outcome === "offer") return "An offer! Congratulations.";
      if (outcome === "not_selected") return f.exp ? "Not this time, but logging it still counts." : "Logged as not selected.";
      return `Logged as ${OUTCOME_LABEL[outcome ?? "no_reply"].toLowerCase()}.`;
    }
    if (to === "interview") return "Moved to Interview. Your prep guide is on the card.";
    return `Moved to ${STATUS_LABEL[to]}.`;
  };

  const move = (id: string, to: Status, outcome?: Outcome) => {
    const e = log.find((x) => x.id === id);
    if (!e) return;
    const exp = expForMove(e, to, outcome ?? null);
    const moved: LogEntry = { ...moveEntry(e, to, outcome ?? null, today), rewarded: exp ? [...e.rewarded, exp.key] : e.rewarded };
    const before = log;
    commit(
      log.map((x) => (x.id === id ? moved : x)),
      before,
      (_saved, granted) => {
        const message = moveMessage(to, outcome ?? null);
        if (LIVE) fromServer(granted, message);
        else if (exp) reward(exp.amount, message);
        else toast({ message, tone: "success" });
      },
      () => moveApplication(id, to, outcome ?? null),
    );
    // Phones: follow the card, so its next step (like interview prep) is right there (SPEC §8).
    if (to !== tab) setTab(to);
  };

  const confirm = (id: string) => {
    const e = log.find((x) => x.id === id);
    if (!e) return;
    const exp = expForConfirm(e, confirmedToday);
    const done: LogEntry = { ...confirmEntry(e, today), rewarded: exp ? [...e.rewarded, exp.key] : e.rewarded };
    const listingId = e.listingId;
    commit(
      log.map((x) => (x.id === id ? done : x)),
      log,
      (saved, granted) => {
        replaceEntry(id, saved);
        setConfirmedToday((n) => n + 1);
        if (LIVE) fromServer(granted, "Marked as applied.", (v0) => ({ ...v0, applicationsTotal: v0.applicationsTotal + 1 }));
        else if (exp) reward(exp.amount, "Marked as applied.");
        else toast({ message: "Marked as applied.", tone: "success" });
      },
      listingId ? () => confirmApplication(listingId) : undefined,
    );
    setTab("applied");
  };

  const dismissConfirm = (id: string) =>
    commit(
      log.map((x) => (x.id === id ? { ...x, awaitingConfirm: false } : x)),
      log,
      () => toast({ message: "Okay, it stays in Saved." }),
      () => dismissApplyPrompt(id),
    );

  const update = (id: string, patch: QuestLogPatch) =>
    commit(
      log.map((x) => (x.id === id ? { ...x, ...patch } : x)),
      log,
      () => toast({ message: "Details saved.", tone: "success" }),
      () => updateApplicationDetails(id, patch),
    );

  const remove = (id: string) => {
    const before = log;
    const after = log.filter((x) => x.id !== id);
    const removed = log.find((x) => x.id === id);
    commit(
      after,
      before,
      () =>
        toast({
          message: `Removed from your ${v("tracker").toLowerCase()}.`,
          action: {
            label: "Undo",
            onClick: () =>
              commit(before, after, (saved) => replaceEntry(id, saved), removed ? () => restoreApplication(removed) : undefined),
          },
        }),
      () => removeApplication(id),
    );
  };

  const add = (draft: ExternalDraft) => {
    // Temporary id until the server answers with the saved entry.
    const entry = externalEntry(draft, `x-${nextLocalId.current++}`, today);
    commit(
      [entry, ...log],
      log,
      (saved) => {
        replaceEntry(entry.id, saved);
        toast({ message: `Added to ${STATUS_LABEL[entry.status]}.`, tone: "success" });
      },
      () => addExternalApplication(draft),
    );
    setTab(entry.status);
  };

  /* ---------------- Desktop drag and drop ---------------- */

  const drop = (id: string, to: Status) => {
    const e = log.find((x) => x.id === id);
    if (!e || (e.status === to && to !== "result")) return;
    if (to === "result") setResultFor(id); // ask for the outcome first
    else move(id, to);
  };

  const card = (e: LogEntry, draggable: boolean) => (
    <QuestLogCard
      item={toItem(e)}
      onMove={move}
      onConfirmApplied={confirm}
      onDismissConfirm={dismissConfirm}
      onUpdate={update}
      onRemove={remove}
      drag={
        draggable
          ? {
              dragging: dragId === e.id,
              onDragStart: (ev) => {
                ev.dataTransfer.effectAllowed = "move";
                ev.dataTransfer.setData("text/plain", e.id);
                setDragId(e.id);
              },
              onDragEnd: () => {
                setDragId(null);
                setOverCol(null);
              },
            }
          : undefined
      }
    />
  );

  const resultEntry = resultFor ? log.find((x) => x.id === resultFor) : null;

  return (
    <AppShell active="tracker" viewer={viewer}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold lg:text-3xl">{v("tracker")}</h1>
        {/* Phones get this button under the list instead. */}
        <div className="hidden lg:block">
          <Button variant="secondary" icon={<PixelIcon name="plus" scale={2} />} onClick={() => setAddOpen(true)}>
            Add one from elsewhere
          </Button>
        </div>
      </div>

      {/* ---------------- Phones and tablets: tabs ---------------- */}
      <div className="mt-4 lg:hidden">
        <Tabs
          label={`${v("tracker")} status`}
          value={tab}
          onChange={(id) => setTab(id as Status)}
          tabs={STATUSES.map((s) => ({ id: s, label: STATUS_LABEL[s], count: groups[s].length }))}
        >
          {columns[tab].length === 0 ? (
            <TabEmpty status={tab} findLabel={`Find ${v("listings").toLowerCase()}`} />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {columns[tab].map((e) => (
                <li key={e.id}>{card(e, false)}</li>
              ))}
            </ul>
          )}
        </Tabs>
        <Button variant="secondary" block className="mt-4" icon={<PixelIcon name="plus" scale={2} />} onClick={() => setAddOpen(true)}>
          Add one from elsewhere
        </Button>
      </div>

      {/* ---------------- Desktop: board ---------------- */}
      <div className="mt-5 hidden gap-3 lg:grid lg:grid-cols-4">
        {STATUSES.map((s) => (
          <section
            key={s}
            aria-labelledby={`col-${s}`}
            onDragOver={(ev) => {
              if (!dragId) return;
              ev.preventDefault();
              ev.dataTransfer.dropEffect = "move";
              if (overCol !== s) setOverCol(s);
            }}
            onDragLeave={(ev) => {
              if (!ev.currentTarget.contains(ev.relatedTarget as Node | null)) setOverCol(null);
            }}
            onDrop={(ev) => {
              ev.preventDefault();
              const id = dragId ?? ev.dataTransfer.getData("text/plain");
              setDragId(null);
              setOverCol(null);
              if (id) drop(id, s);
            }}
            className={cn(
              "flex min-h-[28rem] min-w-0 flex-col border-2 p-2 transition-colors duration-(--motion-fast)",
              overCol === s ? "border-dashed border-green bg-green-tint" : "border-transparent bg-line/40",
            )}
          >
            <h2 id={`col-${s}`} className="flex items-center justify-between border-b-2 border-bezel px-1 pb-2 pt-1">
              <span className={f.avatar ? "font-pixel text-hud uppercase" : "text-base font-semibold"}>{STATUS_LABEL[s]}</span>
              <span className="min-w-6 bg-bezel px-1 text-center font-pixel text-hud-sm text-screen">{groups[s].length}</span>
            </h2>
            {columns[s].length === 0 ? (
              <p className="px-1 py-4 text-sm text-muted">{BOARD_EMPTY[s]}</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {columns[s].map((e) => (
                  <li key={e.id}>{card(e, true)}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      <p className="mt-3 hidden text-sm text-muted lg:block">Drag cards between columns, or use &ldquo;Move to…&rdquo; on a card.</p>

      {/* ---------------- Sheets ---------------- */}
      <AddExternalSheet open={addOpen} onClose={() => setAddOpen(false)} onAdd={add} today={today} />
      <Sheet
        open={resultEntry != null}
        onClose={() => setResultFor(null)}
        title="How did it go?"
        description={resultEntry ? `${resultEntry.title} at ${resultEntry.company}. Every outcome counts as progress.` : undefined}
      >
        <OutcomeList
          onPick={(o) => {
            if (resultFor) move(resultFor, "result", o);
            setResultFor(null);
          }}
        />
      </Sheet>
      {levelUpDialog}
    </AppShell>
  );
}

/* ------------------------------------------------------------------------ */

const BOARD_EMPTY: Record<Status, string> = {
  saved: "Saved listings wait here until you're ready.",
  applied: "Applications you send show up here.",
  interview: "Drop a card here when a company invites you.",
  result: "Offers, rejections, and no-replies. All of them count.",
};

function TabEmpty({ status, findLabel }: { status: Status; findLabel: string }): ReactNode {
  switch (status) {
    case "saved":
      return (
        <EmptyState
          title="Nothing saved yet"
          body="Tap the bookmark on any listing and it waits here until you're ready."
          action={<ButtonLink href="/search">{findLabel}</ButtonLink>}
        />
      );
    case "applied":
      return (
        <EmptyState
          title="No applications yet"
          body="When you apply through InternQuest, we'll ask if you sent it and move it here. Applied somewhere else? Add it below."
        />
      );
    case "interview":
      return (
        <EmptyState
          title="No interviews yet"
          body="Move a card here when a company invites you. We'll show you how to prepare."
          action={
            <ButtonLink href="/tips/interview" variant="secondary">
              Read interview tips
            </ButtonLink>
          }
        />
      );
    case "result":
      return <EmptyState title="No results yet" body="Offers, rejections, and no-replies all go here. Each one is progress." />;
  }
}
