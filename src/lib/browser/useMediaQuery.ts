"use client";

import { useCallback, useSyncExternalStore } from "react";

/** The `lg` breakpoint from the design system (64rem = 1024px). */
export const DESKTOP_QUERY = "(min-width: 64rem)";

/**
 * True while a media query matches. Returns false on the server and during
 * hydration, then updates, so phone layout is the safe default.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", notify);
      return () => mql.removeEventListener("change", notify);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
