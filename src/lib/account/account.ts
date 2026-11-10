/**
 * The signed-in user's account as the app sees it, built from database rows.
 * Pure functions (no Supabase imports), so the mapping and the input checks
 * are unit tested. Server code loads the rows (src/lib/account/server.ts).
 */
import { cityLabel, findCatalogCity, findCityById, geoCityId, isGeoCityId } from "@/lib/catalog/cities";
import { isFieldId, type FieldId } from "@/lib/catalog/fields";
import { PROFILE_STATUSES, SCHOOLS } from "@/lib/catalog/schools";
import { isSkillId } from "@/lib/catalog/skills";
import { progressFrom, type ExpEvent, type Progress } from "@/lib/game/exp";
import { isGameMode } from "@/lib/game/mode";
import { manilaWeekStart, weekStartInstant } from "@/lib/game/streak";
import { isPlaceQuery } from "@/lib/geo/nominatim";
import { MAX_SKILLS } from "@/lib/listings/picks";
import { WORK_TYPE_LABEL, type WorkType } from "@/lib/listings/types";
import { haversineKm } from "@/lib/matching/geo";
import type { ProfileValues } from "@/lib/profile/validate";
import type { LogEntry } from "@/lib/tracker/log";
import { entryFromRow, summarize, type ApplicationRow, type QuestSummary } from "@/lib/tracker/rows";
import type { Viewer } from "@/lib/sample/viewer";
import { DEFAULT_SETTINGS, NOTE_TONES, type UserSettings } from "@/lib/settings/settings";

/* ------------------------------------------------------------------------ */
/* Database rows (see supabase/migrations)                                   */
/* ------------------------------------------------------------------------ */

export type ProfileRow = {
  id: string;
  username: string;
  field_id: string | null;
  city_name: string | null;
  /** numeric columns may arrive as strings */
  lat: number | string | null;
  lng: number | string | null;
  radius_km: number;
  work_type: string | null;
  status: string | null;
  school_id: string | null;
  avatar_skin: string;
  avatar_hair: string;
  onboarded_at: string | null;
  created_at: string;
};

export type SettingsRow = {
  mode: string;
  streaks: boolean;
  leaderboard: boolean;
  show_on_leaderboard: boolean;
  notes: string;
  animations: boolean;
  sound: boolean;
};

export type RecoveryRow = { codes_left: number | null; email: string | null };

/** The columns a user may change on their own profile (see the column grants in 0002_accounts.sql). */
export type ProfileUpdate = {
  field_id: FieldId;
  city_name: string | null;
  lat: number | null;
  lng: number | null;
  work_type: WorkType | null;
  status: string | null;
  school_id: string | null;
  avatar_skin: string;
  avatar_hair: string;
};

/* ------------------------------------------------------------------------ */
/* Account                                                                   */
/* ------------------------------------------------------------------------ */

export type RecoveryStatus = Viewer["recovery"];

export type Account = {
  id: string;
  username: string;
  look: { skin: string; hair: string };
  field: FieldId | null;
  skills: string[];
  /** A catalog city id, or a place found on the map ("@lat,lng:Name"). */
  cityId: string | null;
  workType: WorkType | null;
  status: string | null;
  school: string | null;
  /** False until the last onboarding step is saved. */
  onboarded: boolean;
  settings: UserSettings;
  recovery: RecoveryStatus;
  joinedAt: string;
  /** The quest log, newest change first. */
  questLog: LogEntry[];
  quest: QuestSummary;
  /** EXP, level, streak, weekly quest: computed on the server from exp_events. */
  progress: Progress;
  badges: string[];
  /** Checklist ticks per guide slug, saved on the server (follows you across devices). */
  tipsProgress: Record<string, string[]>;
};

/** EXP events and badges as read for the account (own rows only). */
export type GameRows = { events: ExpEvent[]; badges: string[]; tips?: { slug: string; done: string[] }[] };

const isWorkType = (v: unknown): v is WorkType => typeof v === "string" && v in WORK_TYPE_LABEL;

export function settingsFromRow(row: SettingsRow | null | undefined): UserSettings {
  if (!row) return DEFAULT_SETTINGS;
  return {
    mode: isGameMode(row.mode) ? row.mode : DEFAULT_SETTINGS.mode,
    streaks: row.streaks,
    leaderboard: row.leaderboard,
    showOnLeaderboard: row.show_on_leaderboard,
    notes: (NOTE_TONES as readonly string[]).includes(row.notes) ? (row.notes as UserSettings["notes"]) : DEFAULT_SETTINGS.notes,
    animations: row.animations,
    sound: row.sound,
  };
}

/** A recovery email wins over codes; codes with none left count as "none". */
export function recoveryFromRow(row: RecoveryRow | null | undefined): RecoveryStatus {
  if (row?.email) return { kind: "email", email: row.email };
  const left = row?.codes_left ?? 0;
  return left > 0 ? { kind: "codes", codesLeft: left } : { kind: "none" };
}

/**
 * The saved place as a city id: a catalog city when the name matches one and
 * the saved location is within 5 km of it (so "San Juan, Batangas" isn't
 * mistaken for San Juan in Metro Manila), otherwise a found-place id.
 */
export function cityIdFromRow(name: string | null, lat: number | string | null, lng: number | string | null): string | null {
  if (!name) return null;
  if (lat === null || lng === null) return findCatalogCity(name)?.id ?? null;
  const at = { lat: Number(lat), lng: Number(lng) };
  if (!Number.isFinite(at.lat) || !Number.isFinite(at.lng)) return null;
  const catalog = findCatalogCity(name);
  if (catalog && haversineKm(catalog, at) <= 5) return catalog.id;
  return findCityById(geoCityId(name, at.lat, at.lng))?.id ?? null;
}

export function accountFromRows(
  profile: ProfileRow,
  skills: string[],
  settings: SettingsRow | null | undefined,
  recovery: RecoveryRow | null | undefined,
  applications: ApplicationRow[] = [],
  now: Date = new Date(),
  game: GameRows = { events: [], badges: [] },
): Account {
  const weekStart = weekStartInstant(manilaWeekStart(now));
  const confirmedThisWeek = applications.filter((r) => r.confirmed_at && r.confirmed_at >= weekStart).length;
  return {
    id: profile.id,
    username: profile.username,
    look: { skin: profile.avatar_skin, hair: profile.avatar_hair },
    field: isFieldId(profile.field_id) ? profile.field_id : null,
    skills: skills.filter(isSkillId),
    cityId: cityIdFromRow(profile.city_name, profile.lat, profile.lng),
    workType: isWorkType(profile.work_type) ? profile.work_type : null,
    status: profile.status,
    school: profile.school_id,
    onboarded: profile.onboarded_at !== null,
    settings: settingsFromRow(settings),
    recovery: recoveryFromRow(recovery),
    joinedAt: profile.created_at,
    questLog: applications.map((r) => entryFromRow(r, now)),
    quest: summarize(applications, now),
    progress: progressFrom(game.events, { joinedAt: profile.created_at, now, confirmedThisWeek }),
    badges: game.badges,
    tipsProgress: Object.fromEntries((game.tips ?? []).map((t) => [t.slug, t.done])),
  };
}

/**
 * The shape the app screens use: the quest log's saved, applied, waiting,
 * and upcoming entries, plus the server-computed EXP, level, streak, badges,
 * and weekly quest.
 */
export function viewerFromAccount(a: Account): Viewer {
  const fromListings = a.questLog.filter((e) => e.listingId !== null);
  const p = a.progress;
  return {
    username: a.username,
    look: a.look,
    level: p.level,
    exp: p.exp,
    expMax: p.expMax,
    streakWeeks: p.streakWeeks,
    restWeekAvailable: p.restWeekAvailable,
    // Onboarding requires a field, so this fallback only shows mid-sign-up.
    field: a.field ?? "web",
    skills: a.skills,
    cityId: a.cityId,
    workType: a.workType,
    status: a.status,
    school: a.school,
    applicationsTotal: a.quest.confirmedCount,
    totalExp: p.totalExp,
    badges: a.badges,
    recovery: a.recovery,
    isNew: p.isNew,
    tutorial: {
      profile: a.onboarded || p.tutorial.profile,
      viewedMatch: p.tutorial.viewedMatch,
      saved: p.tutorial.saved || a.questLog.some((e) => e.listingId !== null),
      applied: a.quest.confirmedCount > 0,
    },
    weeklyQuest: p.weeklyQuest,
    saved: fromListings.filter((e) => e.status === "saved").map((e) => e.listingId as string),
    applied: fromListings.filter((e) => e.status !== "saved").map((e) => e.listingId as string),
    pendingConfirm: a.quest.pendingConfirm,
    upcoming: a.quest.upcoming,
  };
}

/* ------------------------------------------------------------------------ */
/* Input checks (server side, never trust the form)                          */
/* ------------------------------------------------------------------------ */

const HEX = /^#[0-9a-f]{6}$/;

/** Coordinates are rounded to 2 decimals (about 1 km) before they're saved. */
export function roundCoord(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Where the city comes from, decided on the server. */
export type CityChoice =
  | { kind: "none" }
  /** On our list, or a place found earlier and unchanged: no lookup needed. */
  | { kind: "known"; name: string; lat: number; lng: number }
  /** New text: look it up on the map (src/lib/geo/geocode.ts). */
  | { kind: "lookup"; text: string };

export type ProfileInput = ProfileValues & {
  /** What's in the city box. When present, it decides the city; `cityId` only saves a repeat lookup. */
  cityText?: string;
};

export type ProfileInputCheck =
  | { ok: true; update: Omit<ProfileUpdate, "city_name" | "lat" | "lng">; city: CityChoice; skills: string[] }
  | { ok: false; error: string };

/** Picker values that mean "no school on the list" rather than a school. */
const NO_SCHOOL_CHOICES = new Set(["not-listed", "not-in-school"]);

function cityChoice(cityId: unknown, cityText: unknown): CityChoice | string {
  const fromCity = (c: { name: string; province: string; lat: number; lng: number; id: string }): CityChoice => ({
    kind: "known",
    name: isGeoCityId(c.id) ? cityLabel(c) : c.name,
    lat: roundCoord(c.lat),
    lng: roundCoord(c.lng),
  });

  if (typeof cityText === "string") {
    const text = cityText.trim();
    if (!text) return { kind: "none" };
    const catalog = findCatalogCity(text);
    if (catalog) return fromCity(catalog);
    const earlier = typeof cityId === "string" && isGeoCityId(cityId) ? findCityById(cityId) : null;
    if (earlier && cityLabel(earlier).toLowerCase() === text.toLowerCase()) return fromCity(earlier);
    if (!isPlaceQuery(text)) return "Type a city or town name, like Antipolo, or leave it empty.";
    return { kind: "lookup", text };
  }

  // No text sent (older form): the id alone.
  if (cityId === null || cityId === undefined) return { kind: "none" };
  const city = typeof cityId === "string" ? findCityById(cityId) : null;
  return city ? fromCity(city) : "We don't know that place yet.";
}

export function validateProfileInput(input: unknown): ProfileInputCheck {
  const fail = (error: string): ProfileInputCheck => ({ ok: false, error });
  if (!input || typeof input !== "object") return fail("Something's missing. Reload the page and try again.");
  const v = input as Partial<ProfileInput>;

  if (!isFieldId(v.field)) return fail("Pick the field closest to what you study or want to do.");
  if (!Array.isArray(v.skills) || v.skills.length === 0) return fail("Pick at least one skill.");
  const skills = [...new Set(v.skills)];
  if (skills.length > MAX_SKILLS) return fail(`Pick up to ${MAX_SKILLS} skills.`);
  if (!skills.every((s) => typeof s === "string" && isSkillId(s))) return fail("One of those skills isn't on our list.");

  const city = cityChoice(v.cityId, v.cityText);
  if (typeof city === "string") return fail(city);

  if (v.workType !== null && v.workType !== undefined && !isWorkType(v.workType)) return fail("Pick a work type from the list.");
  if (v.status !== null && v.status !== undefined && !PROFILE_STATUSES.some((s) => s.id === v.status)) {
    return fail("Pick a status from the list.");
  }
  const school = v.school === null || v.school === undefined || NO_SCHOOL_CHOICES.has(v.school) ? null : v.school;
  if (school !== null && !SCHOOLS.some((s) => s.id === school)) return fail("Pick a school from the list.");
  const skin = v.look?.skin;
  const hair = v.look?.hair;
  if (typeof skin !== "string" || typeof hair !== "string" || !HEX.test(skin) || !HEX.test(hair)) {
    return fail("Pick an avatar look from the list.");
  }

  return {
    ok: true,
    skills,
    city,
    update: {
      field_id: v.field,
      work_type: v.workType ?? null,
      status: v.status ?? null,
      school_id: school,
      avatar_skin: skin,
      avatar_hair: hair,
    },
  };
}

/** Settings changes from the client, checked key by key. Unknown keys are refused. */
export function validateSettingsPatch(patch: unknown): Partial<SettingsRow> | null {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return null;
  const out: Partial<SettingsRow> = {};
  for (const [key, value] of Object.entries(patch)) {
    switch (key) {
      case "mode":
        if (!isGameMode(value)) return null;
        out.mode = value;
        break;
      case "notes":
        if (!(NOTE_TONES as readonly unknown[]).includes(value)) return null;
        out.notes = value as string;
        break;
      case "streaks":
      case "leaderboard":
      case "animations":
      case "sound":
        if (typeof value !== "boolean") return null;
        out[key] = value;
        break;
      case "showOnLeaderboard":
        if (typeof value !== "boolean") return null;
        out.show_on_leaderboard = value;
        break;
      default:
        return null;
    }
  }
  return Object.keys(out).length ? out : null;
}
