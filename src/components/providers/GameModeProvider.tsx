"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { DEFAULT_MODE, modeFeatures, vocab, type GameMode, type VocabKey } from "@/lib/game/mode";

/** "system" follows the OS setting. "reduce" is the in-app Animations toggle turned off. */
export type MotionPreference = "system" | "reduce";

type GameModeContextValue = {
  mode: GameMode;
  setMode: (mode: GameMode) => void;
  motion: MotionPreference;
  setMotion: (motion: MotionPreference) => void;
};

const GameModeContext = createContext<GameModeContextValue | null>(null);

type GameModeProviderProps = {
  /** Comes from user_settings on the server (Phase 3). Defaults to Full Quest. */
  initialMode?: GameMode;
  initialMotion?: MotionPreference;
  children: ReactNode;
};

/**
 * Wraps the intern-facing app. Renders a `display: contents` wrapper that
 * carries data-mode and data-motion, so the CSS variants (mode-plain:, ...)
 * and the reduced-motion rules apply to everything inside.
 *
 * Company and admin layouts must NOT use this provider. Outside it,
 * useGameMode() reports "plain", so game components render nothing there.
 */
export function GameModeProvider({
  initialMode = DEFAULT_MODE,
  initialMotion = "system",
  children,
}: GameModeProviderProps) {
  const [mode, setMode] = useState<GameMode>(initialMode);
  const [motion, setMotion] = useState<MotionPreference>(initialMotion);
  const value = useMemo(() => ({ mode, setMode, motion, setMotion }), [mode, motion]);

  return (
    <GameModeContext.Provider value={value}>
      <div className="contents" data-mode={mode} data-motion={motion === "reduce" ? "reduce" : undefined}>
        {children}
      </div>
    </GameModeContext.Provider>
  );
}

const PLAIN_FALLBACK: GameModeContextValue = {
  mode: "plain",
  setMode: () => {},
  motion: "system",
  setMotion: () => {},
};

export function useGameMode(): GameModeContextValue {
  return useContext(GameModeContext) ?? PLAIN_FALLBACK;
}

export function useFeatures() {
  return modeFeatures(useGameMode().mode);
}

export function useVocab(): (key: VocabKey) => string {
  const { mode } = useGameMode();
  return (key) => vocab(mode, key);
}

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(REDUCE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** True when the OS asks for reduced motion or the user turned animations off in the app. */
export function useReducedMotion(): boolean {
  const osReduce = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(REDUCE_QUERY).matches,
    () => true, // On the server, assume reduced: no animation is ever wrong.
  );
  const { motion } = useGameMode();
  return osReduce || motion === "reduce";
}
