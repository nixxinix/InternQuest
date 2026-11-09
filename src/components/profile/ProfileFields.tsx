"use client";

import { useState } from "react";
import { Avatar } from "@/components/game/Avatar";
import { LIVE } from "@/components/providers/AccountProvider";
import { useFeatures, useVocab } from "@/components/providers/GameModeProvider";
import { ChipPicker, SelectField } from "@/components/ui/Field";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { AVATAR_PRESETS } from "@/components/ui/sprites";
import { cn } from "@/lib/cn";
import { CITIES, cityLabel, findCityById, findCityByName, isGeoCityId } from "@/lib/catalog/cities";
import { OSM_ATTRIBUTION_URL } from "@/lib/geo/nominatim";
import { FIELDS, isFieldId } from "@/lib/catalog/fields";
import { PROFILE_STATUSES, SCHOOLS } from "@/lib/catalog/schools";
import { SKILLS, STARTER_SKILLS, canonicalSkill, searchSkills, skillsForField } from "@/lib/catalog/skills";
import { MAX_SKILLS } from "@/lib/listings/picks";
import type { WorkType } from "@/lib/listings/types";
import { profileErrors, type ProfileValues } from "@/lib/profile/validate";

const SKIN_NAMES = ["Light", "Light medium", "Medium", "Medium dark", "Dark"];
const HAIR_NAMES = ["Black", "Dark brown", "Brown", "Blue-gray"];
const SKILL_NAMES = Object.fromEntries(SKILLS.map((s) => [s.id, s.name]));

const WORK_TYPES: { id: WorkType | null; label: string }[] = [
  { id: null, label: "No preference" },
  { id: "onsite", label: "Onsite" },
  { id: "hybrid", label: "Hybrid" },
  { id: "remote", label: "Remote" },
];

type ProfileFieldsProps = {
  values: ProfileValues;
  onChange: (patch: Partial<ProfileValues>) => void;
  /** What's typed in the city box. Owned by the parent so it can validate on submit. */
  cityText: string;
  onCityText: (text: string) => void;
  /** Show every error (after the first submit). Before that, the city error shows on blur. */
  showErrors: boolean;
  /** Prefix for ids; the skill search box is `${idPrefix}-q` so a parent can focus it. */
  idPrefix: string;
};

/**
 * The character sheet / profile fields (SPEC §5.1). Used by onboarding step 4
 * and by Profile > Edit, so both always ask the same things the same way.
 */
export function ProfileFields({ values, onChange, cityText, onCityText, showErrors, idPrefix }: ProfileFieldsProps) {
  const f = useFeatures();
  const v = useVocab();
  const [query, setQuery] = useState("");
  const [cityTouched, setCityTouched] = useState(false);

  const errors = profileErrors(values, cityText, { anyPlace: LIVE });
  const fieldError = showErrors ? errors.field : undefined;
  const skillsError = showErrors ? errors.skills : undefined;
  const cityError = showErrors || cityTouched ? errors.city : undefined;

  // Options: search results, or picked first then the field's skills (synonyms of picked ones hidden).
  const picked = new Set(values.skills.map(canonicalSkill));
  const suggestions = (values.field ? skillsForField(values.field).map((s) => s.id) : STARTER_SKILLS).filter(
    (id) => !picked.has(canonicalSkill(id)),
  );
  const options = query.trim() ? searchSkills(query).map((s) => s.id) : [...values.skills, ...suggestions];

  return (
    <div className="space-y-6">
      {f.avatar && (
        <div className="flex items-center gap-5 border border-line bg-screen p-4">
          <div className="on-bezel flex-none p-2">
            <Avatar look={values.look} scale={6} label="Your avatar preview" />
          </div>
          <div className="min-w-0 space-y-3">
            <SwatchGroup
              legend="Skin tone"
              name={`${idPrefix}-skin`}
              colors={AVATAR_PRESETS.skin}
              names={SKIN_NAMES}
              value={values.look.skin}
              onChange={(skin) => onChange({ look: { ...values.look, skin } })}
            />
            <SwatchGroup
              legend="Hair"
              name={`${idPrefix}-hair`}
              colors={AVATAR_PRESETS.hair}
              names={HAIR_NAMES}
              value={values.look.hair}
              onChange={(hair) => onChange({ look: { ...values.look, hair } })}
            />
          </div>
        </div>
      )}

      <SelectField
        label={f.avatar ? "Class (your main field)" : "Main field"}
        value={values.field ?? ""}
        onChange={(e) => onChange({ field: isFieldId(e.target.value) ? e.target.value : null })}
        error={fieldError}
        options={[{ value: "", label: "Choose one" }, ...FIELDS.map((x) => ({ value: x.id, label: x.label }))]}
      />

      <div className="space-y-2">
        <label htmlFor={`${idPrefix}-q`} className="block text-sm font-semibold">
          Your {v("skills").toLowerCase()}
        </label>
        <input
          id={`${idPrefix}-q`}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search, e.g. Excel, React, AutoCAD"
          aria-describedby={skillsError ? `${idPrefix}-skills-err` : undefined}
          className="block min-h-tap w-full border-2 border-muted bg-screen px-3 text-base placeholder:text-muted"
        />
        {options.length === 0 ? (
          <p className="text-base text-muted">No skill called &ldquo;{query}&rdquo; yet. Try a shorter word.</p>
        ) : (
          <ChipPicker
            legend={query ? `${options.length} found` : values.field ? "Suggested for your field" : "Common skills"}
            options={options}
            labels={SKILL_NAMES}
            value={values.skills}
            onChange={(next) => onChange({ skills: next })}
            max={MAX_SKILLS}
          />
        )}
        {skillsError && (
          <p id={`${idPrefix}-skills-err`} className="flex items-start gap-1.5 text-sm font-semibold text-alert" role="alert">
            <PixelIcon name="alert" scale={2} className="mt-0.5" />
            {skillsError}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-city`} className="block text-sm font-semibold">
          City or area <span className="font-normal text-muted">(optional)</span>
        </label>
        <p id={`${idPrefix}-city-hint`} className="text-sm text-muted">
          Used to rank listings by distance. Only the city is saved, never an exact address.
          {LIVE && (
            <>
              {" "}
              Not on the list? Type it anyway: we look it up on{" "}
              <a href={OSM_ATTRIBUTION_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                OpenStreetMap
              </a>{" "}
              when you save.
            </>
          )}
        </p>
        <input
          id={`${idPrefix}-city`}
          list={`${idPrefix}-cities`}
          value={cityText}
          onChange={(e) => {
            const text = e.target.value;
            onCityText(text);
            setCityTouched(false);
            // Keep a place found earlier while its name is unchanged; otherwise use the list.
            const current = findCityById(values.cityId);
            const keep = current && isGeoCityId(current.id) && cityLabel(current) === text.trim();
            onChange({ cityId: keep ? current.id : (findCityByName(text)?.id ?? null) });
          }}
          onBlur={() => setCityTouched(true)}
          autoComplete="off"
          placeholder="e.g. Pasig"
          aria-invalid={cityError ? true : undefined}
          aria-describedby={`${idPrefix}-city-hint${cityError ? ` ${idPrefix}-city-err` : ""}`}
          className="block min-h-tap w-full border-2 border-muted bg-screen px-3 text-base placeholder:text-muted aria-invalid:border-alert"
        />
        <datalist id={`${idPrefix}-cities`}>
          {CITIES.map((c) => (
            <option key={c.id} value={c.name}>
              {c.province}
            </option>
          ))}
        </datalist>
        {cityError && (
          <p id={`${idPrefix}-city-err`} className="flex items-start gap-1.5 text-sm font-semibold text-alert">
            <PixelIcon name="alert" scale={2} className="mt-0.5" />
            {cityError}
          </p>
        )}
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">Preferred work type</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {WORK_TYPES.map((w) => {
            const on = values.workType === w.id;
            return (
              <label
                key={w.label}
                className={cn(
                  "inline-flex min-h-tap cursor-pointer items-center gap-1.5 border-2 px-3 text-base",
                  on ? "border-green bg-green font-semibold text-screen" : "border-muted bg-screen text-ink hover:border-ink",
                  "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink",
                )}
              >
                <input
                  type="radio"
                  name={`${idPrefix}-work`}
                  className="sr-only"
                  checked={on}
                  onChange={() => onChange({ workType: w.id })}
                />
                {on && <PixelIcon name="check" scale={2} />}
                {w.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          label="Status"
          optional
          value={values.status ?? ""}
          onChange={(e) => onChange({ status: e.target.value || null })}
          options={[{ value: "", label: "Prefer not to say" }, ...PROFILE_STATUSES.map((s) => ({ value: s.id, label: s.label }))]}
        />
        <SelectField
          label="School or group"
          optional
          value={values.school ?? ""}
          onChange={(e) => onChange({ school: e.target.value || null })}
          hint="For the school leaderboard. Only your username is ever shown."
          options={[
            { value: "", label: "Prefer not to say" },
            ...SCHOOLS.map((s) => ({ value: s.id, label: s.name })),
            { value: "not-listed", label: "My school isn't listed" },
            { value: "not-in-school", label: "Not in school" },
          ]}
        />
      </div>
    </div>
  );
}

function SwatchGroup({
  legend,
  name,
  colors,
  names,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  colors: readonly string[];
  names: string[];
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold">{legend}</legend>
      <div className="mt-1 flex flex-wrap gap-1">
        {colors.map((c, i) => {
          const on = c === value;
          return (
            <label
              key={c}
              className="relative inline-flex size-tap cursor-pointer items-center justify-center has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ink"
            >
              <input type="radio" name={name} className="sr-only" checked={on} onChange={() => onChange(c)} />
              <span className="sr-only">{names[i]}</span>
              {/* Selected = thick ink ring (a shape change, not just color). */}
              <span
                aria-hidden="true"
                className={cn("block size-8 border-2", on ? "border-ink ring-2 ring-ink ring-offset-2" : "border-muted")}
                style={{ background: c }}
              />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
