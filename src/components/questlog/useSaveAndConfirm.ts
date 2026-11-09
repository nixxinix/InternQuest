"use client";

import type { Dispatch, SetStateAction } from "react";
import { confirmApplication, dismissApplyPromptForListing, saveListing, unsaveListing } from "@/app/actions/questlog";
import { LIVE } from "@/components/providers/AccountProvider";
import { useVocab } from "@/components/providers/GameModeProvider";
import { useToast } from "@/components/ui/Toast";
import type { ServerReward } from "@/lib/game/exp";
import type { Viewer } from "@/lib/sample/viewer";

type Result = ({ ok: true } & { reward?: ServerReward | null }) | { ok: false; error: string };
const NETWORK = "Couldn't reach InternQuest. Check your connection and try again.";

async function run(op: () => Promise<Result>): Promise<Result> {
  if (!LIVE) return { ok: true }; // design preview: changes live on the page only
  try {
    return await op();
  } catch {
    return { ok: false, error: NETWORK };
  }
}

type Rewards = {
  /** Design preview: a sample amount. */
  reward: (amount: number, message: string, patch?: (v: Viewer) => Viewer) => void;
  /** Real accounts: what the server granted. */
  fromServer: (r: ServerReward | null | undefined, message: string, patch?: (v: Viewer) => Viewer) => void;
};

/**
 * Save / un-save a listing and answer "Did you apply?", from Home and Search.
 * The change shows right away; if the server refuses, it's put back and the
 * toast says why. EXP shown is the server's (first save, confirmations).
 */
export function useSaveAndConfirm(setViewer: Dispatch<SetStateAction<Viewer>>, rewards: Rewards) {
  const toast = useToast();
  const v = useVocab();

  const mark = (id: string, saved: boolean) =>
    setViewer((v0) => ({ ...v0, saved: saved ? [...v0.saved.filter((s) => s !== id), id] : v0.saved.filter((s) => s !== id) }));

  const setSaved = async (id: string, saved: boolean, withUndo: boolean) => {
    mark(id, saved);
    const r = await run(() => (saved ? saveListing(id) : unsaveListing(id)));
    if (!r.ok) {
      mark(id, !saved);
      toast({ tone: "error", message: r.error });
      return;
    }
    const message = saved ? `Saved to your ${v("tracker").toLowerCase()}.` : "Removed from saved.";
    // The first save ever is a tutorial step (+10 from the server).
    if (r.reward && r.reward.amount > 0) {
      rewards.fromServer(r.reward, message);
      return;
    }
    toast({
      message,
      action: withUndo ? { label: "Undo", onClick: () => void setSaved(id, !saved, false) } : undefined,
    });
  };

  const toggleSave = (id: string, isSaved: boolean) => void setSaved(id, !isSaved, true);

  /** "Yes, I applied": the server checks for the Apply click first, then grants EXP. */
  const confirmApplied = async (id: string, extra?: (v: Viewer) => Viewer) => {
    const r = await run(() => confirmApplication(id));
    if (!r.ok) {
      toast({ tone: "error", message: r.error });
      return;
    }
    const patch = (v0: Viewer): Viewer => ({
      ...(extra && !LIVE ? extra(v0) : v0),
      applied: v0.applied.includes(id) ? v0.applied : [...v0.applied, id],
      saved: v0.saved.filter((s) => s !== id),
      pendingConfirm: v0.pendingConfirm === id ? null : v0.pendingConfirm,
      applicationsTotal: LIVE ? v0.applicationsTotal + 1 : v0.applicationsTotal,
    });
    if (LIVE) rewards.fromServer(r.reward, "Marked as applied.", patch);
    else rewards.reward(20, "Marked as applied.", patch);
  };

  /** "Not yet": keep it in Saved and stop asking until the next Apply click. */
  const notYet = async (id: string) => {
    setViewer((v0) => ({ ...v0, saved: v0.saved.includes(id) ? v0.saved : [...v0.saved, id], pendingConfirm: null }));
    const r = await run(() => dismissApplyPromptForListing(id));
    if (!r.ok) toast({ tone: "error", message: r.error });
  };

  return { toggleSave, confirmApplied, notYet };
}
