"use client";

import Link from "next/link";
import { redirect, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/game/Avatar";
import { ExpBar } from "@/components/game/ExpBar";
import { LIVE, useAccount } from "@/components/providers/AccountProvider";
import { GameModeProvider, useFeatures, useGameMode } from "@/components/providers/GameModeProvider";
import { ButtonLink } from "@/components/ui/Button";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { SegmentBar } from "@/components/ui/SegmentBar";
import { readPicks, picksQuery, withQuery } from "@/lib/listings/picks";
import { findCityById } from "@/lib/catalog/cities";
import { EXP } from "@/lib/game/exp";
import { levelFor } from "@/lib/game/levels";
import { clearDraft, draftWithAccount, loadDraft, maxStep, saveDraft, type OnboardingDraft } from "./draft";
import { StepAccount } from "./StepAccount";
import { StepCharacter } from "./StepCharacter";
import { StepPlayStyle } from "./StepPlayStyle";
import { StepRecovery } from "./StepRecovery";

export const TOTAL_STEPS = 4;

/**
 * W2 Onboarding, "create your character". Order (decision #47):
 * 1 Account, 2 Recovery (skippable), 3 Play style, 4 Character.
 * The step lives in the URL (?step=2) so the phone Back button works.
 * With real accounts, step 1 creates the account and each later step saves on
 * the server; a signed-in visitor resumes where they left off.
 */
export function OnboardingRoot() {
  const params = useSearchParams();
  const account = useAccount();
  // Already finished: nothing to set up. (Checked before the draft is read.)
  if (account?.onboarded) redirect("/home");
  return <OnboardingWithDraft account={account} params={params} />;
}

function OnboardingWithDraft({
  account,
  params,
}: {
  account: ReturnType<typeof useAccount>;
  params: ReturnType<typeof useSearchParams>;
}) {
  const [draft, setDraft] = useState<OnboardingDraft>(() => {
    const d = loadDraft(readPicks(params));
    return LIVE ? draftWithAccount(d, account) : d;
  });

  const update = (patch: Partial<OnboardingDraft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    saveDraft(next);
  };

  return (
    <GameModeProvider initialMode={draft.mode}>
      <Onboarding draft={draft} update={update} />
    </GameModeProvider>
  );
}

function Onboarding({ draft, update }: { draft: OnboardingDraft; update: (p: Partial<OnboardingDraft>) => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [navigated, setNavigated] = useState(false);
  const [finished, setFinished] = useState<OnboardingDraft | null>(null);

  const raw = Number(params.get("step") ?? "1");
  const step = Math.min(Math.max(Number.isFinite(raw) ? Math.trunc(raw) : 1, 1), maxStep(draft)) as 1 | 2 | 3 | 4;

  const goTo = (n: number) => {
    const q = new URLSearchParams(params.toString());
    q.set("step", String(n));
    setNavigated(true);
    router.push(`${pathname}?${q.toString()}`);
  };

  if (finished) return <AllSet draft={finished} />;

  const common = { draft, update, onNext: () => goTo(step + 1), focusOnMount: navigated };

  return (
    <OnboardingShell step={step} onBack={step > 1 ? () => goTo(step - 1) : undefined}>
      {step === 1 && <StepAccount key="1" {...common} saveId={params.get("save")} />}
      {step === 2 && <StepRecovery key="2" {...common} />}
      {step === 3 && <StepPlayStyle key="3" {...common} />}
      {step === 4 && (
        <StepCharacter
          key="4"
          {...common}
          onNext={() => {
            clearDraft();
            setFinished(draft);
            window.scrollTo({ top: 0 });
          }}
        />
      )}
    </OnboardingShell>
  );
}

/* ------------------------------------------------------------------------ */

function OnboardingShell({ step, onBack, children }: { step: number; onBack?: () => void; children: ReactNode }) {
  return (
    <>
      <header className="on-bezel">
        <div className="mx-auto flex min-h-14 max-w-lg items-center gap-3 px-gutter">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to the previous step"
              className="-ml-2 inline-flex size-tap items-center justify-center text-bezel-text hover:text-screen"
            >
              <PixelIcon name="chevronRight" scale={2} className="rotate-180" />
            </button>
          ) : (
            <Link href="/" className="font-pixel text-hud uppercase">
              InternQuest
            </Link>
          )}
          <div className="ml-auto flex items-center gap-3">
            <span className="font-pixel text-hud-sm uppercase text-bezel-text">
              Step <span className="text-lime">{step}</span> of {TOTAL_STEPS}
            </span>
            <SegmentBar value={step} max={TOTAL_STEPS} segments={TOTAL_STEPS} surface="bezel" height="sm" className="w-20" />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-lg flex-1 px-gutter pb-16 pt-6">
        {children}
      </main>
    </>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * End of onboarding. The profile is already saved on the server (step 4).
 * Phase 3 awards the +50 "complete profile" EXP there, then this shows it.
 */
function AllSet({ draft }: { draft: OnboardingDraft }) {
  const f = useFeatures();
  const { mode } = useGameMode();
  const city = findCityById(draft.cityId);
  // With accounts, finishing the profile just earned +50 on the server ("Complete profile", once).
  const start = levelFor(LIVE ? EXP.profile : 0);
  const resultsHref = withQuery(
    "/",
    picksQuery({ field: draft.field, skills: draft.skills, city, remoteOk: draft.workType !== "onsite" }),
  );

  return (
    <>
      <header className="on-bezel">
        <div className="mx-auto flex min-h-14 max-w-lg items-center px-gutter">
          <span className="font-pixel text-hud uppercase">InternQuest</span>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-lg flex-1 px-gutter pb-16 pt-6">
        {f.avatar ? (
          <div className="on-bezel animate-pop p-6 text-center">
            <div className="flex justify-center">
              <Avatar look={draft.look} scale={8} label={`${draft.username}'s avatar`} />
            </div>
            <p className="mt-4 font-pixel text-hud uppercase text-lime">Character created</p>
            <h1 className="mt-1 text-2xl font-semibold">Welcome, {draft.username}</h1>
            <div className="mx-auto mt-4 max-w-xs text-left">
              <ExpBar exp={start.exp} max={start.expMax} level={start.level} />
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-semibold">You&apos;re all set, {draft.username}</h1>
            {mode === "light" && (
              <div className="on-bezel mt-4 p-4">
                <ExpBar exp={start.exp} max={start.expMax} level={start.level} />
              </div>
            )}
          </div>
        )}

        <section aria-labelledby="first-h" className="mt-6 border border-line bg-screen p-5">
          <h2 id="first-h" className="text-lg font-semibold">
            {f.avatar ? "Your first quest" : "Getting started"}
          </h2>
          <ul className="mt-3 space-y-2 text-base">
            <ChecklistItem done>Finish your {f.avatar ? "character sheet" : "profile"}</ChecklistItem>
            <ChecklistItem>View your top match</ChecklistItem>
            <ChecklistItem>Save a listing</ChecklistItem>
            <ChecklistItem bonus>Bonus: confirm your first application</ChecklistItem>
          </ul>
        </section>

        <ButtonLink href={LIVE ? "/home" : `/home?state=new&mode=${mode}`} size="lg" block className="mt-6">
          Go to my home
        </ButtonLink>
        <Link
          href={resultsHref}
          className="mt-2 flex min-h-tap items-center justify-center font-semibold text-green underline decoration-2 underline-offset-4"
        >
          Or browse all matches
        </Link>

        {!LIVE && (
          <p className="mt-4 border-l-4 border-muted bg-canvas p-3 text-sm text-muted">
            Preview: accounts aren&apos;t saved yet while InternQuest is being built. Nothing you typed left this device.
          </p>
        )}
      </main>
    </>
  );
}

function ChecklistItem({ done = false, bonus = false, children }: { done?: boolean; bonus?: boolean; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className={done ? "flex size-6 items-center justify-center bg-green text-screen" : "size-6 border-2 border-muted"}
      >
        {done && <PixelIcon name="check" scale={2} />}
      </span>
      <span className={bonus ? "text-muted" : undefined}>
        {children}
        <span className="sr-only">{done ? " (done)" : " (to do)"}</span>
      </span>
    </li>
  );
}
