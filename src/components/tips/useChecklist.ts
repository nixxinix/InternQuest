"use client";

import { useCallback, useSyncExternalStore } from "react";
import { writeJson } from "@/lib/browser/storage";
import { parseChecklist, type ChecklistState } from "@/lib/content/checklist";

/**
 * Checklist ticks for one guide, kept on this device so they work offline
 * and without an account. Signed in, they're also saved on the server
 * (tips_progress) and filled in here on a new device (seedChecklist).
 */
const key = (slug: string) => `iq:checklist:${slug}`;
const EVENT = "iq-checklist-change";
/** Used when storage is blocked (private mode): ticks still work until the page closes. */
const memory = new Map<string, string>();

function subscribe(notify: () => void) {
  window.addEventListener("storage", notify); // other tabs
  window.addEventListener(EVENT, notify); // this tab
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(EVENT, notify);
  };
}

/** Fills this device's ticks from the server copy, only when this device has none yet. */
export function seedChecklist(slug: string, done: string[]) {
  try {
    if (window.localStorage.getItem(key(slug)) || memory.has(key(slug))) return;
  } catch {
    if (memory.has(key(slug))) return;
  }
  const state = { done, rewarded: false };
  memory.set(key(slug), JSON.stringify(state));
  writeJson(key(slug), state);
  window.dispatchEvent(new Event(EVENT));
}

export function useChecklist(slug: string): [ChecklistState, (next: ChecklistState) => void] {
  // The raw string is the snapshot: strings compare by value, so unchanged storage never re-renders.
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(key(slug)) ?? memory.get(key(slug)) ?? null;
      } catch {
        return memory.get(key(slug)) ?? null;
      }
    },
    () => null,
  );
  const set = useCallback(
    (next: ChecklistState) => {
      memory.set(key(slug), JSON.stringify(next));
      writeJson(key(slug), next);
      window.dispatchEvent(new Event(EVENT));
    },
    [slug],
  );
  return [parseChecklist(raw), set];
}
