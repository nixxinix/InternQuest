"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { GameModeProvider, useFeatures, useGameMode } from "@/components/providers/GameModeProvider";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/Field";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { Switch } from "@/components/ui/Switch";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { downloadText } from "@/lib/browser/download";
import { useMediaQuery } from "@/lib/browser/useMediaQuery";
import { cn } from "@/lib/cn";
import { GAME_MODES, MODE_LABELS, isGameMode, type GameMode } from "@/lib/game/mode";
import { sampleQuestLog } from "@/lib/sample/questlog";
import { SAMPLE_NEW_VIEWER, SAMPLE_VIEWER, type Viewer } from "@/lib/sample/viewer";
import {
  DEFAULT_SETTINGS,
  NOTE_TONES,
  NOTE_TONE_LABEL,
  buildDataExport,
  maskEmail,
  type NoteTone,
  type UserSettings,
} from "@/lib/settings/settings";
import { manilaDate } from "@/lib/tracker/log";
import { DeleteAccountSheet, PasswordSheet, RecoverySheet, UsernameSheet } from "./AccountSheets";

const SECTIONS = [
  { id: "play-style", label: "Play style" },
  { id: "game", label: "Game" },
  { id: "motion", label: "Motion and sound" },
  { id: "account", label: "Account" },
  { id: "privacy", label: "Privacy" },
] as const;

/**
 * W11 Settings. DESIGN PREVIEW: sample user; changes live in this page only.
 * Phase 3 saves them to `user_settings`, Phase 1 wires the account actions.
 * Review-only switches: ?mode=full|light|plain, ?state=new.
 */
export function SettingsScreen() {
  const params = useSearchParams();
  const modeParam = params.get("mode");
  return (
    <GameModeProvider initialMode={isGameMode(modeParam) ? modeParam : "full"}>
      <ToastProvider>
        <Settings initial={params.get("state") === "new" ? SAMPLE_NEW_VIEWER : SAMPLE_VIEWER} />
      </ToastProvider>
    </GameModeProvider>
  );
}

function Settings({ initial }: { initial: Viewer }) {
  const router = useRouter();
  const { mode, setMode, motion, setMotion } = useGameMode();
  const f = useFeatures();
  const toast = useToast();
  const osReduce = useMediaQuery("(prefers-reduced-motion: reduce)");

  const [viewer, setViewer] = useState(initial);
  const [s, setS] = useState<UserSettings>({ ...DEFAULT_SETTINGS, mode });
  const [sheet, setSheet] = useState<null | "username" | "password" | "recovery" | "delete">(null);
  const close = () => setSheet(null);

  /** Every change saves on its own (W11). TODO(Phase 3): server action to user_settings. */
  const save = (patch: Partial<UserSettings>, message = "Saved.") => {
    setS((prev) => ({ ...prev, ...patch }));
    toast({ message, tone: "success" });
  };

  const changeMode = (m: GameMode) => {
    setMode(m);
    save({ mode: m }, `Saved. You're on ${MODE_LABELS[m].name}.`);
  };

  const downloadData = () => {
    const today = manilaDate(new Date());
    const data = buildDataExport(
      {
        account: {
          username: viewer.username,
          recovery: viewer.recovery.kind,
          recoveryEmail: viewer.recovery.kind === "email" ? viewer.recovery.email : null,
        },
        profile: {
          field: viewer.field,
          skills: viewer.skills,
          city: viewer.cityId,
          workType: viewer.workType,
          status: viewer.status,
          school: viewer.school,
          avatar: viewer.look,
        },
        progress: {
          level: viewer.level,
          totalExp: viewer.totalExp,
          streakWeeks: viewer.streakWeeks,
          applications: viewer.applicationsTotal,
          badges: viewer.badges,
        },
        settings: s,
        questLog: viewer.isNew ? [] : sampleQuestLog(today),
      },
      new Date(),
    );
    downloadText(JSON.stringify(data, null, 2), `internquest-data-${viewer.username}-${today}.json`, "application/json");
    toast({ message: "Your data file is downloading." });
  };

  const recoveryValue =
    viewer.recovery.kind === "codes"
      ? "Codes"
      : viewer.recovery.kind === "email"
        ? maskEmail(viewer.recovery.email)
        : "Not set up";

  return (
    <AppShell active="settings" viewer={viewer}>
      <Link
        href="/profile"
        className="inline-flex min-h-tap items-center gap-1.5 font-semibold text-green underline-offset-4 hover:underline lg:hidden"
      >
        <PixelIcon name="chevronRight" scale={2} className="rotate-180" />
        {f.avatar ? "Character" : "Profile"}
      </Link>
      <h1 className="text-2xl font-semibold lg:text-3xl">Settings</h1>
      <p className="mt-1 text-base text-muted">Changes save as you make them.</p>

      <div className="mt-6 lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-start lg:gap-10">
        {/* Desktop: section list. Phones scroll one column. */}
        <nav aria-label="Settings sections" className="sticky top-8 hidden lg:block">
          <ul className="space-y-1 border-l-2 border-line">
            {SECTIONS.filter((x) => x.id !== "game" || mode !== "plain").map((x) => (
              <li key={x.id}>
                <a href={`#${x.id}`} className="-ml-0.5 flex min-h-tap items-center border-l-2 border-transparent pl-4 text-base hover:border-ink">
                  {x.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="max-w-2xl space-y-6">
          {/* ---------------- Play style ---------------- */}
          <Section id="play-style" title="Play style">
            <fieldset>
              <legend className="sr-only">Play style</legend>
              <div className="grid gap-2 py-2">
                {GAME_MODES.map((m) => (
                  <label
                    key={m}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 border-2 p-3",
                      mode === m ? "border-green bg-green-tint" : "border-line hover:border-muted",
                      "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink",
                    )}
                  >
                    <input
                      type="radio"
                      name="mode"
                      checked={mode === m}
                      onChange={() => changeMode(m)}
                      className="mt-1 size-5 flex-none accent-green"
                    />
                    <span>
                      <span className="block font-semibold">
                        {MODE_LABELS[m].name}
                        {m === "full" && <span className="font-normal text-muted"> (the default)</span>}
                      </span>
                      <span className="block text-sm text-muted">{MODE_LABELS[m].summary}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="pb-2 text-sm text-muted">Your EXP, badges, and quest log stay the same whichever you pick.</p>
          </Section>

          {/* ---------------- Game ---------------- */}
          {mode === "light" && (
            <Section id="game" title="Game">
              <p className="py-3 text-base text-muted">
                Streaks, the leaderboard, and motivational notes are part of Full Quest. Light keeps just EXP and badges.
              </p>
            </Section>
          )}
          {mode === "full" && (
            <Section id="game" title="Game">
              <Switch
                label="Weekly streaks"
                description="Counts weeks with at least one action. One rest week a month."
                checked={s.streaks}
                onChange={(on) => save({ streaks: on })}
              />
              <Switch
                label="Leaderboard"
                description={viewer.level < 3 ? "Unlocks at Level 3." : "Weekly and all-time ranking, by username only."}
                checked={s.leaderboard}
                onChange={(on) => save({ leaderboard: on })}
              />
              <Switch
                label="Show me on the leaderboard"
                description={
                  s.showOnLeaderboard ? "Others can see your username and weekly EXP." : "You're hidden. You can still see the board and your own row."
                }
                checked={s.showOnLeaderboard}
                onChange={(on) => save({ showOnLeaderboard: on })}
              />
              <div className="py-2">
                <SelectField
                  label="Motivational notes"
                  value={s.notes}
                  onChange={(e) => save({ notes: e.target.value as NoteTone })}
                  hint="The short notes on Home and after rewards."
                  options={NOTE_TONES.map((t) => ({ value: t, label: NOTE_TONE_LABEL[t] }))}
                />
              </div>
            </Section>
          )}

          {/* ---------------- Motion and sound ---------------- */}
          <Section id="motion" title="Motion and sound">
            <Switch
              label="Animations"
              description={
                osReduce
                  ? "Your device asks for less motion, so big animations stay off either way."
                  : "EXP count-ups, the level-up card, and sheet slides. Off works like reduced motion."
              }
              checked={motion !== "reduce"}
              onChange={(on) => {
                setMotion(on ? "system" : "reduce");
                save({ animations: on });
              }}
            />
            <Switch
              label="Sound"
              description="Short sounds for rewards. Off by default."
              checked={s.sound}
              onChange={(on) => save({ sound: on })}
            />
          </Section>

          {/* ---------------- Account ---------------- */}
          <Section id="account" title="Account">
            <ul className="divide-y divide-line">
              <ActionRow label="Username" value={viewer.username} onClick={() => setSheet("username")} />
              <ActionRow label="Password" value="Change" onClick={() => setSheet("password")} />
              <ActionRow
                label="Password recovery"
                value={recoveryValue}
                warn={viewer.recovery.kind === "none"}
                onClick={() => setSheet("recovery")}
              />
            </ul>
          </Section>

          {/* ---------------- Privacy ---------------- */}
          <Section id="privacy" title="Privacy">
            <ul className="divide-y divide-line">
              <ActionRow label="Download my data" value="JSON file" icon="download" onClick={downloadData} />
              <li>
                <Link href="/privacy" className="flex min-h-tap items-center justify-between gap-3 py-3 text-base font-semibold">
                  Privacy notice
                  <PixelIcon name="chevronRight" scale={2} className="text-muted" />
                </Link>
              </li>
            </ul>
          </Section>

          {/* ---------------- Danger ---------------- */}
          <section aria-labelledby="danger-h" className="border-2 border-alert bg-screen p-4">
            <h2 id="danger-h" className="text-lg font-semibold">
              Delete account
            </h2>
            <p className="mt-1 text-base text-muted">Removes your account and everything in it, right away. This can&apos;t be undone.</p>
            <Button variant="danger" className="mt-3" onClick={() => setSheet("delete")}>
              Delete my account
            </Button>
          </section>
        </div>
      </div>

      {/* ---------------- Sheets ---------------- */}
      <UsernameSheet
        open={sheet === "username"}
        onClose={close}
        current={viewer.username}
        onSave={(u) => {
          setViewer((v0) => ({ ...v0, username: u }));
          close();
          toast({ message: `Saved. You're now ${u}.`, tone: "success" });
        }}
      />
      <PasswordSheet
        open={sheet === "password"}
        onClose={close}
        username={viewer.username}
        onSave={() => {
          close();
          toast({ message: "Password changed.", tone: "success" });
        }}
      />
      <RecoverySheet
        open={sheet === "recovery"}
        onClose={close}
        username={viewer.username}
        recovery={viewer.recovery}
        onChange={(r) => {
          setViewer((v0) => ({ ...v0, recovery: r }));
          toast({ message: r.kind === "email" ? "Recovery email saved." : "New recovery codes made.", tone: "success" });
        }}
      />
      <DeleteAccountSheet
        open={sheet === "delete"}
        onClose={close}
        username={viewer.username}
        onDownload={downloadData}
        onDelete={() => router.push("/")}
      />
    </AppShell>
  );
}

/* ------------------------------------------------------------------------ */

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-8 border border-line bg-screen px-4 pt-3">
      <h2 id={`${id}-h`} className="border-b border-line pb-2 text-lg font-semibold">
        {title}
      </h2>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}

function ActionRow({
  label,
  value,
  onClick,
  warn,
  icon = "chevronRight",
}: {
  label: string;
  value: string;
  onClick: () => void;
  warn?: boolean;
  icon?: "chevronRight" | "download";
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-haspopup={icon === "chevronRight" ? "dialog" : undefined}
        className="flex min-h-tap w-full items-center justify-between gap-3 py-3 text-left"
      >
        <span className="text-base font-semibold">{label}</span>
        <span className={cn("flex min-w-0 items-center gap-2 text-base", warn ? "font-semibold text-alert" : "text-muted")}>
          {warn && <PixelIcon name="alert" scale={2} />}
          <span className="truncate">{value}</span>
          <PixelIcon name={icon} scale={2} />
        </span>
      </button>
    </li>
  );
}
