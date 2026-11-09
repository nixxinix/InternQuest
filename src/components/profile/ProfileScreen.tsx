"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Avatar } from "@/components/game/Avatar";
import { Badge } from "@/components/game/Badge";
import { ExpBar } from "@/components/game/ExpBar";
import { StreakFlame } from "@/components/game/StreakFlame";
import { AppShell } from "@/components/layout/AppShell";
import { GameModeProvider, useFeatures, useVocab } from "@/components/providers/GameModeProvider";
import { Button } from "@/components/ui/Button";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { Sheet } from "@/components/ui/Sheet";
import { SkillChip } from "@/components/ui/SkillChip";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import type { SpriteName } from "@/components/ui/sprites";
import { findCityById } from "@/lib/catalog/cities";
import { fieldLabel, type FieldId } from "@/lib/catalog/fields";
import { PROFILE_STATUSES, SCHOOLS } from "@/lib/catalog/schools";
import { skillName } from "@/lib/catalog/skills";
import { badgeList } from "@/lib/game/badges";
import { isGameMode } from "@/lib/game/mode";
import { WORK_TYPE_LABEL } from "@/lib/listings/types";
import { profileErrors, type ProfileValues } from "@/lib/profile/validate";
import { SAMPLE_NEW_VIEWER, SAMPLE_VIEWER, type Viewer } from "@/lib/sample/viewer";
import { ProfileFields } from "./ProfileFields";
import { ShareCardEditor } from "./ShareCard";

/**
 * W9 Profile (character sheet) and share card. DESIGN PREVIEW: sample user.
 * Review-only switches: ?mode=full|light|plain, ?state=new. Editing is ?edit=1 so Back leaves it.
 */
export function ProfileScreen() {
  const params = useSearchParams();
  const modeParam = params.get("mode");
  return (
    <GameModeProvider initialMode={isGameMode(modeParam) ? modeParam : "full"}>
      <ToastProvider>
        <Profile initial={params.get("state") === "new" ? SAMPLE_NEW_VIEWER : SAMPLE_VIEWER} />
      </ToastProvider>
    </GameModeProvider>
  );
}

function Profile({ initial }: { initial: Viewer }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const f = useFeatures();
  const v = useVocab();
  const toast = useToast();
  const [viewer, setViewer] = useState(initial);
  const [shareOpen, setShareOpen] = useState(false);
  const editing = params.get("edit") === "1";

  const withParam = (key: string, value: string | null) => {
    const q = new URLSearchParams(window.location.search);
    if (value === null) q.delete(key);
    else q.set(key, value);
    return q.toString() ? `${pathname}?${q}` : pathname;
  };
  const startEdit = () => router.push(withParam("edit", "1"), { scroll: false });
  const stopEdit = () => router.replace(withParam("edit", null), { scroll: false });

  const share = (
    <ShareCardEditor
      stats={{
        username: viewer.username,
        level: viewer.level,
        totalExp: viewer.totalExp,
        applications: viewer.applicationsTotal,
        streakWeeks: viewer.streakWeeks,
      }}
      look={viewer.look}
      showAvatar={f.avatar}
      streakAllowed={f.streak}
    />
  );

  if (editing) {
    return (
      <AppShell active="profile" viewer={viewer}>
        <EditProfile
          viewer={viewer}
          onCancel={stopEdit}
          onSave={(values) => {
            // Phase 1: server action saves and re-validates; matches refresh from the new profile.
            setViewer((v0) => ({ ...v0, ...values }));
            toast({ message: "Profile saved. Your matches are updated.", tone: "success" });
            stopEdit();
          }}
        />
      </AppShell>
    );
  }

  const city = findCityById(viewer.cityId);
  const status = PROFILE_STATUSES.find((s) => s.id === viewer.status)?.label ?? null;
  const school = SCHOOLS.find((s) => s.id === viewer.school)?.name ?? null;
  const badges = badgeList(viewer.badges);
  const earned = badges.filter((b) => b.earned).length;
  const showLeaderboard = f.leaderboard && viewer.level >= 3;

  return (
    <AppShell active="profile" viewer={viewer}>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10">
        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-semibold lg:text-3xl">{f.avatar ? "Character sheet" : v("profile")}</h1>

            {f.exp ? (
              <section aria-label="Progress" className="on-bezel mt-4 p-4">
                <div className="flex items-center gap-4">
                  {f.avatar && (
                    <div className="flex-none bg-bezel-raised p-2">
                      <Avatar look={viewer.look} scale={8} label={`${viewer.username}'s avatar`} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="break-words text-xl font-semibold">{viewer.username}</p>
                    <p className="mt-0.5 text-base text-bezel-text">
                      <span className="font-pixel text-hud-sm uppercase">
                        Lv <span className="text-hud text-lime">{viewer.level}</span>
                      </span>{" "}
                      · {fieldLabel(viewer.field)}
                    </p>
                    {f.streak && (
                      <div className="mt-1">
                        <StreakFlame weeks={viewer.streakWeeks} restWeekAvailable={viewer.restWeekAvailable} variant="inline" />
                      </div>
                    )}
                  </div>
                </div>
                <ExpBar exp={viewer.exp} max={viewer.expMax} level={viewer.level} className="mt-4" />
                <dl className="mt-4 grid grid-cols-3 gap-px bg-bezel-raised text-center">
                  <Stat label="Applications" value={viewer.applicationsTotal} />
                  <Stat label="Total EXP" value={viewer.totalExp} />
                  <Stat label="Badges" value={earned} />
                </dl>
              </section>
            ) : (
              <p className="mt-1 text-base text-muted">Signed in as {viewer.username}</p>
            )}

            <Button className="mt-4 w-full sm:w-auto" icon={<PixelIcon name="profile" scale={2} />} onClick={startEdit}>
              {f.avatar ? "Edit character sheet" : "Edit profile"}
            </Button>
          </div>

          {/* ---- Details ---- */}
          <section aria-labelledby="details-h">
            <h2 id="details-h" className="text-xl font-semibold">
              {f.avatar ? "Your build" : "Details"}
            </h2>
            <dl className="mt-3 divide-y divide-line border border-line bg-screen">
              <Row label={v("skills")}>
                <ul className="flex flex-wrap gap-1.5">
                  {viewer.skills.map((s) => (
                    <li key={s}>
                      <SkillChip name={skillName(s)} state="matched" />
                    </li>
                  ))}
                </ul>
              </Row>
              <Row label="Main field">{fieldLabel(viewer.field)}</Row>
              <Row label="City">{city?.name ?? <span className="text-muted">Not set. Add one to rank listings by distance.</span>}</Row>
              <Row label="Work type">{viewer.workType ? WORK_TYPE_LABEL[viewer.workType] : "No preference"}</Row>
              <Row label="Status">{status ?? <span className="text-muted">Not shared</span>}</Row>
              <Row label="School or group">{school ?? <span className="text-muted">Not shared</span>}</Row>
            </dl>
          </section>

          {/* ---- Badges (Full and Light) ---- */}
          {f.badges && (
            <section aria-labelledby="badges-h">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="badges-h" className="text-xl font-semibold">
                  Badges
                </h2>
                <p className="text-sm text-muted">
                  {earned} of {badges.length} earned
                </p>
              </div>
              {earned === 0 && (
                <p className="mt-1 text-base text-muted">Your first one comes when you confirm your first application.</p>
              )}
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
                {badges.map((b) => (
                  <li key={b.id} className="[&>figure]:h-full [&>figure]:w-full sm:[&>figure]:w-36">
                    <Badge name={b.name} sprite={b.sprite} earned={b.earned} description={b.description} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ---- Share (phones: a sheet; desktop: the right column) ---- */}
          {f.exp && (
            <div className="lg:hidden">
              <Button variant="secondary" block icon={<PixelIcon name="external" scale={2} />} onClick={() => setShareOpen(true)}>
                Share my progress
              </Button>
            </div>
          )}

          {/* ---- Phone links (desktop has these in the sidebar) ---- */}
          <nav aria-label="More" className="lg:hidden">
            <ul className="divide-y divide-line border-y border-line">
              {showLeaderboard && <NavRow href="/leaderboard" icon="trophy" label="Leaderboard" />}
              <NavRow href="/settings" icon="gear" label="Settings" />
              <li>
                <LogOutButton />
              </li>
            </ul>
          </nav>
        </div>

        {f.exp && (
          <aside aria-labelledby="share-h" className="hidden border border-line bg-screen p-5 lg:sticky lg:top-8 lg:block">
            <h2 id="share-h" className="text-xl font-semibold">
              Share your progress
            </h2>
            <p className="mb-4 text-sm text-muted">Pick what to show, then save the image.</p>
            {share}
          </aside>
        )}
      </div>

      {f.exp && (
        <Sheet open={shareOpen} onClose={() => setShareOpen(false)} title="Share your progress" description="Pick what to show, then save the image.">
          {shareOpen && share}
        </Sheet>
      )}
    </AppShell>
  );
}

/* ------------------------------------------------------------------------ */

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-bezel px-1 py-2">
      <dt className="text-xs text-bezel-text">{label}</dt>
      <dd className="font-pixel text-hud-lg text-lime">{value.toLocaleString("en-US")}</dd>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm font-semibold text-muted">{label}</dt>
      <dd className="text-base">{children}</dd>
    </div>
  );
}

function NavRow({ href, icon, label }: { href: string; icon: SpriteName; label: string }) {
  return (
    <li>
      <Link href={href} className="flex min-h-tap items-center gap-3 py-3 text-base font-semibold hover:bg-screen">
        <PixelIcon name={icon} scale={3} />
        <span className="flex-1">{label}</span>
        <PixelIcon name="chevronRight" scale={2} className="text-muted" />
      </Link>
    </li>
  );
}

/** TODO(Phase 1): a server action that ends the session, then goes to the landing page. */
function LogOutButton() {
  const router = useRouter();
  return (
    <button type="button" onClick={() => router.push("/")} className="flex min-h-tap w-full items-center gap-3 py-3 text-left text-base font-semibold">
      <PixelIcon name="close" scale={3} />
      Log out
    </button>
  );
}

/* ------------------------------------------------------------------------ */

function EditProfile({
  viewer,
  onSave,
  onCancel,
}: {
  viewer: Viewer;
  /** Only called once valid, so the field is always set. */
  onSave: (v: ProfileValues & { field: FieldId }) => void;
  onCancel: () => void;
}) {
  const f = useFeatures();
  const uid = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [values, setValues] = useState<ProfileValues>({
    look: viewer.look,
    field: viewer.field,
    skills: viewer.skills,
    cityId: viewer.cityId,
    workType: viewer.workType,
    status: viewer.status,
    school: viewer.school,
  });
  const [cityText, setCityText] = useState(findCityById(viewer.cityId)?.name ?? "");
  const [tried, setTried] = useState(false);

  // Entering edit mode moves focus to its heading, so screen readers know the page changed.
  useEffect(() => heading.current?.focus(), []);

  const submit = () => {
    setTried(true);
    const errors = profileErrors(values, cityText);
    if (errors.field || errors.city) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    if (errors.skills) {
      requestAnimationFrame(() => document.getElementById(`${uid}-q`)?.focus());
      return;
    }
    if (values.field) onSave({ ...values, field: values.field });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold focus:outline-none lg:text-3xl">
        {f.avatar ? "Edit character sheet" : "Edit profile"}
      </h1>
      <p className="mt-1 text-base text-muted">Your matches update as soon as you save.</p>
      <form
        ref={formRef}
        noValidate
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <ProfileFields
          values={values}
          onChange={(patch) => setValues((v0) => ({ ...v0, ...patch }))}
          cityText={cityText}
          onCityText={setCityText}
          showErrors={tried}
          idPrefix={uid}
        />
        <p className="mt-6 text-sm text-muted">Your username and password are in Settings.</p>
        {/* Sticky on phones so Save is always in reach on a long form. */}
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-gutter mt-4 flex gap-2 border-t border-line bg-canvas px-gutter py-3 lg:static lg:mx-0 lg:border-0 lg:px-0">
          <Button type="submit" size="lg" className="flex-1 sm:flex-none">
            Save changes
          </Button>
          <Button variant="secondary" size="lg" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
