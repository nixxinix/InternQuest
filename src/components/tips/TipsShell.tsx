"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useReward } from "@/components/game/useReward";
import { AppShell } from "@/components/layout/AppShell";
import { AppShellSkeleton, SkeletonBlock } from "@/components/layout/AppShellSkeleton";
import { initialMotionFor, useAppAccount } from "@/components/providers/AccountProvider";
import { GameModeProvider, useGameMode } from "@/components/providers/GameModeProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { viewerFromAccount } from "@/lib/account/account";
import type { ServerReward } from "@/lib/game/exp";
import { isGameMode } from "@/lib/game/mode";
import { SAMPLE_NEW_VIEWER, SAMPLE_VIEWER, type Viewer } from "@/lib/sample/viewer";
import { seedChecklist } from "./useChecklist";

type TipsContextValue = {
  viewer: Viewer;
  /** Signed in: checklist ticks are also saved to the account. */
  syncs: boolean;
  reward: (amount: number, message: string) => void;
  fromServer: (r: ServerReward | null | undefined, message: string) => void;
};
const TipsContext = createContext<TipsContextValue | null>(null);

export function useTips(): TipsContextValue {
  const ctx = useContext(TipsContext);
  if (!ctx) throw new Error("useTips must be used inside <TipsShell>");
  return ctx;
}

/**
 * App frame for Tips (pages wrap it in <AccountScope>). The guide text is
 * rendered on the server and streams in with the frame. Signed in: the real
 * account. Design preview: the sample user, with review switches ?mode= and
 * ?state=new applied after load.
 */
export function TipsShell({ children, bottomNav = true }: { children: ReactNode; bottomNav?: boolean }) {
  return (
    <Suspense
      fallback={
        <AppShellSkeleton label="Loading tips">
          <div className="space-y-4">
            <SkeletonBlock className="h-8 w-1/2" />
            <SkeletonBlock className="h-4 w-3/4" />
            <SkeletonBlock className="h-40" />
          </div>
        </AppShellSkeleton>
      }
    >
      <WithAccount bottomNav={bottomNav}>{children}</WithAccount>
    </Suspense>
  );
}

function WithAccount({ children, bottomNav }: { children: ReactNode; bottomNav: boolean }) {
  const account = useAppAccount();
  return (
    <GameModeProvider initialMode={account?.settings.mode} initialMotion={initialMotionFor(account)}>
      <ToastProvider>
        <Inner
          initial={account ? viewerFromAccount(account) : SAMPLE_VIEWER}
          preview={!account}
          tipsProgress={account?.tipsProgress ?? null}
          bottomNav={bottomNav}
        >
          {children}
        </Inner>
      </ToastProvider>
    </GameModeProvider>
  );
}

function Inner({
  initial,
  preview,
  tipsProgress,
  children,
  bottomNav,
}: {
  initial: Viewer;
  preview: boolean;
  tipsProgress: Record<string, string[]> | null;
  children: ReactNode;
  bottomNav: boolean;
}) {
  const [viewer, setViewer] = useState<Viewer>(initial);
  const { reward, fromServer, levelUpDialog } = useReward(viewer, setViewer);
  // A new device: bring in the ticks saved to the account.
  useEffect(() => {
    for (const [slug, done] of Object.entries(tipsProgress ?? {})) seedChecklist(slug, done);
  }, [tipsProgress]);
  return (
    <TipsContext.Provider value={{ viewer, syncs: tipsProgress !== null, reward, fromServer }}>
      <AppShell active="tips" viewer={viewer} bottomNav={bottomNav}>
        {children}
      </AppShell>
      {levelUpDialog}
      {preview && (
        <Suspense fallback={null}>
          <ReviewSwitches onNewUser={() => setViewer(SAMPLE_NEW_VIEWER)} />
        </Suspense>
      )}
    </TipsContext.Provider>
  );
}

/** Design preview only: applies ?mode= and ?state=new after the page loads. */
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
