import { describe, expect, it } from "vitest";
import { accountFromRows, viewerFromAccount, type ProfileRow } from "@/lib/account/account";
import {
  entryFromRow,
  fromManilaLocal,
  isAwaitingConfirm,
  manilaLocal,
  moveUpdate,
  summarize,
  validateDetails,
  type ApplicationRow,
} from "@/lib/tracker/rows";

const NOW = new Date("2026-11-10T04:00:00Z"); // noon, Nov 10, Manila
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

const ROW: ApplicationRow = {
  id: "0b8a3c1e-1111-4111-8111-111111111111",
  internship_id: "kalye-data-analyst",
  title: "Data Analyst OJT",
  company: "Kalye Logistics",
  url: null,
  status: "saved",
  outcome: null,
  applied_on: null,
  interview_at: null,
  interview_how: "",
  note: "",
  last_clicked_at: null,
  prompt_dismissed_at: null,
  confirmed_at: null,
  updated_at: hoursAgo(1),
};

describe("interview times (stored as timestamps, shown in Manila time)", () => {
  it("round-trips the form's Manila local time", () => {
    const stored = fromManilaLocal("2026-11-12T10:00");
    expect(stored).toBe("2026-11-12T02:00:00.000Z");
    expect(manilaLocal(stored!)).toBe("2026-11-12T10:00");
  });

  it("refuses anything that isn't a date and time", () => {
    for (const bad of ["2026-11-12", "tomorrow 10am", "2026-13-40T99:99", ""]) expect(fromManilaLocal(bad), bad).toBeNull();
  });
});

describe("'Did you apply?' waiting", () => {
  it("asks after an Apply click on a saved listing, for 14 days", () => {
    expect(isAwaitingConfirm({ ...ROW, last_clicked_at: hoursAgo(2) }, NOW)).toBe(true);
    expect(isAwaitingConfirm({ ...ROW, last_clicked_at: hoursAgo(15 * 24) }, NOW)).toBe(false);
    expect(isAwaitingConfirm(ROW, NOW)).toBe(false); // never clicked
  });

  it("stops after 'Not yet', until the next click", () => {
    const dismissed = { ...ROW, last_clicked_at: hoursAgo(5), prompt_dismissed_at: hoursAgo(4) };
    expect(isAwaitingConfirm(dismissed, NOW)).toBe(false);
    expect(isAwaitingConfirm({ ...dismissed, last_clicked_at: hoursAgo(1) }, NOW)).toBe(true);
  });

  it("never asks about confirmed, moved, or hand-added entries", () => {
    const clicked = { ...ROW, last_clicked_at: hoursAgo(1) };
    expect(isAwaitingConfirm({ ...clicked, confirmed_at: hoursAgo(1) }, NOW)).toBe(false);
    expect(isAwaitingConfirm({ ...clicked, status: "applied" }, NOW)).toBe(false);
    expect(isAwaitingConfirm({ ...clicked, internship_id: null }, NOW)).toBe(false);
  });
});

describe("rows to quest log entries", () => {
  it("maps a row, dropping an outcome outside Result and a link on listing entries", () => {
    const e = entryFromRow(
      { ...ROW, status: "interview", outcome: "offer", applied_on: "2026-11-03", interview_at: "2026-11-12T02:00:00Z", url: "https://x.ph" },
      NOW,
    );
    expect(e).toMatchObject({ status: "interview", outcome: null, appliedOn: "2026-11-03", interviewAt: "2026-11-12T10:00", url: null, rewarded: [] });
  });

  it("summarizes what Home needs: the newest waiting listing, confirmed count, upcoming interviews", () => {
    const rows: ApplicationRow[] = [
      { ...ROW, id: "a", internship_id: "older", last_clicked_at: hoursAgo(30) },
      { ...ROW, id: "b", internship_id: "newer", last_clicked_at: hoursAgo(3) },
      { ...ROW, id: "c", internship_id: "done", status: "applied", confirmed_at: hoursAgo(50) },
      { ...ROW, id: "d", internship_id: "iv", status: "interview", interview_at: "2026-11-12T02:00:00Z", interview_how: "Google Meet" },
      { ...ROW, id: "e", internship_id: "past", status: "interview", interview_at: "2026-11-01T02:00:00Z" },
    ];
    const s = summarize(rows, NOW);
    expect(s.pendingConfirm).toBe("newer");
    expect(s.confirmedCount).toBe(1);
    expect(s.upcoming).toEqual([{ listingId: "iv", company: "Kalye Logistics", what: "Interview", when: "Thu, Nov 12 · 10:00 AM", how: "Google Meet" }]);
  });

  it("feeds the screens: saved, applied, waiting, and confirmed come from the log", () => {
    const profile: ProfileRow = {
      id: "u",
      username: "mika.codes",
      field_id: "data",
      city_name: null,
      lat: null,
      lng: null,
      radius_km: 25,
      work_type: null,
      status: null,
      school_id: null,
      avatar_skin: "#c98f62",
      avatar_hair: "#1b1410",
      onboarded_at: hoursAgo(100),
      created_at: hoursAgo(100),
    };
    const rows: ApplicationRow[] = [
      { ...ROW, id: "a", internship_id: "s1" },
      { ...ROW, id: "b", internship_id: "s2", last_clicked_at: hoursAgo(1) },
      { ...ROW, id: "c", internship_id: "a1", status: "applied", confirmed_at: hoursAgo(5) },
      { ...ROW, id: "d", internship_id: null, title: "Outside job", status: "applied" },
    ];
    const v = viewerFromAccount(accountFromRows(profile, ["sql"], null, null, rows, NOW));
    expect(v.saved).toEqual(["s1", "s2"]);
    expect(v.applied).toEqual(["a1"]);
    expect(v.pendingConfirm).toBe("s2");
    expect(v.applicationsTotal).toBe(1);
    expect(v.tutorial).toMatchObject({ saved: true, applied: true });
  });
});

describe("server checks for quest log changes", () => {
  it("moves keep the first applied date and allow an outcome only in Result", () => {
    expect(moveUpdate({ status: "saved", applied_on: null }, "applied", null, "2026-11-10")).toEqual({
      status: "applied",
      outcome: null,
      applied_on: "2026-11-10",
    });
    expect(moveUpdate({ status: "interview", applied_on: "2026-11-01" }, "result", "offer", "2026-11-10")).toEqual({
      status: "result",
      outcome: "offer",
      applied_on: "2026-11-01",
    });
    expect(moveUpdate({ status: "applied", applied_on: "2026-11-01" }, "interview", "offer", "2026-11-10")).toMatchObject({ outcome: null });
  });

  it("refuses unknown columns and outcomes", () => {
    expect(moveUpdate({ status: "saved", applied_on: null }, "hired", null, "2026-11-10")).toMatch(/column/);
    expect(moveUpdate({ status: "saved", applied_on: null }, "result", "ghosted", "2026-11-10")).toMatch(/result/);
  });

  it("checks notes and interview details", () => {
    expect(validateDetails({ note: " Bring ID ", interviewAt: "2026-11-12T10:00", interviewHow: "Onsite" })).toEqual({
      note: "Bring ID",
      interview_at: "2026-11-12T02:00:00.000Z",
      interview_how: "Onsite",
    });
    expect(validateDetails({ note: "", interviewAt: null, interviewHow: "" })).toEqual({ note: "", interview_at: null, interview_how: "" });
    expect(validateDetails({ note: "x".repeat(1001), interviewAt: null, interviewHow: "" })).toMatch(/under 1000/);
    expect(validateDetails({ note: "", interviewAt: "next week", interviewHow: "" })).toMatch(/date and time/);
    expect(validateDetails(null)).toMatch(/missing/);
  });
});
