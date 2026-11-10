"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type ReactNode } from "react";
import { companyLogOut, publishListing, saveListingDraft } from "@/app/actions/company";
import { FormError } from "@/components/auth/AuthShell";
import { BusinessHeader, HEADER_LINK } from "@/components/layout/BusinessHeader";
import { Button } from "@/components/ui/Button";
import { Checkbox, SelectField, TextField } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/Button";
import { ListingCard } from "@/components/ui/ListingCard";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { cn } from "@/lib/cn";
import { CITIES } from "@/lib/catalog/cities";
import { FIELDS, isFieldId } from "@/lib/catalog/fields";
import { searchSkills, skillName } from "@/lib/catalog/skills";
import type { Company } from "@/lib/company/account";
import {
  DESC_MAX,
  MAX_POST_SKILLS,
  TITLE_MAX,
  draftPreview,
  postingChecklist,
  validatePosting,
  type PostingDraft,
  type PostingErrors,
} from "@/lib/company/posting";
import type { WorkType } from "@/lib/listings/types";
import { manilaDate } from "@/lib/tracker/log";

const CHIP = "inline-flex min-h-tap cursor-pointer items-center gap-1.5 border-2 px-3 text-base has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink";
const ON = "border-green bg-green font-semibold text-screen";
const OFF = "border-muted bg-screen text-ink hover:border-ink";

type Status = "draft" | "published" | "closed" | null;

/**
 * W13 post form (USER_FLOWS §7.6–7). No game elements. Saving (draft or
 * publish) always writes to the database first, then the full check runs
 * again server side before anything goes live (never trust the client).
 */
export function PostForm({
  company,
  editingId,
  editingStatus,
  initialDraft,
}: {
  company: Company;
  editingId: string | null;
  editingStatus: Status;
  initialDraft: PostingDraft;
}) {
  const router = useRouter();
  const uid = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const approved = company.approved;
  const [today] = useState(() => manilaDate(new Date()));

  const [listingId, setListingId] = useState(editingId);
  const [d, setD] = useState<PostingDraft>(initialDraft);
  const [tried, setTried] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"draft" | "publish" | null>(null);
  const set = (patch: Partial<PostingDraft>) => setD((v) => ({ ...v, ...patch }));

  const errors = validatePosting(d, today, company.workEmail);
  const show = (k: keyof PostingErrors) => (tried ? errors[k] : undefined);
  const checklist = postingChecklist(d, errors);
  const preview = draftPreview(d, company.name, approved, today);
  const back = "/companies/dashboard";

  const goBack = (saved: "draft" | "published") => router.push(`${back}?saved=${saved}`);

  const publish = async () => {
    setTried(true);
    setServerError(null);
    if (Object.keys(errors).length > 0) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"] input, [data-invalid="true"] button')?.focus());
      return;
    }
    setBusy("publish");
    const saveRes = await saveListingDraft(d, listingId ?? undefined).catch(() => ({ ok: false as const, error: "Couldn't reach InternQuest. Check your connection and try again." }));
    if (!saveRes.ok) {
      setBusy(null);
      setServerError(saveRes.error);
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    const id = saveRes.id;
    setListingId(id);
    const publishRes = await publishListing(id).catch(() => ({ ok: false as const, error: "Couldn't reach InternQuest. Check your connection and try again." }));
    setBusy(null);
    if (!publishRes.ok) {
      setServerError(publishRes.error);
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    goBack("published");
  };

  // A draft only needs a title (3+ characters), so nobody loses work halfway through.
  const saveDraft = async () => {
    setServerError(null);
    if (d.title.trim().length < 3) {
      setDraftError("Add a title first (at least 3 characters), so you can find the draft later.");
      requestAnimationFrame(() => document.getElementById(`${uid}-title`)?.querySelector("input")?.focus());
      return;
    }
    setBusy("draft");
    const res = await saveListingDraft(d, listingId ?? undefined).catch(() => ({ ok: false as const, error: "Couldn't reach InternQuest. Check your connection and try again." }));
    setBusy(null);
    if (!res.ok) {
      setServerError(res.error);
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setListingId(res.id);
    goBack("draft");
  };

  return (
    <>
      <BusinessHeader area="for companies" home={back}>
        <span className="hidden px-3 text-sm text-bezel-text sm:inline">{company.name}</span>
        <form action={companyLogOut}>
          <button type="submit" className={HEADER_LINK}>
            Log out
          </button>
        </form>
      </BusinessHeader>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-gutter pb-16 pt-4 lg:pt-8">
        <Link href={back} className="inline-flex min-h-tap items-center gap-1.5 font-semibold text-green underline-offset-4 hover:underline">
          <PixelIcon name="chevronRight" scale={2} className="rotate-180" />
          Your listings
        </Link>
        <h1 className="text-2xl font-semibold lg:text-3xl">{editingId ? `Edit "${d.title || "listing"}"` : "New listing"}</h1>
        {!approved && (
          <p className="mt-2 border-l-4 border-ink bg-screen p-3 text-base">
            You can save this as a draft now. It goes live when your company is approved.
          </p>
        )}
        {editingStatus === "published" && (
          <p className="mt-2 border-l-4 border-green bg-green-tint p-3 text-base">This listing is live. Saving updates it right away.</p>
        )}

        {serverError && (
          <div ref={errorRef} tabIndex={-1} className="mt-4 focus:outline-none">
            <FormError message={serverError} />
          </div>
        )}

        <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10">
          <form
            ref={formRef}
            noValidate
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (approved) void publish();
              else void saveDraft();
            }}
          >
            <Group title="The role">
              <div id={`${uid}-title`}>
                <TextField
                  label="Title"
                  value={d.title}
                  onChange={(e) => {
                    set({ title: e.target.value });
                    setDraftError(null);
                  }}
                  maxLength={TITLE_MAX}
                  placeholder="e.g. IoT Firmware Intern"
                  error={draftError ?? show("title")}
                />
              </div>
              <SelectField
                label="Field"
                value={d.field}
                onChange={(e) => set({ field: isFieldId(e.target.value) ? e.target.value : "" })}
                hint="Interns who picked this field see it ranked higher."
                options={[{ value: "", label: "Choose one" }, ...FIELDS.map((f) => ({ value: f.id, label: f.label }))]}
                error={show("field")}
              />
              <div className="space-y-1">
                <label htmlFor={`${uid}-desc`} className="block text-sm font-semibold">
                  What the intern will do
                </label>
                <p id={`${uid}-desc-hint`} className="text-sm text-muted">
                  The tasks, who they&apos;ll work with, and what they&apos;ll learn. Plain words work best.
                </p>
                <textarea
                  id={`${uid}-desc`}
                  value={d.description}
                  onChange={(e) => set({ description: e.target.value })}
                  maxLength={DESC_MAX}
                  rows={6}
                  aria-invalid={show("description") ? true : undefined}
                  aria-describedby={`${uid}-desc-hint${show("description") ? ` ${uid}-desc-err` : ""}`}
                  className="block w-full border-2 border-muted bg-screen p-3 text-base aria-invalid:border-alert"
                />
                <div className="flex justify-between gap-3 text-sm">
                  <FieldError id={`${uid}-desc-err`} text={show("description")} />
                  <span className="ml-auto text-muted" aria-hidden="true">
                    {d.description.length}/{DESC_MAX}
                  </span>
                </div>
              </div>
            </Group>

            <Group title="Skills">
              <SkillEditor skills={d.skills} onChange={(skills) => set({ skills })} error={show("skills")} />
            </Group>

            <Group title="Where and how">
              <Choice
                legend="Work type"
                value={d.workType}
                options={(["onsite", "hybrid", "remote"] as WorkType[]).map((w) => ({ value: w, label: w === "onsite" ? "Onsite" : w === "hybrid" ? "Hybrid" : "Remote" }))}
                onChange={(w) => set({ workType: w as WorkType })}
                error={show("workType")}
              />
              {d.workType !== "remote" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label htmlFor={`${uid}-city`} className="block text-sm font-semibold">
                      City
                    </label>
                    <input
                      id={`${uid}-city`}
                      list={`${uid}-cities`}
                      value={d.city}
                      onChange={(e) => set({ city: e.target.value })}
                      autoComplete="off"
                      placeholder="e.g. Quezon City"
                      aria-invalid={show("city") ? true : undefined}
                      aria-describedby={show("city") ? `${uid}-city-err` : undefined}
                      className="block min-h-tap w-full border-2 border-muted bg-screen px-3 text-base aria-invalid:border-alert"
                    />
                    <datalist id={`${uid}-cities`}>
                      {CITIES.map((c) => (
                        <option key={c.id} value={c.name} />
                      ))}
                    </datalist>
                    <FieldError id={`${uid}-city-err`} text={show("city")} />
                  </div>
                  <TextField label="Area or building" optional value={d.area} onChange={(e) => set({ area: e.target.value })} maxLength={60} placeholder="e.g. Cubao" />
                </div>
              )}
            </Group>

            <Group title="Allowance, hours, and MOA">
              <Choice
                legend="Allowance"
                value={d.allowance.kind}
                options={[
                  { value: "amount", label: "With allowance" },
                  { value: "unpaid", label: "Unpaid" },
                ]}
                onChange={(k) => set({ allowance: k === "unpaid" ? { kind: "unpaid" } : { kind: "amount", text: "" } })}
              />
              {d.allowance.kind === "amount" && (
                <TextField
                  label="Amount"
                  value={d.allowance.text}
                  onChange={(e) => set({ allowance: { kind: "amount", text: e.target.value } })}
                  maxLength={40}
                  placeholder="e.g. ₱500/day"
                  hint="Saying the amount helps interns plan their fare and meals."
                  error={show("allowance")}
                />
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="OJT hours"
                  optional
                  inputMode="numeric"
                  value={d.hours}
                  onChange={(e) => set({ hours: e.target.value.replace(/[^\d]/g, "") })}
                  placeholder="e.g. 486"
                  error={show("hours")}
                />
                <div className="sm:pt-6">
                  <Checkbox label="We can sign a school MOA" checked={d.moa} onChange={(e) => set({ moa: e.target.checked })} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Application deadline" optional type="date" min={today} value={d.deadline} onChange={(e) => set({ deadline: e.target.value })} error={show("deadline")} />
                <TextField label="Start date" optional type="date" min={today} value={d.startDate} onChange={(e) => set({ startDate: e.target.value })} error={show("startDate")} />
              </div>
            </Group>

            <Group title="How to apply">
              <Choice
                legend="Interns apply by"
                value={d.apply.kind}
                options={[
                  { value: "link", label: "A link" },
                  { value: "email", label: "Email" },
                ]}
                onChange={(k) => set({ apply: k === "email" ? { kind: "email", email: "" } : { kind: "link", url: "" } })}
              />
              {d.apply.kind === "link" ? (
                <TextField
                  label="Application link"
                  type="url"
                  inputMode="url"
                  value={d.apply.url}
                  onChange={(e) => set({ apply: { kind: "link", url: e.target.value } })}
                  placeholder="https://"
                  hint="Your careers page or form. Interns go there in a new tab."
                  error={show("apply")}
                />
              ) : (
                <TextField
                  label="Application email"
                  type="email"
                  inputMode="email"
                  value={d.apply.email}
                  onChange={(e) => set({ apply: { kind: "email", email: e.target.value } })}
                  placeholder={`e.g. ojt@${company.workEmail.split("@")[1]}`}
                  hint="On your company's domain, so interns know it's really you."
                  error={show("apply")}
                />
              )}
            </Group>

            {/* Phones: the preview sits right above the buttons. */}
            <div className="lg:hidden">
              <Preview card={preview} checklist={checklist} />
            </div>

            {tried && Object.keys(errors).length > 0 && (
              <p role="alert" className="flex items-start gap-2 text-base font-semibold text-alert">
                <PixelIcon name="alert" scale={2} className="mt-1" />
                A few things need fixing before this can go live. They&apos;re marked above.
              </p>
            )}
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              {approved ? (
                <Button type="submit" size="lg" loading={busy === "publish"}>
                  Publish
                </Button>
              ) : (
                <Button type="button" size="lg" disabled aria-describedby={`${uid}-locked`}>
                  Publish
                </Button>
              )}
              <Button type={approved ? "button" : "submit"} variant="secondary" size="lg" loading={busy === "draft"} onClick={approved ? () => void saveDraft() : undefined}>
                Save draft
              </Button>
              {!approved && (
                <p id={`${uid}-locked`} className="w-full text-sm text-muted">
                  Publishing opens when your company is approved.
                </p>
              )}
            </div>
          </form>

          <aside aria-label="Preview" className="sticky top-8 hidden lg:block">
            <Preview card={preview} checklist={checklist} />
          </aside>
        </div>
      </main>
    </>
  );
}

/* ------------------------------------------------------------------------ */

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 border border-line bg-screen p-4">
      <legend className="px-1 text-lg font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

function FieldError({ id, text }: { id: string; text?: string }) {
  if (!text) return null;
  return (
    <p id={id} className="flex items-start gap-1.5 text-sm font-semibold text-alert">
      <PixelIcon name="alert" scale={2} className="mt-0.5" />
      {text}
    </p>
  );
}

function Choice({
  legend,
  value,
  options,
  onChange,
  error,
}: {
  legend: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  error?: string;
}) {
  const id = useId();
  return (
    <fieldset aria-describedby={error ? `${id}-err` : undefined} data-invalid={error ? "true" : undefined}>
      <legend className="text-sm font-semibold">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className={cn(CHIP, value === o.value ? ON : OFF)}>
            <input type="radio" name={id} className="sr-only" checked={value === o.value} onChange={() => onChange(o.value)} />
            {value === o.value && <PixelIcon name="check" scale={2} />}
            {o.label}
          </label>
        ))}
      </div>
      <div className="mt-1">
        <FieldError id={`${id}-err`} text={error} />
      </div>
    </fieldset>
  );
}

/** Pick skills from the shared list, each marked Required or Nice to have (SPEC §7 weights 2 and 1). */
function SkillEditor({
  skills,
  onChange,
  error,
}: {
  skills: PostingDraft["skills"];
  onChange: (s: PostingDraft["skills"]) => void;
  error?: string;
}) {
  const id = useId();
  const [q, setQ] = useState("");
  const chosen = new Set(skills.map((s) => s.id));
  const results = q.trim() ? searchSkills(q).filter((s) => !chosen.has(s.id)).slice(0, 8) : [];
  const full = skills.length >= MAX_POST_SKILLS;

  return (
    <div className="space-y-3" data-invalid={error ? "true" : undefined}>
      <p className="text-sm text-muted">Required skills count twice as much in the match. Interns can still apply without them.</p>
      {skills.length > 0 && (
        <ul className="divide-y divide-line border border-line">
          {skills.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span className="font-semibold">{skillName(s.id)}</span>
              <span className="flex items-center gap-1">
                <fieldset className="flex">
                  <legend className="sr-only">{skillName(s.id)} is</legend>
                  {[
                    { required: true, label: "Required" },
                    { required: false, label: "Nice to have" },
                  ].map((o) => (
                    <label
                      key={o.label}
                      className={cn(
                        "inline-flex min-h-tap cursor-pointer items-center border-2 px-2.5 text-sm has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ink",
                        s.required === o.required ? "border-ink bg-ink font-semibold text-screen" : "border-muted bg-screen",
                      )}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        name={`${id}-${s.id}`}
                        checked={s.required === o.required}
                        onChange={() => onChange(skills.map((x) => (x.id === s.id ? { ...x, required: o.required } : x)))}
                      />
                      {o.label}
                    </label>
                  ))}
                </fieldset>
                <IconButton label={`Remove ${skillName(s.id)}`} onClick={() => onChange(skills.filter((x) => x.id !== s.id))}>
                  <PixelIcon name="close" scale={2} />
                </IconButton>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-1">
        <label htmlFor={`${id}-q`} className="block text-sm font-semibold">
          Add a skill <span className="font-normal text-muted">({skills.length} of {MAX_POST_SKILLS})</span>
        </label>
        <input
          id={`${id}-q`}
          type="search"
          value={q}
          disabled={full}
          onChange={(e) => setQ(e.target.value)}
          placeholder={full ? "That's the most you can add" : "Search, e.g. Excel, Arduino, Figma"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          className="block min-h-tap w-full border-2 border-muted bg-screen px-3 text-base aria-invalid:border-alert disabled:opacity-60"
        />
        {q.trim() && (
          <ul className="flex flex-wrap gap-2 pt-1" aria-label="Matching skills">
            {results.length === 0 ? (
              <li className="text-sm text-muted">No skill called &ldquo;{q}&rdquo; in our list yet. Try a shorter word.</li>
            ) : (
              results.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      // The first skill is required by default; later ones start as nice to have.
                      onChange([...skills, { id: s.id, required: !skills.some((x) => x.required) }]);
                      setQ("");
                    }}
                    className={cn(CHIP, OFF)}
                  >
                    <PixelIcon name="plus" scale={2} />
                    {s.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
        <FieldError id={`${id}-err`} text={error} />
      </div>
    </div>
  );
}

function Preview({ card, checklist }: { card: ReturnType<typeof draftPreview>; checklist: ReturnType<typeof postingChecklist> }) {
  const done = checklist.filter((c) => c.done).length;
  return (
    <section aria-labelledby="preview-h" className="space-y-4">
      <div>
        <h2 id="preview-h" className="text-lg font-semibold">
          How interns will see it
        </h2>
        <p className="text-sm text-muted">Shown for an intern in this field who has your required skills.</p>
      </div>
      {/* A picture of the card, not a real link: inert keeps it out of the tab order (the checklist below says the same in words). */}
      <div inert>
        <ListingCard listing={card} href="#preview-h" />
      </div>
      <div className="border border-line bg-screen p-4">
        <p className="text-sm font-semibold">
          Ready to publish: {done} of {checklist.length}
        </p>
        <ul className="mt-2 space-y-1">
          {checklist.map((c) => (
            <li key={c.label} className="flex items-center gap-2 text-base">
              {c.done ? (
                <span className="flex size-5 flex-none items-center justify-center bg-green text-screen">
                  <PixelIcon name="check" scale={2} />
                </span>
              ) : (
                <span className="size-5 flex-none border-2 border-muted" />
              )}
              <span className={c.done ? undefined : "text-muted"}>{c.label}</span>
              <span className="sr-only">{c.done ? "(done)" : "(to do)"}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
