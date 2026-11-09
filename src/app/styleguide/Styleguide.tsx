"use client";

import { useId, useState, type ReactNode } from "react";
import { Badge } from "@/components/game/Badge";
import { ExpBar } from "@/components/game/ExpBar";
import { HudHeader } from "@/components/game/HudHeader";
import { LevelUpDialog } from "@/components/game/LevelUpDialog";
import { StreakFlame } from "@/components/game/StreakFlame";
import { useFeatures, useGameMode, useVocab } from "@/components/providers/GameModeProvider";
import { BottomNav } from "@/components/ui/BottomNav";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox, ChipPicker, PasswordField, SelectField, TextField } from "@/components/ui/Field";
import { ListingCard, ListingCardSkeleton } from "@/components/ui/ListingCard";
import { MatchPanel } from "@/components/ui/MatchPanel";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { QuestLogCard, type QuestLogItem } from "@/components/ui/QuestLogCard";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { GAME_MODES, MODE_LABELS } from "@/lib/game/mode";
import type { ListingSummary, MatchBreakdown } from "@/lib/listings/types";
import { STATUS_LABEL, STATUSES, type Status } from "@/lib/tracker/status";

/* ---- Sample data (fictional companies, real Philippine places) ---------- */

const LISTINGS: ListingSummary[] = [
  {
    id: "l1",
    title: "IoT Firmware Intern",
    company: "Tanglaw Solar Systems",
    verified: true,
    area: "Cubao, Quezon City",
    distanceKm: 3.2,
    workType: "onsite",
    allowance: "₱500/day",
    source: "direct",
    deadlineText: "5 days left",
    match: { pct: 86, matched: ["C", "Arduino", "Sensors", "Soldering"], missing: ["MQTT"] },
  },
  {
    id: "l2",
    title: "Frontend Developer Intern (React)",
    company: "Bayanihan Pay",
    verified: false,
    area: "Makati",
    distanceKm: 12.4,
    workType: "hybrid",
    allowance: "With allowance",
    source: "jsearch",
    postedText: "Posted 4 days ago",
    match: { pct: 72, matched: ["JavaScript", "React", "Git"], missing: ["TypeScript", "Testing"] },
  },
  {
    id: "l3",
    title: "HR Operations OJT",
    company: "Kalye Logistics",
    verified: true,
    area: "Ortigas, Pasig",
    distanceKm: 9.8,
    workType: "onsite",
    allowance: "Unpaid · 300 hours",
    source: "admin",
    deadlineText: "Closes Fri",
    match: { pct: 41, matched: ["MS Excel"], missing: ["Recruitment", "Labor Code basics"] },
  },
];

const BREAKDOWN: MatchBreakdown = {
  pct: 86,
  parts: [
    { key: "skills", label: "Skills", weight: 0.5, score: 0.86, detail: "3 of 3 required, 1 of 2 nice-to-have" },
    { key: "distance", label: "Distance", weight: 0.25, score: 0.9, detail: "3.2 km from Quezon City" },
    { key: "interests", label: "Field", weight: 0.15, score: 1, detail: "IoT & Embedded is one of your fields" },
    { key: "workType", label: "Work type", weight: 0.1, score: 0.5, detail: "Onsite (you prefer hybrid)" },
  ],
  matched: ["C", "Arduino", "Sensors", "Soldering"],
  missing: [
    {
      name: "MQTT",
      resources: [
        { id: "mqtt-1", title: "MQTT Essentials", url: "https://www.hivemq.com/mqtt/mqtt-essentials/", type: "article" },
      ],
    },
  ],
};

const INITIAL_LOG: QuestLogItem[] = [
  { id: "q1", title: "IoT Firmware Intern", company: "Tanglaw Solar Systems", status: "saved", awaitingConfirm: true },
  { id: "q2", title: "Data Analyst OJT", company: "Kalye Logistics", status: "applied", dateText: "Applied Nov 3" },
  {
    id: "q3",
    title: "UX Design Intern",
    company: "Sari Studio",
    status: "interview",
    dateText: "Interview Nov 12, 10:00 AM",
  },
];

/* ---- Page ---------------------------------------------------------------- */

export function Styleguide() {
  const { mode, setMode, motion, setMotion } = useGameMode();
  const features = useFeatures();
  const v = useVocab();
  const toast = useToast();

  const [exp, setExp] = useState(340);
  const [level, setLevel] = useState(2); // reaching 3 shows the leaderboard unlock (SPEC §10)
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const [saved, setSaved] = useState<string[]>(["l1"]);
  const [log, setLog] = useState(INITIAL_LOG);
  const [tab, setTab] = useState<Status>("saved");
  const [skills, setSkills] = useState<string[]>(["Arduino", "C"]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const EXP_MAX = 500;

  const gainExp = (amount: number, message: string) => {
    let next = exp + amount;
    let leveled = false;
    if (next >= EXP_MAX) {
      next -= EXP_MAX;
      leveled = true;
    }
    setExp(next);
    if (leveled) {
      const newLevel = level + 1;
      setLevel(newLevel);
      // One reward at a time (decision #6): the level-up card replaces the toast in Full Quest.
      if (features.levelUpScreen) setLevelUpOpen(true);
      else toast({ message: `${message} Level ${newLevel} reached.`, tone: "success", exp: amount });
      return;
    }
    toast({ message, tone: "success", exp: amount });
  };

  const moveItem = (id: string, status: Status) => {
    const before = log;
    setLog((all) => all.map((it) => (it.id === id ? { ...it, status, awaitingConfirm: false } : it)));
    setTab(status);
    toast({
      message: `Moved to ${STATUS_LABEL[status]}.`,
      exp: 5,
      action: { label: "Undo", onClick: () => setLog(before) },
    });
  };

  const counts = Object.fromEntries(STATUSES.map((s) => [s, log.filter((i) => i.status === s).length]));

  return (
    <>
      <HudHeader
        username="mika.codes"
        look={{ skin: "#c98f62", hair: "#1b1410" }}
        level={level}
        exp={exp}
        expMax={EXP_MAX}
        streakWeeks={3}
        restWeekAvailable
      />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-12 px-gutter py-section">
        <div>
          <h1 className="text-2xl font-semibold lg:text-3xl">Styleguide</h1>
          <p className="mt-1 max-w-prose text-base text-muted">
            Every component in the InternQuest set, using Direction B (Pocket Console). Switch the play style to see how each
            one changes.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Play style">
            {GAME_MODES.map((m) => (
              <Button
                key={m}
                variant={mode === m ? "primary" : "secondary"}
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
              >
                {MODE_LABELS[m].name}
              </Button>
            ))}
            <Button
              variant="secondary"
              aria-pressed={motion === "reduce"}
              onClick={() => setMotion(motion === "reduce" ? "system" : "reduce")}
            >
              {motion === "reduce" ? "Animations: off" : "Animations: on"}
            </Button>
          </div>
          <p className="mt-2 text-sm text-muted">{MODE_LABELS[mode].summary}</p>
        </div>

        <Section title="Color tokens">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["bezel", "Console frame"],
              ["canvas", "Page"],
              ["screen", "Cards"],
              ["ink", "Text"],
              ["muted", "Secondary text"],
              ["lime", "Accent, bezel only"],
              ["green", "Actions"],
              ["alert", "Deadlines, errors"],
            ].map(([name, role]) => (
              <li key={name} className="border border-line bg-screen">
                <div className="h-14 border-b border-line" style={{ background: `var(--color-${name})` }} />
                <p className="px-2 pt-1 text-sm font-semibold">{name}</p>
                <p className="px-2 pb-2 text-xs text-muted">{role}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Type">
          <Card className="space-y-2">
            <p className="text-3xl font-semibold">Find your first internship</p>
            <p className="text-2xl font-semibold">Page title, 24px</p>
            <p className="text-xl font-semibold">Section heading, 20px</p>
            <p className="text-lg font-semibold">Card title, 18px</p>
            <p className="text-base">Body text is 16px Inter, so listings and tips stay easy to read on any phone.</p>
            <p className="text-sm text-muted">Caption, 14px · Cubao, Quezon City · Onsite</p>
          </Card>
          <Card tone="bezel" className="mt-3 space-y-2">
            <p className="font-pixel text-hud-xl uppercase text-lime">LV 5</p>
            <p className="font-pixel text-hud-lg uppercase">Level up</p>
            <p className="font-pixel text-hud uppercase">Weekly quest</p>
            <p className="font-pixel text-hud-sm uppercase text-bezel-text">340 / 500 EXP</p>
          </Card>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap gap-3">
            <Button>Apply</Button>
            <Button variant="secondary" icon={<PixelIcon name="bookmark" scale={2} />}>
              Save
            </Button>
            <Button variant="ghost">Skip for now</Button>
            <Button variant="danger">Delete account</Button>
            <Button loading>Saving</Button>
            <Button disabled>Disabled</Button>
            <Button size="lg">Create your character</Button>
          </div>
          <Card tone="bezel" className="mt-3 flex flex-wrap gap-3">
            <Button variant="hud">Continue</Button>
            <ButtonLink href="#match" variant="hud">
              View top match
            </ButtonLink>
          </Card>
        </Section>

        <Section title="Tags">
          <Card className="flex flex-wrap items-center gap-4">
            <Tag tone="verified">Verified</Tag>
            <Tag tone="source">Posted directly</Tag>
            <Tag tone="deadline">3 days left</Tag>
            <Tag tone="neutral">Hybrid</Tag>
          </Card>
        </Section>

        <Section title={`Listing cards (${v("listings")})`}>
          <div className="grid gap-3 lg:grid-cols-2">
            {LISTINGS.map((l, i) => (
              <ListingCard
                key={l.id}
                listing={l}
                href="#match"
                featured={i === 0}
                saved={saved.includes(l.id)}
                onToggleSave={(id) => {
                  const on = saved.includes(id);
                  setSaved(on ? saved.filter((s) => s !== id) : [...saved, id]);
                  toast({ message: on ? "Removed from saved." : `Saved to your ${v("tracker").toLowerCase()}.` });
                }}
              />
            ))}
            <ListingCardSkeleton />
          </div>
        </Section>

        <Section title="Match Panel" id="match">
          <div className="max-w-xl">
            <MatchPanel match={BREAKDOWN} quickPrepHref="/tips/resume#iot" quickPrepField="IoT roles" />
          </div>
        </Section>

        <Section title="EXP, level-up, streak, badges">
          {features.exp ? (
            <div className="space-y-3">
              <Card tone="bezel" className="max-w-md">
                <ExpBar exp={exp} max={EXP_MAX} level={level} />
              </Card>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => gainExp(20, "Application confirmed.")}>Confirm an application (+20)</Button>
                <Button variant="secondary" onClick={() => gainExp(EXP_MAX - exp, "Weekly goal reached.")}>
                  Jump to a level-up
                </Button>
              </div>
              {features.streak && (
                <Card tone="bezel" className="inline-flex items-center gap-4">
                  <StreakFlame weeks={3} restWeekAvailable />
                  <p className="text-base">3-week streak. One rest week left this month.</p>
                </Card>
              )}
              <div className="flex flex-wrap gap-3">
                <Badge name="First quest" sprite="star" earned description="Confirmed your first application" />
                <Badge name="Prepared" sprite="shield" earned description="Finished the interview checklist" />
                <Badge name="On a roll" sprite="flame" earned={false} description="Keep a 4-week streak" />
              </div>
            </div>
          ) : (
            <p className="text-base text-muted">Plain mode: no EXP, levels, streaks, or badges are shown anywhere.</p>
          )}
          <LevelUpDialog
            open={levelUpOpen}
            level={level}
            unlocked={level === 3 ? "Weekly leaderboard" : null}
            onClose={() => setLevelUpOpen(false)}
          />
        </Section>

        <Section title={`Quest log cards and tabs (${v("tracker")})`}>
          <Tabs
            label={`${v("tracker")} status`}
            value={tab}
            onChange={(id) => setTab(id as Status)}
            tabs={STATUSES.map((s) => ({ id: s, label: STATUS_LABEL[s], count: counts[s] }))}
          >
            <div className="grid gap-3 lg:grid-cols-2">
              {log.filter((i) => i.status === tab).length === 0 ? (
                <EmptyState
                  title={`Nothing in ${STATUS_LABEL[tab]} yet`}
                  body="Cards move here when you change their status."
                />
              ) : (
                log
                  .filter((i) => i.status === tab)
                  .map((item) => (
                    <QuestLogCard
                      key={item.id}
                      item={item}
                      onMove={moveItem}
                      onConfirmApplied={(id) => {
                        setLog((all) =>
                          all.map((it) => (it.id === id ? { ...it, status: "applied", awaitingConfirm: false, dateText: "Applied today" } : it)),
                        );
                        setTab("applied");
                        gainExp(20, "Marked as applied.");
                      }}
                      onDismissConfirm={(id) =>
                        setLog((all) => all.map((it) => (it.id === id ? { ...it, awaitingConfirm: false } : it)))
                      }
                    />
                  ))
              )}
            </div>
          </Tabs>
        </Section>

        <Section title="Form fields">
          <Card className="max-w-md space-y-4">
            <TextField
              label="Username"
              hint="This is the only name other people see. No real name needed."
              defaultValue="mika.codes"
              autoComplete="username"
            />
            <PasswordField label="Password" hint="At least 10 characters. A short sentence works well." autoComplete="new-password" />
            <TextField label="City or area" placeholder="e.g. Quezon City" error="We couldn't find that place. Try the city name." />
            <TextField label="School or group" optional placeholder="e.g. T.I.P. Quezon City" />
            <SelectField
              label="Preferred work type"
              defaultValue="hybrid"
              options={[
                { value: "onsite", label: "Onsite" },
                { value: "hybrid", label: "Hybrid" },
                { value: "remote", label: "Remote" },
              ]}
            />
            <ChipPicker
              legend={`Pick your ${v("skills").toLowerCase()}`}
              hint="Choose up to 5. You can change these anytime."
              options={["Arduino", "C", "Python", "Sensors", "MQTT", "Raspberry Pi", "PCB design"]}
              value={skills}
              onChange={setSkills}
              max={5}
            />
            <Checkbox
              label={
                <>
                  I agree to the <a href="#privacy" className="font-semibold text-green underline underline-offset-4">privacy notice</a>.
                </>
              }
            />
          </Card>
        </Section>

        <Section title="Toasts">
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => toast({ message: "Saved to your quest log." })}>
              Neutral
            </Button>
            <Button variant="secondary" onClick={() => toast({ message: "Marked as applied.", tone: "success", exp: 20 })}>
              Success with EXP
            </Button>
            <Button
              variant="secondary"
              onClick={() => toast({ message: "Couldn't save. Check your connection and try again.", tone: "error" })}
            >
              Error
            </Button>
          </div>
        </Section>

        <Section title="Sheet">
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>
            Open the &ldquo;Did you apply?&rdquo; sheet
          </Button>
          <Sheet
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            title="Did you send your application to Tanglaw Solar Systems?"
            description="We'll move it to Applied so you can keep track."
          >
            <div className="grid gap-2">
              <Button
                block
                onClick={() => {
                  setSheetOpen(false);
                  gainExp(20, "Marked as applied.");
                }}
              >
                Yes, I applied
              </Button>
              <Button variant="secondary" block onClick={() => setSheetOpen(false)}>
                Not yet
              </Button>
            </div>
          </Sheet>
        </Section>

        <Section title="Empty and error states">
          <div className="grid gap-3 lg:grid-cols-2">
            <EmptyState
              title="No matches within 10 km"
              body="Try a bigger radius, or turn on remote listings. New listings come in every day."
              action={<Button variant="secondary">Search up to 25 km</Button>}
            />
            <ErrorState
              title="Listings didn't load"
              body="It looks like the connection dropped. Your saved listings are safe."
              action={<Button>Try again</Button>}
            />
          </div>
        </Section>
      </main>

      <BottomNav active="home" />
    </>
  );
}

function Section({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-4">
      <h2 id={headingId} className="mb-3 text-xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}
