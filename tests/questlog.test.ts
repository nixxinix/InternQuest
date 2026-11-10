import { describe, expect, it } from "vitest";
import { sampleQuestLog } from "@/lib/sample/questlog";
import {
  addDays,
  confirmEntry,
  defaultTab,
  entryDateText,
  expForConfirm,
  expForMove,
  externalEntry,
  groupByStatus,
  interviewText,
  isSafeUrl,
  manilaDate,
  moveEntry,
  sortColumn,
  validateExternal,
  type ExternalDraft,
  type LogEntry,
} from "@/lib/tracker/log";

const TODAY = "2026-11-09";
const log = sampleQuestLog(TODAY);
const byId = (id: string) => log.find((e) => e.id === id)!;
const saved = byId("e-kanto-social-media");

describe("dates (Asia/Manila)", () => {
  it("uses Manila's date, not the server's", () => {
    // 17:30 UTC is already 1:30 AM the next day in Manila.
    expect(manilaDate(new Date("2026-11-09T17:30:00Z"))).toBe("2026-11-10");
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  });

  it("formats interviews and applied dates in plain words", () => {
    expect(interviewText("2026-11-12T10:00")).toBe("Thu, Nov 12 · 10:00 AM");
    expect(interviewText("not a date")).toBe("");
    const applied = moveEntry(saved, "applied", null, TODAY);
    expect(entryDateText(applied, TODAY)).toBe("Applied today");
    expect(entryDateText({ ...applied, appliedOn: "2026-11-08" }, TODAY)).toBe("Applied yesterday");
    expect(entryDateText({ ...applied, appliedOn: "2026-11-03" }, TODAY)).toBe("Applied Nov 3");
    expect(entryDateText(saved, TODAY)).toBeNull();
  });
});

describe("moving cards", () => {
  it("sets the applied date once and keeps it", () => {
    const applied = moveEntry(saved, "applied", null, TODAY);
    expect(applied.appliedOn).toBe(TODAY);
    const later = moveEntry(applied, "interview", null, "2026-11-20");
    expect(later.appliedOn).toBe(TODAY);
  });

  it("keeps an outcome only in Result", () => {
    const result = moveEntry(saved, "result", "offer", TODAY);
    expect(result.outcome).toBe("offer");
    expect(moveEntry(result, "interview", "offer", TODAY).outcome).toBeNull();
  });

  it("clears 'Did you apply?' once confirmed", () => {
    const pending = byId("e-tanglaw-iot-firmware");
    expect(pending.awaitingConfirm).toBe(true);
    const done = confirmEntry(pending, TODAY);
    expect(done).toMatchObject({ status: "applied", appliedOn: TODAY, awaitingConfirm: false });
  });
});

describe("EXP preview for quest log moves (server decides; SPEC §10)", () => {
  it("gives +5 for moving forward", () => {
    expect(expForMove(saved, "applied", null)).toEqual({ amount: 5, key: "applied" });
    expect(expForMove(byId("e-bayanihan-qa"), "interview", null)).toEqual({ amount: 5, key: "interview" });
  });

  it("gives +10 for logging an offer or a rejection, +5 for other results", () => {
    const a = byId("e-bayanihan-qa");
    expect(expForMove(a, "result", "offer")?.amount).toBe(10);
    expect(expForMove(a, "result", "not_selected")?.amount).toBe(10);
    expect(expForMove(a, "result", "no_reply")?.amount).toBe(5);
  });

  it("gives nothing for moving back, for a step already rewarded, or for entries added by hand", () => {
    const interview = byId("e-ilaw-embedded");
    expect(expForMove(interview, "applied", null)).toBeNull();
    expect(expForMove(interview, "saved", null)).toBeNull();
    expect(expForMove({ ...interview, status: "applied" }, "interview", null)).toBeNull(); // already earned
    expect(expForMove(byId("e-habi"), "interview", null)).toBeNull();
  });

  it("gives +20 for the first 3 confirmations a day, then +5, and only once per entry", () => {
    const pending = byId("e-tanglaw-iot-firmware");
    expect(expForConfirm(pending, 0)?.amount).toBe(20);
    expect(expForConfirm(pending, 2)?.amount).toBe(20);
    expect(expForConfirm(pending, 3)?.amount).toBe(5);
    expect(expForConfirm({ ...pending, rewarded: ["confirm"] }, 0)).toBeNull();
  });
});

describe("columns", () => {
  it("groups by status", () => {
    const g = groupByStatus(log);
    expect(g.saved).toHaveLength(4);
    expect(g.applied).toHaveLength(2);
    expect(g.interview).toHaveLength(1);
    expect(g.result).toHaveLength(2);
  });

  it("puts the most urgent card first", () => {
    const deadlines: Record<string, number | null> = {
      "e-kanto-social-media": 2,
      "e-kalye-data-analyst": 3,
      "e-sari-ux-design": 12,
      "e-tanglaw-iot-firmware": 5,
    };
    const order = sortColumn("saved", groupByStatus(log).saved, (e) => deadlines[e.id] ?? null).map((e) => e.id);
    expect(order).toEqual(["e-tanglaw-iot-firmware", "e-kanto-social-media", "e-kalye-data-analyst", "e-sari-ux-design"]);
    // Applied: oldest first, since those are due a follow-up.
    expect(sortColumn("applied", groupByStatus(log).applied, () => null).map((e) => e.id)).toEqual(["e-habi", "e-bayanihan-qa"]);
  });

  it("opens the tab with the most urgent next step", () => {
    expect(defaultTab(log)).toBe("saved");
    const noPending = log.map((e) => ({ ...e, awaitingConfirm: false }));
    expect(defaultTab(noPending)).toBe("interview");
    expect(defaultTab([])).toBe("saved");
  });
});

describe("adding one applied to elsewhere", () => {
  const draft: ExternalDraft = { title: "Admin OJT", company: "City Hall", url: "", status: "applied", appliedOn: "" };

  it("needs a role and a company", () => {
    expect(validateExternal({ ...draft, title: " ", company: "" }, TODAY)).toMatchObject({
      title: expect.any(String),
      company: expect.any(String),
    });
    expect(validateExternal(draft, TODAY)).toEqual({});
  });

  it("only accepts http and https links", () => {
    expect(isSafeUrl("https://example.com/job")).toBe(true);
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("example.com")).toBe(false);
    expect(validateExternal({ ...draft, url: "javascript:alert(1)" }, TODAY).url).toBeDefined();
  });

  it("rejects an applied date in the future", () => {
    expect(validateExternal({ ...draft, appliedOn: "2026-12-01" }, TODAY).appliedOn).toBeDefined();
  });

  it("creates a tracking-only entry with no listing and no EXP", () => {
    const e: LogEntry = externalEntry({ ...draft, title: "  Admin OJT " }, "x1", TODAY);
    expect(e).toMatchObject({ listingId: null, title: "Admin OJT", appliedOn: TODAY, url: null });
    expect(expForMove(e, "interview", null)).toBeNull();
  });
});
