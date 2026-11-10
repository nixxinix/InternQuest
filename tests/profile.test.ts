import { describe, expect, it } from "vitest";
import { BADGES, badgeList } from "@/lib/game/badges";
import { DEFAULT_SHARE, canShare, shareLines, shareText, type ShareStats } from "@/lib/profile/share";
import { profileErrors, type ProfileValues } from "@/lib/profile/validate";
import {
  DEFAULT_SETTINGS,
  buildDataExport,
  canConfirmDelete,
  maskEmail,
} from "@/lib/settings/settings";

const stats: ShareStats = { username: "mika.codes", level: 4, totalExp: 1980, applications: 12, streakWeeks: 3 };

describe("share card", () => {
  it("shows level, applications, and streak by default, not EXP", () => {
    expect(shareLines(stats, DEFAULT_SHARE, true).map((l) => l.text)).toEqual([
      "Level 4",
      "12 applications sent",
      "3-week streak",
    ]);
  });

  it("drops the streak in Light (or when streaks are off) and when it's zero", () => {
    expect(shareLines(stats, DEFAULT_SHARE, false).map((l) => l.key)).not.toContain("streak");
    expect(shareLines({ ...stats, streakWeeks: 0 }, DEFAULT_SHARE, true).map((l) => l.key)).not.toContain("streak");
  });

  it("uses singular wording and thousands separators", () => {
    const one = shareLines({ ...stats, applications: 1 }, DEFAULT_SHARE, true);
    expect(one[1].text).toBe("1 application sent");
    expect(shareLines(stats, { ...DEFAULT_SHARE, exp: true }, true).at(-1)?.text).toBe("1,980 EXP");
  });

  it("copies the same facts as the card, with the link, and can leave the username out", () => {
    expect(shareText(stats, DEFAULT_SHARE, true, "https://example.com")).toBe(
      "mika.codes on InternQuest: Level 4 · 12 applications sent · 3-week streak. https://example.com",
    );
    expect(shareText(stats, { ...DEFAULT_SHARE, username: false }, true, "https://example.com")).toMatch(/^My InternQuest progress:/);
  });

  it("needs at least one thing on the card", () => {
    const none = { username: false, level: false, exp: false, applications: false, streak: false };
    expect(canShare(none, shareLines(stats, none, true))).toBe(false);
    expect(canShare({ ...none, username: true }, [])).toBe(true);
  });
});

describe("profile rules (onboarding and Profile > Edit)", () => {
  const ok: ProfileValues = {
    look: { skin: "#c98f62", hair: "#1b1410" },
    field: "iot",
    skills: ["c"],
    cityId: "quezon-city",
    workType: null,
    status: null,
    school: null,
  };

  it("accepts a complete profile, and an empty city", () => {
    expect(profileErrors(ok, "Quezon City")).toEqual({});
    expect(profileErrors({ ...ok, cityId: null }, "  ")).toEqual({});
  });

  it("needs a field and at least one skill, and rejects unknown places", () => {
    const e = profileErrors({ ...ok, field: null, skills: [] }, "Atlantis");
    expect(Object.keys(e).sort()).toEqual(["city", "field", "skills"]);
  });
});

describe("badges", () => {
  it("lists earned badges first and keeps the rest as locked", () => {
    const list = badgeList(["prepared"]);
    expect(list).toHaveLength(BADGES.length);
    expect(list[0]).toMatchObject({ id: "prepared", earned: true });
    expect(list.filter((b) => b.earned)).toHaveLength(1);
  });
});

describe("settings and account", () => {
  it("has sound off by default (SPEC §10)", () => {
    expect(DEFAULT_SETTINGS.sound).toBe(false);
    expect(DEFAULT_SETTINGS.mode).toBe("full");
  });

  it("only deletes when the username is typed (case and spaces forgiven)", () => {
    expect(canConfirmDelete(" Mika.Codes ", "mika.codes")).toBe(true);
    expect(canConfirmDelete("mika", "mika.codes")).toBe(false);
    expect(canConfirmDelete("", "")).toBe(false);
  });

  it("masks a recovery email", () => {
    expect(maskEmail("mika@gmail.com")).toBe("m•••@gmail.com");
    expect(maskEmail("not-an-email")).toBe("•••");
  });

  it("exports the user's data without passwords or codes", () => {
    const data = buildDataExport(
      {
        account: { username: "mika.codes", recovery: "codes" },
        profile: { skills: ["c"] },
        progress: { level: 4 },
        settings: DEFAULT_SETTINGS,
        questLog: [{ title: "IoT Firmware Intern" }],
      },
      new Date("2026-11-09T00:00:00Z"),
    );
    expect(data).toMatchObject({
      version: 1,
      exportedAt: "2026-11-09T00:00:00.000Z",
      account: { username: "mika.codes", recoveryMethod: "codes" },
      questLog: [{ title: "IoT Firmware Intern" }],
    });
    const json = JSON.stringify(data).toLowerCase();
    expect(json).not.toMatch(/password"|hash|"codes":/);
    expect(data.account).not.toHaveProperty("recoveryEmail");
  });

  it("includes the recovery email only when that's the method", () => {
    const data = buildDataExport(
      {
        account: { username: "a.b", recovery: "email", recoveryEmail: "a@b.co" },
        profile: {},
        progress: {},
        settings: DEFAULT_SETTINGS,
        questLog: [],
      },
      new Date(0),
    );
    expect(data.account).toMatchObject({ recoveryEmail: "a@b.co" });
  });
});
