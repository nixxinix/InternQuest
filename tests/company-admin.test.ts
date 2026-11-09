import { describe, expect, it } from "vitest";
import { ACTIONS, DecisionError, decide, isAutoHidden, maxConfirmsInWindow, nextItem, shouldFlag, type ReportItem } from "@/lib/admin/queue";
import { domainMatchesWebsite, emailDomain, isFreeEmail, validateRegistration, websiteHost } from "@/lib/company/email";
import { EMPTY_DRAFT, draftPreview, postingChecklist, validatePosting, type PostingDraft } from "@/lib/company/posting";
import { SAMPLE_EDIT_DRAFT, SAMPLE_QUEUE } from "@/lib/sample/company";

const TODAY = "2026-11-09";
const COMPANY_EMAIL = "hr@tanglaw.example.com";

describe("company email rules (SPEC §12)", () => {
  it("blocks free email providers, case-insensitively", () => {
    expect(isFreeEmail("Owner@GMAIL.com")).toBe(true);
    expect(isFreeEmail("hr@yahoo.com.ph")).toBe(true);
    expect(isFreeEmail("hr@tanglaw.ph")).toBe(false);
    expect(emailDomain("not an email")).toBeNull();
  });

  it("matches an email's domain to the website, including www and subdomains", () => {
    expect(websiteHost("www.Tanglaw.ph/about")).toBe("tanglaw.ph");
    expect(websiteHost("javascript:alert(1)")).toBeNull();
    expect(domainMatchesWebsite("hr@tanglaw.ph", "https://www.tanglaw.ph")).toBe(true);
    expect(domainMatchesWebsite("hr@mail.tanglaw.ph", "tanglaw.ph")).toBe(true);
    expect(domainMatchesWebsite("admin@brightfuture-jobs.net", "https://brightfuture.org")).toBe(false);
  });

  it("explains the free-email block in one plain sentence", () => {
    const e = validateRegistration({ companyName: "Kape", website: "kape.ph", email: "kape@gmail.com", role: "Owner", registrationNo: "", consent: true });
    expect(e).toEqual({ email: "We need an email on your company's own domain to verify you." });
  });

  it("needs a name, a website, a role, and consent", () => {
    const e = validateRegistration({ companyName: "", website: "nope", email: "hr@x.ph", role: " ", registrationNo: "", consent: false });
    expect(Object.keys(e).sort()).toEqual(["companyName", "consent", "role", "website"]);
  });
});

describe("posting form rules", () => {
  const ok: PostingDraft = { ...SAMPLE_EDIT_DRAFT, deadline: "2026-11-20" };

  it("accepts the sample listing", () => {
    expect(validatePosting(ok, TODAY, COMPANY_EMAIL)).toEqual({});
  });

  it("flags everything missing on an empty draft", () => {
    const e = validatePosting(EMPTY_DRAFT, TODAY, COMPANY_EMAIL);
    expect(Object.keys(e).sort()).toEqual(["allowance", "apply", "description", "field", "skills", "title", "workType"]);
  });

  it("needs a required skill, and a city unless it's remote", () => {
    expect(validatePosting({ ...ok, skills: [{ id: "c", required: false }] }, TODAY, COMPANY_EMAIL).skills).toBeDefined();
    expect(validatePosting({ ...ok, city: "Atlantis" }, TODAY, COMPANY_EMAIL).city).toBeDefined();
    expect(validatePosting({ ...ok, city: "", workType: "remote" }, TODAY, COMPANY_EMAIL).city).toBeUndefined();
  });

  it("allows an explicit Unpaid, but not an empty amount", () => {
    expect(validatePosting({ ...ok, allowance: { kind: "unpaid" } }, TODAY, COMPANY_EMAIL).allowance).toBeUndefined();
    expect(validatePosting({ ...ok, allowance: { kind: "amount", text: " " } }, TODAY, COMPANY_EMAIL).allowance).toBeDefined();
  });

  it("checks dates: no past deadline, nothing beyond 6 months, start after the deadline", () => {
    expect(validatePosting({ ...ok, deadline: "2026-11-01" }, TODAY, COMPANY_EMAIL).deadline).toBeDefined();
    expect(validatePosting({ ...ok, deadline: "2027-08-01" }, TODAY, COMPANY_EMAIL).deadline).toBeDefined();
    expect(validatePosting({ ...ok, startDate: "2026-11-15" }, TODAY, COMPANY_EMAIL).startDate).toBeDefined();
  });

  it("only takes https apply links, and application emails on the company's own domain", () => {
    expect(validatePosting({ ...ok, apply: { kind: "link", url: "http://x.ph/apply" } }, TODAY, COMPANY_EMAIL).apply).toBeDefined();
    expect(validatePosting({ ...ok, apply: { kind: "link", url: "https://tanglaw.example.com/jobs" } }, TODAY, COMPANY_EMAIL).apply).toBeUndefined();
    expect(validatePosting({ ...ok, apply: { kind: "email", email: "tanglaw.hiring@gmail.com" } }, TODAY, COMPANY_EMAIL).apply).toMatch(
      /@tanglaw\.example\.com/,
    );
  });

  it("checks hours are a sensible whole number", () => {
    expect(validatePosting({ ...ok, hours: "486.5" }, TODAY, COMPANY_EMAIL).hours).toBeDefined();
    expect(validatePosting({ ...ok, hours: "" }, TODAY, COMPANY_EMAIL).hours).toBeUndefined();
  });

  it("builds the preview card with a typical-applicant match", () => {
    const card = draftPreview(ok, "Tanglaw Solar Systems", true, TODAY);
    expect(card).toMatchObject({ title: "IoT Firmware Intern", area: "Cubao, Quezon City", deadlineText: "11 days left", source: "direct" });
    // Has every required skill, none of the nice-to-haves.
    expect(card.match?.missing).toEqual([]);
    expect(card.match?.missingNice).toEqual(["Soldering", "MQTT"]);
    expect(draftPreview({ ...ok, deadline: "2026-11-14" }, "T", false, TODAY).deadlineText).toBe("5 days left");
  });

  it("lists progress in plain words", () => {
    const list = postingChecklist(EMPTY_DRAFT, validatePosting(EMPTY_DRAFT, TODAY, COMPANY_EMAIL));
    expect(list.every((i) => !i.done)).toBe(true);
    expect(postingChecklist(ok, {}).every((i) => i.done)).toBe(true);
  });
});

describe("admin queue (every action needs a reason and is logged)", () => {
  const now = new Date("2026-11-09T04:00:00Z");

  it("removes the decided item and writes an audit entry", () => {
    const r = decide(SAMPLE_QUEUE, "c-tanglaw", "approve", "All checks passed", "owner", now);
    expect(r.queue.find((q) => q.id === "c-tanglaw")).toBeUndefined();
    expect(r.entry).toEqual({
      at: "2026-11-09T04:00:00.000Z",
      admin: "owner",
      kind: "company",
      itemId: "c-tanglaw",
      subject: "Tanglaw Solar Systems",
      action: "Approve",
      reason: "All checks passed",
    });
  });

  it("refuses a missing reason, an unknown action, or an item already decided", () => {
    expect(() => decide(SAMPLE_QUEUE, "c-tanglaw", "approve", "  ", "owner", now)).toThrow(DecisionError);
    expect(() => decide(SAMPLE_QUEUE, "c-tanglaw", "hide", "x", "owner", now)).toThrow(/Unknown action/);
    expect(() => decide(SAMPLE_QUEUE, "gone", "approve", "x", "owner", now)).toThrow(/already decided/);
  });

  it("gives every action at least one reason to pick", () => {
    for (const list of Object.values(ACTIONS)) for (const a of list) expect(a.reasons.length).toBeGreaterThan(0);
  });

  it("opens the next item in the same tab", () => {
    const after = decide(SAMPLE_QUEUE, "c-tanglaw", "approve", "ok", "owner", now).queue;
    expect(nextItem(after, "company", 0)?.id).toBe("c-kalye");
    expect(nextItem(after.filter((q) => q.kind !== "flag"), "flag", 0)).toBeNull();
  });

  it("hides a listing automatically at 3 or more 'asks for payment' reports", () => {
    const report = SAMPLE_QUEUE.find((q) => q.id === "r-easyojt") as ReportItem;
    expect(isAutoHidden(report)).toBe(true);
    expect(isAutoHidden({ ...report, reasons: [{ reason: "payment", count: 2 }, { reason: "scam", count: 5 }] })).toBe(false);
  });

  it("flags bursts of confirmations inside one hour, not the same number spread out", () => {
    const min = 60_000;
    const burst = Array.from({ length: 12 }, (_, i) => i * 4 * min); // 12 in 44 minutes
    const spread = Array.from({ length: 12 }, (_, i) => i * 30 * min); // 12 over 5.5 hours
    expect(maxConfirmsInWindow(burst)).toBe(12);
    expect(shouldFlag(burst)).toBe(true);
    expect(maxConfirmsInWindow(spread)).toBe(2);
    expect(shouldFlag(spread)).toBe(false);
  });
});
