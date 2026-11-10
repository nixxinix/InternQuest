"use client";

import { useEffect, useState } from "react";
import { readJson, writeJson } from "@/lib/browser/storage";

/**
 * "Did you apply?" on return (SPEC §5.7, USER_FLOWS §3).
 *
 * The prompt shows only when:
 *   - the visitor clicked Apply on this device,
 *   - it was less than 2 hours ago,
 *   - they were away for at least 5 seconds (not just a quick tab switch),
 *   - and we haven't asked about that click yet.
 *
 * This is a prompt only. When accounts exist, "Yes" is checked on the server
 * against the logged click time before any EXP is given (decision #18).
 */

const KEY = "iq:pending-apply";
const WINDOW_MS = 2 * 60 * 60 * 1000;
const MIN_AWAY_MS = 5000;

export type PendingApply = {
  id: string;
  title: string;
  company: string;
  clickedAt: number;
  asked: boolean;
};

export function markApplyClicked(p: Pick<PendingApply, "id" | "title" | "company">) {
  writeJson(KEY, { ...p, clickedAt: Date.now(), asked: false } satisfies PendingApply);
}

/** Pure check, exported for tests. */
export function shouldPrompt(p: PendingApply | null, now: number, awayMs: number): boolean {
  if (!p || p.asked) return false;
  if (now - p.clickedAt > WINDOW_MS) return false;
  return awayMs >= MIN_AWAY_MS;
}

export function usePendingApplyPrompt() {
  const [prompt, setPrompt] = useState<PendingApply | null>(null);

  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const now = Date.now();
      const pending = readJson<PendingApply>(KEY);
      if (!shouldPrompt(pending, now, hiddenAt ? now - hiddenAt : 0) || !pending) return;
      writeJson(KEY, { ...pending, asked: true });
      setPrompt(pending);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return { prompt, dismiss: () => setPrompt(null) };
}
