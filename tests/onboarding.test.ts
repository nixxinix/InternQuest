import { describe, expect, it } from "vitest";
import { maxStep, newDraft } from "@/components/onboarding/draft";
import { RECOVERY_ALPHABET, generateRecoveryCodes, recoveryFileText } from "@/lib/auth/recovery";
import { isEmail, suggestUsernames, validatePassword, validateUsername } from "@/lib/auth/validation";
import { readPicks } from "@/lib/listings/picks";

describe("validateUsername", () => {
  it("accepts simple usernames and normalizes case and spaces", () => {
    expect(validateUsername("  Mika.Codes ")).toEqual({ ok: true, value: "mika.codes" });
    expect(validateUsername("juan_dela_cruz2").ok).toBe(true);
  });

  it.each([
    ["", "Pick a username."],
    ["ab", "Use at least 3 characters."],
    ["a".repeat(21), "Keep it to 20 characters or fewer."],
    ["mika codes", "Use only letters, numbers, dots, and underscores."],
    ["2fast", "Start with a letter."],
    ["mika.", "End with a letter or number."],
    ["mika..codes", "Don't put two dots or underscores in a row."],
  ])("rejects %j with a specific message", (input, message) => {
    const r = validateUsername(input);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toBe(message);
  });
});

describe("validatePassword", () => {
  it("needs 10 characters and counts down", () => {
    const r = validatePassword("short");
    expect(r).toMatchObject({ ok: false, strength: "too-short" });
    expect(r.error).toContain("5 more to go");
  });

  it("does not force symbols or digits (NIST)", () => {
    expect(validatePassword("mango shake time").ok).toBe(true);
  });

  it("blocks common passwords, the hint example, the username, and repeats", () => {
    expect(validatePassword("Password123").ok).toBe(false);
    expect(validatePassword("tita loves mango shakes").ok).toBe(false);
    expect(validatePassword("mika.codes-rocks", "mika.codes").ok).toBe(false);
    expect(validatePassword("aaaaaaaaaaaa").ok).toBe(false);
  });

  it("rates long or sentence-like passwords as strong", () => {
    expect(validatePassword("kape at pandesal").strength).toBe("strong");
    expect(validatePassword("bluejeepney7").strength).toBe("okay");
  });
});

describe("helpers", () => {
  it("recognises email addresses", () => {
    expect(isEmail("ana@school.edu.ph")).toBe(true);
    expect(isEmail("ana@school")).toBe(false);
    expect(isEmail("not an email")).toBe(false);
  });

  it("suggests free, valid usernames", () => {
    const taken = new Set(["mika.codes", "mika.codes2"]);
    const s = suggestUsernames("mika.codes", (u) => taken.has(u));
    expect(s).toEqual(["mika.codes3", "mika.codes4", "mika.codes5"]);
    expect(s.every((u) => validateUsername(u).ok)).toBe(true);
  });
});

describe("recovery codes", () => {
  it("makes 8 codes in XXXX-XXXX format from an unambiguous alphabet", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(8);
    for (const c of codes) {
      expect(c).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      expect(c.replace("-", "").split("").every((ch) => RECOVERY_ALPHABET.includes(ch))).toBe(true);
      expect(c).not.toMatch(/[01OIL]/);
    }
  });

  it("is deterministic with injected randomness", () => {
    const zeros = (n: number) => new Uint32Array(n);
    expect(generateRecoveryCodes(2, zeros)).toEqual(["AAAA-AAAA", "AAAA-AAAA"]);
  });

  it("writes a readable file", () => {
    const text = recoveryFileText("mika.codes", ["AAAA-BBBB"], new Date("2026-11-09T00:00:00Z"));
    expect(text).toContain("recovery codes for mika.codes");
    expect(text).toContain("Made on 2026-11-09");
    expect(text).toContain("1. AAAA-BBBB");
  });
});

describe("onboarding draft", () => {
  const picks = readPicks(new URLSearchParams("field=iot&skills=c,arduino&city=quezon-city"));

  it("starts from the visitor's picks", () => {
    const d = newDraft(picks);
    expect(d.field).toBe("iot");
    expect(d.skills).toEqual(["c", "arduino"]);
    expect(d.cityId).toBe("quezon-city");
    expect(d.mode).toBe("full");
  });

  it("never stores a password or recovery codes", () => {
    const keys = Object.keys(newDraft(picks));
    expect(keys.some((k) => /password|code/i.test(k))).toBe(false);
  });

  it("only unlocks steps in order (2 and 3 skippable, but passed through)", () => {
    const d = newDraft(picks);
    expect(maxStep(d)).toBe(1);
    expect(maxStep({ ...d, accountDone: true })).toBe(2);
    expect(maxStep({ ...d, accountDone: true, recovery: "skipped" })).toBe(3);
    expect(maxStep({ ...d, accountDone: true, recovery: "codes", styleDone: true })).toBe(4);
  });
});
