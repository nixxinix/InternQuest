import { describe, expect, it } from "vitest";
import { companyRowToItem, flagRowToItem, groupReportsForListing, type FlagRow, type ReportRow } from "@/lib/admin/rows";
import { flagItemRowId, reportItemInternshipId } from "@/lib/admin/queue";
import { draftToRow, publishErrors, rowToDraft, type CompanyRow } from "@/lib/company/account";
import { isPrivateHost } from "@/lib/company/verify";
import { SAMPLE_EDIT_DRAFT } from "@/lib/sample/company";

const NOW = new Date("2026-11-10T04:00:00Z");
const TODAY = "2026-11-10";

describe("isPrivateHost (SSRF guard for the website check)", () => {
  it("blocks loopback, private ranges, link-local/cloud metadata, and .local", () => {
    for (const h of ["localhost", "127.0.0.1", "0.0.0.0", "10.0.0.5", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "intranet.local", "box.internal"]) {
      expect(isPrivateHost(h), h).toBe(true);
    }
  });

  it("allows ordinary public hostnames, including ones that merely start with a private prefix", () => {
    for (const h of ["tanglaw.ph", "www.example.com", "172.32.0.1", "10.example.com"]) expect(isPrivateHost(h), h).toBe(false);
  });
});

describe("draftToRow / rowToDraft (a draft only needs a title)", () => {
  it("accepts a title-only draft, with every other column left null", () => {
    const row = draftToRow({ ...SAMPLE_EDIT_DRAFT, field: "", description: "", skills: [], city: "", area: "", workType: "", apply: { kind: "link", url: "" } }, TODAY);
    expect(typeof row).not.toBe("string");
    if (typeof row === "string") return;
    expect(row).toMatchObject({ title: "IoT Firmware Intern", field_id: null, snippet: null, work_type: null, apply_kind: null });
  });

  it("refuses a title under 3 characters, even for a draft", () => {
    expect(draftToRow({ ...SAMPLE_EDIT_DRAFT, title: "Hi" }, TODAY)).toMatch(/at least 3/);
  });

  it("round-trips a full draft through the database shape", () => {
    const row = draftToRow(SAMPLE_EDIT_DRAFT, TODAY);
    expect(typeof row).not.toBe("string");
    if (typeof row === "string") return;
    const back = rowToDraft({ ...row, title: SAMPLE_EDIT_DRAFT.title, moa: row.moa, internship_skills: SAMPLE_EDIT_DRAFT.skills.map((s) => ({ skill_id: s.id, required: s.required })) });
    expect(back).toMatchObject({
      title: SAMPLE_EDIT_DRAFT.title,
      field: SAMPLE_EDIT_DRAFT.field,
      workType: SAMPLE_EDIT_DRAFT.workType,
      moa: SAMPLE_EDIT_DRAFT.moa,
      apply: SAMPLE_EDIT_DRAFT.apply,
    });
    expect(new Set(back.skills.map((s) => s.id))).toEqual(new Set(SAMPLE_EDIT_DRAFT.skills.map((s) => s.id)));
  });

  it("stores the city dropdown's own text as area when no separate area was typed", () => {
    const row = draftToRow({ ...SAMPLE_EDIT_DRAFT, city: "Quezon City", area: "" }, TODAY);
    expect(typeof row).not.toBe("string");
    if (typeof row !== "string") expect(row.area).toBe("Quezon City");
  });

  it("refuses an http apply link and an application email on the wrong domain isn't caught here (that's publishErrors)", () => {
    expect(draftToRow({ ...SAMPLE_EDIT_DRAFT, apply: { kind: "link", url: "http://x.ph" } }, TODAY)).toMatch(/https:\/\//);
  });
});

describe("publishErrors (the real gate, checked against the stored row)", () => {
  const COMPANY_EMAIL = "hr@tanglaw.example.com";
  const complete = {
    title: "IoT Firmware Intern",
    field_id: "iot",
    snippet: "x".repeat(60),
    area: "Cubao, Quezon City",
    work_type: "onsite",
    apply_kind: "link" as const,
    apply_url: "https://tanglaw.example.com/apply",
    apply_email: null,
  };

  it("accepts a complete listing", () => {
    expect(publishErrors(complete, COMPANY_EMAIL)).toEqual([]);
  });

  it("lists everything missing, same rules whether it came from a draft or a tampered request", () => {
    const errors = publishErrors(
      { title: "Hi", field_id: null, snippet: "too short", area: null, work_type: "onsite", apply_kind: null, apply_url: null, apply_email: null },
      COMPANY_EMAIL,
    );
    expect(errors.length).toBeGreaterThanOrEqual(5);
  });

  it("allows remote without a city, but not onsite", () => {
    expect(publishErrors({ ...complete, work_type: "remote", area: null }, COMPANY_EMAIL)).toEqual([]);
    expect(publishErrors({ ...complete, area: null }, COMPANY_EMAIL)).toEqual(["Add a city."]);
  });

  it("only allows an application email on the company's own domain", () => {
    expect(publishErrors({ ...complete, apply_kind: "email", apply_url: null, apply_email: "hr@gmail.com" }, COMPANY_EMAIL)[0]).toMatch(/@tanglaw\.example\.com/);
    expect(publishErrors({ ...complete, apply_kind: "email", apply_url: null, apply_email: "ojt@tanglaw.example.com" }, COMPANY_EMAIL)).toEqual([]);
  });
});

describe("admin queue rows", () => {
  const COMPANY_ROW: CompanyRow = {
    id: "c1",
    name: "Tanglaw Solar Systems",
    website: "https://tanglaw.example.com",
    work_email: "hr@tanglaw.example.com",
    role: "HR Officer",
    registration_no: null,
    status: "pending",
    reject_reason: null,
    email_confirmed: true,
    website_loads: true,
    website_checked_at: null,
    created_at: "2026-11-10T02:00:00Z",
  };

  it("maps a company row, with hours-ago from its submission time", () => {
    const item = companyRowToItem(COMPANY_ROW, 2, NOW);
    expect(item).toMatchObject({ kind: "company", name: "Tanglaw Solar Systems", email: "hr@tanglaw.example.com", draftListings: 2, submittedHoursAgo: 2 });
  });

  it("groups open reports for one listing by reason, with the oldest setting the age", () => {
    const rows: ReportRow[] = [
      { id: 1, internship_id: "x", reason: "payment", note: "They asked for a fee.", created_at: "2026-11-10T00:00:00Z" },
      { id: 2, internship_id: "x", reason: "payment", note: null, created_at: "2026-11-10T02:00:00Z" },
      { id: 3, internship_id: "x", reason: "scam", note: "  ", created_at: "2026-11-10T03:00:00Z" },
    ];
    const item = groupReportsForListing("x", rows, { title: "Data Encoder", company: "EasyOJT", snippet: "Pay to start." }, NOW);
    expect(item).toMatchObject({ kind: "report", listingTitle: "Data Encoder", submittedHoursAgo: 4 });
    expect(item.kind === "report" && item.reasons).toEqual([
      { reason: "payment", count: 2 },
      { reason: "scam", count: 1 },
    ]);
    expect(item.kind === "report" && item.notes).toEqual(["They asked for a fee."]);
  });

  it("builds a flag's detail from its window, in Manila time, and leaves it generic without one", () => {
    const row: FlagRow = { id: 7, user_id: "u1", reason: "11 confirmed applications within one hour", created_at: NOW.toISOString(), window_start: "2026-11-10T01:00:00Z", window_end: "2026-11-10T02:00:00Z" };
    const item = flagRowToItem(row, "speedy.apply", 220, NOW);
    expect(item).toMatchObject({ kind: "flag", username: "speedy.apply", expAtStake: 220 });
    expect(item.kind === "flag" && item.detail).toMatch(/9:00 AM and 10:00 AM/);
    const noWindow = flagRowToItem({ ...row, window_start: null, window_end: null }, "speedy.apply", 0, NOW);
    expect(noWindow.kind === "flag" && noWindow.detail).toMatch(/weren't recorded/);
  });

  it("parses the r-/f- id prefixes used to keep ids unique across kinds", () => {
    expect(reportItemInternshipId("r-ulap-python")).toBe("ulap-python");
    expect(reportItemInternshipId("f-9")).toBeNull();
    expect(flagItemRowId("f-9")).toBe(9);
    expect(flagItemRowId("f-0")).toBeNull();
    expect(flagItemRowId("c-abc")).toBeNull();
  });
});
