import { describe, expect, it } from "vitest";
import { INTERNAL_EMAIL_DOMAIN, internalEmail, isInternalEmail } from "@/lib/auth/identity";
import { RATE_LIMITS, rateLimitBucket } from "@/lib/auth/limits";
import { generateRecoveryCodes, isRecoveryCode, isValidCodeSet, normalizeRecoveryCode } from "@/lib/auth/recovery";
import { isProtectedPath, loginRedirect, safeNext } from "@/lib/auth/routes";
import { hashRecoveryCode, networkKey, verifyRecoveryCode } from "@/lib/auth/secrets";
import { AGE_ERROR, CONSENT_ERROR, validateSignUp } from "@/lib/auth/signup";
import { RESERVED_USERNAMES, validateUsername } from "@/lib/auth/validation";

const GOOD = { username: "Mika.Codes", password: "ube halaya sundays", consent: true, ageOk: true };

describe("sign-up rules (checked again on the server)", () => {
  it("accepts a valid form and normalizes the username", () => {
    expect(validateSignUp(GOOD)).toEqual({ ok: true, username: "mika.codes", password: GOOD.password });
  });

  it("requires both the privacy consent and the age confirmation", () => {
    const r = validateSignUp({ ...GOOD, consent: false, ageOk: false });
    expect(r).toEqual({ ok: false, errors: { consent: CONSENT_ERROR, ageOk: AGE_ERROR } });
  });

  it("only counts a real `true` as a ticked box", () => {
    const sneaky = { ...GOOD, consent: "yes" as unknown as boolean, ageOk: 1 as unknown as boolean };
    const r = validateSignUp(sneaky);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["ageOk", "consent"]);
  });

  it("reports username and password problems together", () => {
    const r = validateSignUp({ ...GOOD, username: "a", password: "short" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.username).toMatch(/at least 3/);
      expect(r.errors.password).toMatch(/at least 10/);
    }
  });

  it("refuses a password that contains the username", () => {
    const r = validateSignUp({ ...GOOD, password: "mika.codes rocks 2026" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.password).toMatch(/username/);
  });

  it("refuses reserved names, same list as the database check", () => {
    for (const name of RESERVED_USERNAMES) expect(validateUsername(name).ok, name).toBe(false);
    expect(validateUsername("Admin").ok).toBe(false);
    expect(validateUsername("admin.ph").ok).toBe(true);
  });
});

describe("internal sign-in address", () => {
  it("maps a username to a private address that can't receive mail", () => {
    expect(internalEmail("  Mika.Codes ")).toBe(`mika.codes@${INTERNAL_EMAIL_DOMAIN}`);
    expect(INTERNAL_EMAIL_DOMAIN.endsWith(".invalid")).toBe(true);
    expect(isInternalEmail("MIKA.CODES@USERS.INTERNQUEST.INVALID")).toBe(true);
    expect(isInternalEmail("mika@gmail.com")).toBe(false);
  });
});

describe("protected pages and safe redirects", () => {
  it("guards the intern app screens only", () => {
    for (const p of ["/home", "/search", "/quest-log", "/tips", "/tips/resume", "/profile", "/settings", "/leaderboard"]) {
      expect(isProtectedPath(p), p).toBe(true);
    }
    for (const p of ["/", "/login", "/start", "/privacy", "/listings/ulap-python", "/companies", "/admin", "/homepage", "/tipsy"]) {
      expect(isProtectedPath(p), p).toBe(false);
    }
  });

  it("only allows same-site paths after login", () => {
    expect(safeNext("/quest-log?tab=applied")).toBe("/quest-log?tab=applied");
    expect(safeNext(null)).toBe("/home");
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/ok\n//evil", "home", "/login", "/login?next=/home"]) {
      expect(safeNext(bad), bad).toBe("/home");
    }
  });

  it("remembers where a signed-out visitor was going", () => {
    expect(loginRedirect("/quest-log", "?tab=interview")).toBe("/login?next=%2Fquest-log%3Ftab%3Dinterview");
    expect(loginRedirect("/home", "")).toBe("/login");
  });
});

describe("recovery codes", () => {
  it("accepts codes typed from paper in any case, with or without the dash", () => {
    expect(normalizeRecoveryCode(" k7qm 3xrp ")).toBe("K7QM3XRP");
    expect(isRecoveryCode("k7qm-3xrp")).toBe(true);
    expect(isRecoveryCode("K7QM3XR")).toBe(false); // too short
    expect(isRecoveryCode("K7QM-3XR0")).toBe(false); // 0 isn't in the alphabet
  });

  it("only saves a set of 8 distinct, well-formed codes", () => {
    const codes = generateRecoveryCodes();
    expect(isValidCodeSet(codes)).toBe(true);
    expect(isValidCodeSet(codes.slice(0, 7))).toBe(false);
    expect(isValidCodeSet([...codes.slice(0, 7), codes[0].toLowerCase()])).toBe(false); // duplicate
    expect(isValidCodeSet([...codes.slice(0, 7), "not-a-code"])).toBe(false);
    expect(isValidCodeSet("K7QM-3XRP")).toBe(false);
  });

  it("stores only a salted slow hash, and checks codes against it", async () => {
    const hash = await hashRecoveryCode("K7QM-3XRP");
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(hash).not.toContain("K7QM");
    expect(await verifyRecoveryCode("k7qm 3xrp", hash)).toBe(true);
    expect(await verifyRecoveryCode("K7QM-3XRQ", hash)).toBe(false);
    // Same code, different salt: the hashes differ.
    expect(await hashRecoveryCode("K7QM-3XRP")).not.toBe(hash);
  });

  it("rejects malformed stored hashes instead of crashing", async () => {
    expect(await verifyRecoveryCode("K7QM-3XRP", "plain-text")).toBe(false);
    expect(await verifyRecoveryCode("K7QM-3XRP", "scrypt$99999999$8$1$c2FsdA==$aGFzaA==")).toBe(false);
  });
});

describe("rate limits", () => {
  it("labels a network one way, so stored buckets don't reveal IP addresses", () => {
    const a = networkKey("203.0.113.7", "secret-1");
    expect(a).toBe(networkKey(" 203.0.113.7 ", "secret-1"));
    expect(a).not.toContain("203");
    expect(a).not.toBe(networkKey("203.0.113.7", "secret-2"));
    expect(a).not.toBe(networkKey("203.0.113.8", "secret-1"));
  });

  it("keeps the per-username login limit stricter than the shared-network one", () => {
    expect(RATE_LIMITS.login.max).toBeLessThan(RATE_LIMITS.loginNetwork.max);
    expect(RATE_LIMITS.recover.max).toBeLessThanOrEqual(5);
    for (const l of Object.values(RATE_LIMITS)) expect(l.windowSeconds).toBeLessThanOrEqual(86400); // the database cleans up after a day
    expect(rateLimitBucket("login", "x".repeat(300)).length).toBe(200);
  });
});
