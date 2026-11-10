"use client";

import Link from "next/link";
import { useState, type DragEvent } from "react";
import { cn } from "@/lib/cn";
import { HOW_MAX, NOTE_MAX } from "@/lib/tracker/log";
import {
  OUTCOME_LABEL,
  OUTCOMES,
  STATUS_LABEL,
  STATUSES,
  nextStepHint,
  type Outcome,
  type Status,
} from "@/lib/tracker/status";
import { Button } from "./Button";
import { TextField } from "./Field";
import { PixelIcon } from "./PixelIcon";
import { Sheet } from "./Sheet";

export type QuestLogItem = {
  id: string;
  title: string;
  company: string;
  status: Status;
  outcome?: Outcome | null;
  /** e.g. "Applied Nov 3", "Interview Thu, Nov 12 · 10:00 AM" */
  dateText?: string | null;
  /** Apply was clicked but never confirmed (USER_FLOWS §3). */
  awaitingConfirm?: boolean;
  /** The listing on InternQuest. Next-step links like "#match" point into it. */
  listingHref?: string | null;
  /** Entries added by hand: the original posting (already checked to be http/https). */
  externalUrl?: string | null;
  /** Added by hand from outside InternQuest (tracking only, no EXP). */
  external?: boolean;
  note?: string;
  /** YYYY-MM-DDTHH:mm, Manila time. */
  interviewAt?: string | null;
  interviewHow?: string;
};

export type QuestLogPatch = { note: string; interviewAt: string | null; interviewHow: string };

type QuestLogCardProps = {
  item: QuestLogItem;
  onMove: (id: string, status: Status, outcome?: Outcome) => void;
  onConfirmApplied?: (id: string) => void;
  onDismissConfirm?: (id: string) => void;
  /** Enables the details sheet (notes, interview time, link). */
  onUpdate?: (id: string, patch: QuestLogPatch) => void;
  onRemove?: (id: string) => void;
  /** Desktop board: drag the card to another column. "Move to…" stays as the keyboard and touch path. */
  drag?: { onDragStart: (e: DragEvent<HTMLElement>) => void; onDragEnd: () => void; dragging: boolean };
};

/**
 * Tracker card. Moving uses a "Move to…" sheet, which is the keyboard and
 * touch path. Desktop drag and drop calls the same onMove.
 */
export function QuestLogCard({ item, onMove, onConfirmApplied, onDismissConfirm, onUpdate, onRemove, drag }: QuestLogCardProps) {
  const [open, setOpen] = useState(false);
  const [pickOutcome, setPickOutcome] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const rawHint = nextStepHint(item.status, item.outcome);
  // "#match" style hints point into the listing page; entries added by hand have no page to point into.
  const hint =
    rawHint && rawHint.href.startsWith("#")
      ? item.listingHref
        ? { ...rawHint, href: `${item.listingHref}${rawHint.href}` }
        : null
      : rawHint;

  const close = () => {
    setOpen(false);
    setPickOutcome(false);
  };

  return (
    <article
      draggable={drag ? true : undefined}
      onDragStart={drag?.onDragStart}
      onDragEnd={drag?.onDragEnd}
      className={cn("border border-line bg-screen p-4", drag && "lg:cursor-grab", drag?.dragging && "opacity-50")}
    >
      <h3 className="text-lg font-semibold leading-snug">
        {onUpdate ? (
          // The title opens the details. Always underlined, so it reads as tappable without hover.
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            aria-haspopup="dialog"
            className="text-left underline decoration-line decoration-2 underline-offset-4 hover:decoration-ink"
          >
            {item.title}
            <span className="sr-only"> (details and notes)</span>
          </button>
        ) : (
          item.title
        )}
      </h3>
      <p className="text-base">{item.company}</p>
      {/* The column or tab already says the status, so only a result's outcome is shown. */}
      {(item.outcome || item.dateText || item.external) && (
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          {item.status === "result" && item.outcome && (
            <span className="bg-canvas px-1.5 font-semibold text-ink">{OUTCOME_LABEL[item.outcome]}</span>
          )}
          {item.dateText && <span>{item.dateText}</span>}
          {item.external && <span className="border border-line px-1.5">Added by you</span>}
        </p>
      )}
      <span className="sr-only">Status: {STATUS_LABEL[item.status]}.</span>
      {item.status === "interview" && item.interviewHow && <p className="mt-1 text-sm text-muted">{item.interviewHow}</p>}
      {item.note && (
        <p className="mt-2 line-clamp-2 border-l-2 border-line pl-2 text-sm text-muted">
          <span className="sr-only">Your note: </span>
          {item.note}
        </p>
      )}

      {item.awaitingConfirm && (
        <div className="mt-3 bg-canvas p-3">
          <p className="font-semibold">Did you send your application to {item.company}?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="md" onClick={() => onConfirmApplied?.(item.id)}>
              Yes, I applied
            </Button>
            <Button variant="secondary" onClick={() => onDismissConfirm?.(item.id)}>
              Not yet
            </Button>
          </div>
        </div>
      )}

      {hint && !item.awaitingConfirm && (
        <Link
          href={hint.href}
          className="mt-3 flex min-h-tap items-center justify-between gap-2 border-l-4 border-green bg-green-tint px-3 text-sm font-semibold text-ink"
        >
          <span>
            <span className="sr-only">Next step: </span>
            {hint.text}
          </span>
          <PixelIcon name="chevronRight" scale={2} />
        </Link>
      )}

      <Button variant="secondary" className="mt-3" onClick={() => setOpen(true)} aria-haspopup="dialog">
        Move to…
        <span className="sr-only"> ({item.title})</span>
      </Button>

      <Sheet
        open={open}
        onClose={close}
        title={pickOutcome ? "How did it go?" : `Move "${item.title}"`}
        description={pickOutcome ? "Every outcome counts as progress." : undefined}
      >
        {!pickOutcome ? (
          <ul className="grid gap-2">
            {STATUSES.map((s) => {
              const current = s === item.status && s !== "result";
              return (
                <li key={s}>
                  <Button
                    variant={current ? "secondary" : "primary"}
                    block
                    disabled={current}
                    aria-current={current ? "true" : undefined}
                    className={cn(current && "justify-between")}
                    onClick={() => {
                      if (s === "result") {
                        setPickOutcome(true);
                        return;
                      }
                      onMove(item.id, s);
                      close();
                    }}
                  >
                    {STATUS_LABEL[s]}
                    {current && <span className="text-sm font-normal">(current)</span>}
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <OutcomeList
            onPick={(o) => {
              onMove(item.id, "result", o);
              close();
            }}
            onBack={() => setPickOutcome(false)}
          />
        )}
      </Sheet>

      {onUpdate && (
        <Sheet open={detailsOpen} onClose={() => setDetailsOpen(false)} title={item.title} description={item.company}>
          {detailsOpen && (
            <DetailsForm
              item={item}
              onSave={(patch) => {
                onUpdate(item.id, patch);
                setDetailsOpen(false);
              }}
              onRemove={
                onRemove
                  ? () => {
                      setDetailsOpen(false);
                      onRemove(item.id);
                    }
                  : undefined
              }
            />
          )}
        </Sheet>
      )}
    </article>
  );
}

/** Result outcomes. Also used by the board when a card is dropped on Result. */
export function OutcomeList({ onPick, onBack }: { onPick: (o: Outcome) => void; onBack?: () => void }) {
  return (
    <ul className="grid gap-2">
      {OUTCOMES.map((o) => (
        <li key={o}>
          <Button variant="secondary" block onClick={() => onPick(o)}>
            {OUTCOME_LABEL[o]}
          </Button>
        </li>
      ))}
      {onBack && (
        <li>
          <Button variant="ghost" block onClick={onBack}>
            Back
          </Button>
        </li>
      )}
    </ul>
  );
}

function DetailsForm({
  item,
  onSave,
  onRemove,
}: {
  item: QuestLogItem;
  onSave: (patch: QuestLogPatch) => void;
  onRemove?: () => void;
}) {
  const [note, setNote] = useState(item.note ?? "");
  const [at, setAt] = useState(item.interviewAt ?? "");
  const [how, setHow] = useState(item.interviewHow ?? "");

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ note: note.trim(), interviewAt: at || null, interviewHow: how.trim() });
      }}
      className="space-y-4"
    >
      {item.listingHref ? (
        <Link
          href={item.listingHref}
          className="inline-flex min-h-tap items-center gap-1 font-semibold text-green underline decoration-2 underline-offset-4"
        >
          View the listing <PixelIcon name="chevronRight" scale={2} />
        </Link>
      ) : item.externalUrl ? (
        <a
          href={item.externalUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex min-h-tap items-center gap-2 font-semibold text-green underline decoration-2 underline-offset-4"
        >
          Open the original posting <PixelIcon name="external" scale={2} />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      ) : null}

      {item.status === "interview" && (
        <>
          <TextField label="Interview date and time" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} optional />
          <TextField
            label="Where or how"
            value={how}
            onChange={(e) => setHow(e.target.value)}
            maxLength={HOW_MAX}
            placeholder="e.g. Online (Google Meet), or the office address"
            optional
          />
        </>
      )}

      <div className="space-y-1">
        <label htmlFor={`note-${item.id}`} className="block text-sm font-semibold">
          Notes <span className="font-normal text-muted">(only you can see these)</span>
        </label>
        <textarea
          id={`note-${item.id}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={NOTE_MAX}
          rows={4}
          placeholder="Who you talked to, what to follow up on…"
          className="block w-full border-2 border-muted bg-screen p-3 text-base placeholder:text-muted"
        />
        <p className="text-right text-xs text-muted" aria-hidden="true">
          {note.length}/{NOTE_MAX}
        </p>
      </div>

      <Button type="submit" block>
        Save details
      </Button>

      {/* One tap, with Undo in the toast that follows (same pattern as Save). */}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex min-h-tap w-full items-center justify-center font-semibold text-alert underline decoration-2 underline-offset-4"
        >
          Remove from log
        </button>
      )}
    </form>
  );
}
