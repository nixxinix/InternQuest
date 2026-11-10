"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from its previous value to `target` (EXP count-up).
 * When `animate` is false (Light/Plain mode, reduced motion) it returns the
 * target immediately. Display only: the real EXP comes from the server.
 */
export function useCountUp(target: number, animate: boolean, durationMs = 600): number {
  const [state, setState] = useState({ value: target, target });
  const fromRef = useRef(target);

  useEffect(() => {
    const from = fromRef.current;
    fromRef.current = target;
    // Only count UP. A lower value means a new level started: jump straight to it,
    // because counting down would look like the user lost EXP.
    if (!animate || target <= from) return;

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      setState({ value: Math.round(from + (target - from) * p), target });
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, animate, durationMs]);

  // Only use the animated value while it belongs to the current target.
  return animate && state.target === target ? state.value : target;
}
