"use client";

import { completeChecklist, saveChecklistProgress } from "@/app/actions/game";
import { LIVE } from "@/components/providers/AccountProvider";
import { useFeatures } from "@/components/providers/GameModeProvider";
import { Checkbox } from "@/components/ui/Field";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { doneCount, toggleItem } from "@/lib/content/checklist";
import { useTips } from "./TipsShell";
import { useChecklist } from "./useChecklist";

const REWARD = 10; // SPEC §10 "Finish a tips checklist +10". With accounts, the server decides and grants it.

/** The guide's checklist. Ticks are saved as you go; finishing it the first time gives +10 EXP. */
export function Checklist({ slug, items }: { slug: string; items: { id: string; text: string }[] }) {
  const f = useFeatures();
  const { reward, fromServer, syncs } = useTips();
  const [state, setState] = useChecklist(slug);
  const ids = items.map((i) => i.id);
  const done = doneCount(state, ids);
  const complete = done === ids.length;

  return (
    <div className="border border-line bg-screen p-4">
      <p className="text-sm font-semibold text-muted" aria-live="polite">
        {done} of {ids.length} done
        {f.exp && !state.rewarded ? ` · Finish them all for +${REWARD} EXP (once)` : ""}
      </p>
      <ul className="mt-2">
        {items.map((item) => (
          <li key={item.id}>
            <Checkbox
              label={item.text}
              checked={state.done.includes(item.id)}
              onChange={() => {
                const next = toggleItem(state, item.id, ids);
                setState(next.state);
                // Signed in: the ticks follow you to other devices. If saving fails, they stay on this one.
                if (syncs) saveChecklistProgress(slug, next.state.done).catch(() => {});
                if (!next.completedNow) return;
                if (!LIVE) {
                  reward(REWARD, "Checklist done. Nice prep.");
                  return;
                }
                // Once per guide, checked on the server. A failed call just means no EXP this time.
                completeChecklist(slug)
                  .then((r) => fromServer(r.ok ? r.reward : null, "Checklist done. Nice prep."))
                  .catch(() => fromServer(null, "Checklist done. Nice prep."));
              }}
            />
          </li>
        ))}
      </ul>
      {complete && (
        <p className="mt-2 flex items-center gap-2 border-l-4 border-green bg-green-tint p-3 font-semibold">
          <PixelIcon name="check" scale={2} />
          All done. You&apos;re ready for this step.
        </p>
      )}
      <p className="mt-2 text-xs text-muted">{syncs ? "Saved to your account." : "Saved on this device."}</p>
    </div>
  );
}

/** "Checklist 3 of 9" under a guide's title, or on the Tips index. */
export function ChecklistProgress({ slug, ids }: { slug: string; ids: string[] }) {
  const [state] = useChecklist(slug);
  const done = doneCount(state, ids);
  return (
    <span>
      Checklist {done} of {ids.length}
      {done === ids.length && <span className="sr-only"> (complete)</span>}
    </span>
  );
}

/** Prints just the title and the checklist (see globals.css print rules). */
export function PrintChecklistButton() {
  return (
    <button
      type="button"
      onClick={() => {
        const html = document.documentElement;
        html.dataset.print = "checklist";
        const clear = () => {
          delete html.dataset.print;
          window.removeEventListener("afterprint", clear);
        };
        window.addEventListener("afterprint", clear);
        window.print();
      }}
      className="no-print inline-flex min-h-tap items-center gap-2 font-semibold text-green underline decoration-2 underline-offset-4"
    >
      <PixelIcon name="download" scale={2} />
      Print checklist
    </button>
  );
}
