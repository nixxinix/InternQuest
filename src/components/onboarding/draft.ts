"use client";

import { AVATAR_PRESETS } from "@/components/ui/sprites";
import type { Account } from "@/lib/account/account";
import type { FieldId } from "@/lib/catalog/fields";
import type { GameMode } from "@/lib/game/mode";
import type { Picks } from "@/lib/listings/picks";
import type { WorkType } from "@/lib/listings/types";

/**
 * Onboarding progress, kept for this browser session only so a refresh
 * doesn't lose it. NEVER contains the password or recovery codes.
 */
export type OnboardingDraft = {
  username: string;
  accountDone: boolean;
  recovery: "email" | "codes" | "skipped" | null;
  recoveryEmail: string;
  mode: GameMode;
  styleDone: boolean;
  look: { skin: string; hair: string };
  field: FieldId | null;
  skills: string[];
  cityId: string | null;
  workType: WorkType | null;
  status: string | null;
  school: string | null;
};

const KEY = "iq:onboarding";

export function newDraft(picks: Picks): OnboardingDraft {
  return {
    username: "",
    accountDone: false,
    recovery: null,
    recoveryEmail: "",
    mode: "full",
    styleDone: false,
    look: { skin: AVATAR_PRESETS.skin[2], hair: AVATAR_PRESETS.hair[0] },
    field: picks.field,
    skills: picks.skills,
    cityId: picks.city?.id ?? null,
    workType: null,
    status: null,
    school: null,
  };
}

/** Saved progress wins, but picks from the URL fill anything still empty. */
export function loadDraft(picks: Picks): OnboardingDraft {
  const base = newDraft(picks);
  let saved: Partial<OnboardingDraft> | null = null;
  try {
    saved = typeof window === "undefined" ? null : (JSON.parse(window.sessionStorage.getItem(KEY) ?? "null") as Partial<OnboardingDraft> | null);
  } catch {
    saved = null;
  }
  if (!saved) return base;
  return {
    ...base,
    ...saved,
    field: saved.field ?? base.field,
    skills: saved.skills && saved.skills.length ? saved.skills : base.skills,
    cityId: saved.cityId ?? base.cityId,
  };
}

export function saveDraft(d: OnboardingDraft) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // Storage blocked: the flow still works, it just won't survive a refresh.
  }
}

export function clearDraft() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/**
 * With real accounts, the server is the truth for step 1: signed in means the
 * account exists (resume at step 2 on any device), signed out means start over.
 */
export function draftWithAccount(d: OnboardingDraft, account: Account | null): OnboardingDraft {
  if (!account) return { ...d, accountDone: false };
  return {
    ...d,
    username: account.username,
    accountDone: true,
    recovery: account.recovery.kind !== "none" ? account.recovery.kind : d.recovery,
    mode: d.styleDone ? d.mode : account.settings.mode,
    look: d.styleDone ? d.look : account.look,
  };
}

/** Highest step the visitor may open (2 and 3 are skippable but must be passed through). */
export function maxStep(d: OnboardingDraft): 1 | 2 | 3 | 4 {
  if (!d.accountDone) return 1;
  if (!d.recovery) return 2;
  if (!d.styleDone) return 3;
  return 4;
}
