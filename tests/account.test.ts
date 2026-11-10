import { describe, expect, it } from "vitest";
import { draftWithAccount, newDraft } from "@/components/onboarding/draft";
import {
  accountFromRows,
  recoveryFromRow,
  settingsFromRow,
  validateProfileInput,
  validateSettingsPatch,
  viewerFromAccount,
  type ProfileRow,
  type SettingsRow,
} from "@/lib/account/account";
import { SKILLS } from "@/lib/catalog/skills";
import { DEFAULT_SETTINGS } from "@/lib/settings/settings";

const PROFILE: ProfileRow = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "mika.codes",
  field_id: "iot",
  city_name: "Quezon City",
  lat: "14.68",
  lng: "121.04",
  radius_km: 25,
  work_type: "hybrid",
  status: "student",
  school_id: "tip-qc",
  avatar_skin: "#c98f62",
  avatar_hair: "#1b1410",
  onboarded_at: "2026-11-09T08:00:00Z",
  created_at: "2026-11-09T07:55:00Z",
};

const SETTINGS: SettingsRow = {
  mode: "light",
  streaks: true,
  leaderboard: false,
  show_on_leaderboard: false,
  notes: "calm",
  animations: false,
  sound: false,
};

const VALUES = {
  look: { skin: "#c98f62", hair: "#1b1410" },
  field: "iot" as const,
  skills: ["c", "arduino"],
  cityId: "quezon-city",
  workType: "hybrid" as const,
  status: "student",
  school: "tip-qc",
};

describe("account from database rows", () => {
  it("maps a profile, its skills, settings, and recovery status", () => {
    const a = accountFromRows(PROFILE, ["c", "arduino"], SETTINGS, { codes_left: 7, email: null });
    expect(a).toMatchObject({
      username: "mika.codes",
      field: "iot",
      skills: ["c", "arduino"],
      cityId: "quezon-city",
      workType: "hybrid",
      school: "tip-qc",
      onboarded: true,
      recovery: { kind: "codes", codesLeft: 7 },
    });
    expect(a.settings).toEqual({ ...DEFAULT_SETTINGS, mode: "light", leaderboard: false, showOnLeaderboard: false, notes: "calm", animations: false });
  });

  it("drops values the app doesn't know instead of trusting them", () => {
    const a = accountFromRows({ ...PROFILE, field_id: "astrology", work_type: "moon", onboarded_at: null }, ["c", "not-a-skill"], null, null);
    expect(a.field).toBeNull();
    expect(a.workType).toBeNull();
    expect(a.skills).toEqual(["c"]);
    expect(a.onboarded).toBe(false);
    expect(a.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("reads the recovery method: email first, used-up codes count as none", () => {
    expect(recoveryFromRow({ codes_left: 3, email: "m@example.com" })).toEqual({ kind: "email", email: "m@example.com" });
    expect(recoveryFromRow({ codes_left: 0, email: null })).toEqual({ kind: "none" });
    expect(recoveryFromRow(null)).toEqual({ kind: "none" });
  });

  it("falls back to defaults for unknown settings values", () => {
    expect(settingsFromRow({ ...SETTINGS, mode: "turbo", notes: "loud" }).mode).toBe("full");
    expect(settingsFromRow({ ...SETTINGS, mode: "turbo", notes: "loud" }).notes).toBe("cheerful");
  });

  it("starts a real account like a new player until EXP arrives (Phase 3)", () => {
    const v = viewerFromAccount(accountFromRows(PROFILE, ["c"], SETTINGS, null));
    expect(v).toMatchObject({ username: "mika.codes", level: 1, exp: 0, totalExp: 0, isNew: true, saved: [], applied: [], badges: [] });
    expect(v.tutorial.profile).toBe(true);
  });
});

describe("profile input (server side)", () => {
  it("accepts a valid profile and rounds the city to about 1 km", () => {
    const r = validateProfileInput(VALUES);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.city).toEqual({ kind: "known", name: "Quezon City", lat: 14.68, lng: 121.04 });
      expect(r.update).toEqual({
        field_id: "iot",
        work_type: "hybrid",
        status: "student",
        school_id: "tip-qc",
        avatar_skin: "#c98f62",
        avatar_hair: "#1b1410",
      });
      expect(r.skills).toEqual(["c", "arduino"]);
    }
  });

  it("allows no city, work type, status, or school", () => {
    const r = validateProfileInput({ ...VALUES, cityId: null, workType: null, status: null, school: null });
    expect(r.ok && r.city).toEqual({ kind: "none" });
    expect(r.ok && r.update).toMatchObject({ work_type: null, status: null, school_id: null });
  });

  it("refuses anything not on our lists", () => {
    const bad: [string, unknown][] = [
      ["field", { ...VALUES, field: "astrology" }],
      ["no skills", { ...VALUES, skills: [] }],
      ["unknown skill", { ...VALUES, skills: ["c", "hacking"] }],
      ["11 skills", { ...VALUES, skills: SKILLS.slice(0, 11).map((s) => s.id) }],
      ["city", { ...VALUES, cityId: "atlantis" }],
      ["work type", { ...VALUES, workType: "moon" }],
      ["status", { ...VALUES, status: "wizard" }],
      ["school", { ...VALUES, school: "hogwarts" }],
      ["avatar", { ...VALUES, look: { skin: "red", hair: "#1b1410" } }],
      ["nothing", null],
    ];
    for (const [name, input] of bad) expect(validateProfileInput(input).ok, name).toBe(false);
  });

  it("removes duplicate skills", () => {
    const r = validateProfileInput({ ...VALUES, skills: ["c", "c", "arduino"] });
    expect(r.ok && r.skills).toEqual(["c", "arduino"]);
  });
});

describe("settings changes (server side)", () => {
  it("maps app names to columns and checks each value", () => {
    expect(validateSettingsPatch({ mode: "plain", showOnLeaderboard: false })).toEqual({ mode: "plain", show_on_leaderboard: false });
    expect(validateSettingsPatch({ notes: "off", sound: true })).toEqual({ notes: "off", sound: true });
  });

  it("refuses unknown keys, wrong types, and empty changes", () => {
    expect(validateSettingsPatch({ mode: "turbo" })).toBeNull();
    expect(validateSettingsPatch({ streaks: "yes" })).toBeNull();
    expect(validateSettingsPatch({ user_id: "someone-else" })).toBeNull();
    expect(validateSettingsPatch({})).toBeNull();
    expect(validateSettingsPatch(["mode"])).toBeNull();
  });
});

describe("onboarding with a real account", () => {
  const picks = { field: null, skills: [], city: null, remoteOk: true };

  it("resumes at step 2 on any device once the account exists", () => {
    const account = accountFromRows({ ...PROFILE, onboarded_at: null }, [], SETTINGS, null);
    const d = draftWithAccount(newDraft(picks), account);
    expect(d).toMatchObject({ username: "mika.codes", accountDone: true, recovery: null, mode: "light" });
  });

  it("counts recovery as done when codes are already saved", () => {
    const account = accountFromRows({ ...PROFILE, onboarded_at: null }, [], SETTINGS, { codes_left: 8, email: null });
    expect(draftWithAccount(newDraft(picks), account).recovery).toBe("codes");
  });

  it("starts over at step 1 when signed out, whatever this browser remembers", () => {
    const remembered = { ...newDraft(picks), username: "old.name", accountDone: true };
    expect(draftWithAccount(remembered, null).accountDone).toBe(false);
  });
});
