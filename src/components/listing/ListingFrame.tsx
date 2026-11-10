"use client";

import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { initialMotionFor, useAccountIfAvailable } from "@/components/providers/AccountProvider";
import { GameModeProvider } from "@/components/providers/GameModeProvider";
import { viewerFromAccount } from "@/lib/account/account";

const PUBLIC_MAIN = "mx-auto w-full max-w-6xl flex-1 px-gutter pb-32 pt-3 lg:pb-12 lg:pt-6";

/**
 * The frame around a listing's page (W5). The page has one address that works
 * for everyone, so it starts as the public page (header and footer, no game
 * elements) and swaps to the intern app frame once it knows someone is signed
 * in: the sidebar, so they never leave their app for a public-looking page.
 * The header and footer arrive as slots from the server page.
 */
export function ListingFrame({ header, footer, children }: { header: ReactNode; footer: ReactNode; children: ReactNode }) {
  const publicPage = (
    <>
      {header}
      <main id="main" className={PUBLIC_MAIN}>
        {children}
      </main>
      {footer}
    </>
  );
  return (
    <Suspense fallback={publicPage}>
      <Chooser publicPage={publicPage}>{children}</Chooser>
    </Suspense>
  );
}

function Chooser({ publicPage, children }: { publicPage: ReactNode; children: ReactNode }) {
  const account = useAccountIfAvailable();
  // Signed out, in the design preview, or not finished signing up: the public page.
  if (!account || !account.onboarded) return publicPage;
  return (
    <GameModeProvider initialMode={account.settings.mode} initialMotion={initialMotionFor(account)}>
      {/* The phone bottom bar is hidden here: the sticky Save / Apply bar takes its place (wireframe decision 2). */}
      <AppShell active="search" viewer={viewerFromAccount(account)} bottomNav={false}>
        <div className="pb-24 lg:pb-0">{children}</div>
      </AppShell>
    </GameModeProvider>
  );
}
