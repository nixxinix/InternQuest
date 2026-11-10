"use client";

import { redirect } from "next/navigation";
import { createContext, use, useContext, type ReactNode } from "react";
import type { Account } from "@/lib/account/account";
import { isGameMode, type GameMode } from "@/lib/game/mode";
import type { MotionPreference } from "./GameModeProvider";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const AccountContext = createContext<Promise<Account | null> | null>(null);

/**
 * Hands the signed-in account to client screens. The server starts loading it
 * (see AccountScope) and passes the promise down, so the page shell renders
 * right away and the screen streams in when the account is ready.
 */
export function AccountProvider({ account, children }: { account: Promise<Account | null>; children: ReactNode }) {
  return <AccountContext.Provider value={account}>{children}</AccountContext.Provider>;
}

/** True when Supabase is connected. False = design preview with sample data. */
export const LIVE = isSupabaseConfigured();

/**
 * The signed-in account, or null in the design preview. Suspends until it's
 * loaded, so call it inside a <Suspense> boundary.
 */
export function useAccount(): Account | null {
  const promise = useContext(AccountContext);
  if (!promise) {
    // With real accounts, a screen outside AccountScope would show sample data to a real user.
    if (LIVE) throw new Error("useAccount() needs <AccountScope> around the page.");
    return null;
  }
  return use(promise);
}

/**
 * For public pages that also work signed out (listing detail, header): the
 * account when the page has an AccountScope and someone is signed in, else null.
 */
export function useAccountIfAvailable(): Account | null {
  const promise = useContext(AccountContext);
  return promise ? use(promise) : null;
}

/**
 * For the intern app screens: the account when live (sending signed-out
 * visitors to log in and unfinished sign-ups back to onboarding), or null in
 * the design preview, where screens use their sample user.
 */
export function useAppAccount(): Account | null {
  const account = useAccount();
  if (LIVE && !account) redirect("/login");
  if (account && !account.onboarded) redirect("/start");
  return account;
}

/** Live: the saved play style. Preview: the ?mode= review switch, else Full Quest. */
export function initialModeFor(account: Account | null, modeParam: string | null): GameMode {
  if (account) return account.settings.mode;
  return isGameMode(modeParam) ? modeParam : "full";
}

/** The in-app Animations switch (Settings). Off works like the OS "reduce motion" setting. */
export function initialMotionFor(account: Account | null): MotionPreference {
  return account && !account.settings.animations ? "reduce" : "system";
}
