"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useReward } from "@/components/game/useReward";
import { AppShell } from "@/components/layout/AppShell";
import { GameModeProvider, useGameMode } from "@/components/providers/GameModeProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { isGameMode } from "@/lib/game/mode";
import { SAMPLE_NEW_VIEWER, SAMPLE_VIEWER, type Viewer } from "@/lib/sample/viewer";

type TipsContextValue = { viewer: Viewer; reward: (amount: number, message: string) => void };
const TipsContext = createContext<TipsContextValue | null>(null);

export function useTips(): TipsContextValue {
  const ctx = useContext(TipsContext);
  if (!ctx) throw new Error("useTips must be used inside <TipsShell>");
  return ctx;
}

/**
 * App frame for Tips. Unlike the other app screens, it doesn't wait for the
 * URL before rendering, so the guide text is in the server HTML (fast on weak
 * phones, readable without JavaScript). DESIGN PREVIEW: sample user; review
 * switches ?mode= and ?state=new are applied after load.
 */
export function TipsShell({ children, bottomNav = true }: { children: ReactNode; bottomNav?: boolean }) {
  return (
    <GameModeProvider>
      <ToastProvider>
        <Inner bottomNav={bottomNav}>{children}</Inner>
      </ToastProvider>
    </GameModeProvider>
  );
}

function Inner({ children, bottomNav }: { children: ReactNode; bottomNav: boolean }) {
  const [viewer, setViewer] = useState<Viewer>(SAMPLE_VIEWER);
  const { reward, levelUpDialog } = useReward(viewer, setViewer);
  return (
    <TipsContext.Provider value={{ viewer, reward }}>
      <AppShell active="tips" viewer={viewer} bottomNav={bottomNav}>
        {children}
      </AppShell>
      {levelUpDialog}
      <Suspense fallback={null}>
        <ReviewSwitches onNewUser={() => setViewer(SAMPLE_NEW_VIEWER)} />
      </Suspense>
    </TipsContext.Provider>
  );
}

/** Review-only: applies ?mode= and ?state=new after the page loads. Removed in Phase 1 and 3. */
function ReviewSwitches({ onNewUser }: { onNewUser: () => void }) {
  const params = useSearchParams();
  const { setMode } = useGameMode();
  const mode = params.get("mode");
  const isNew = params.get("state") === "new";
  useEffect(() => {
    if (isGameMode(mode)) setMode(mode);
    if (isNew) onNewUser();
    // Only on load and when the switches themselves change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isNew]);
  return null;
}
