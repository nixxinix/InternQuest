import { describe, expect, it } from "vitest";
import { daysBetween, isClosed, listingFromRow, type ListingRow } from "@/lib/listings/listing";

const NOW = new Date("2026-11-09T04:00:00Z"); // noon in Manila
const TODAY = "2026-11-09";

const ROW: ListingRow = {
  id: "kalye-data-analyst",
  title: "Data Analyst OJT",
  company_name: "Kalye Logistics",
  verified: true,
  source: "admin",
  field_id: "data",
  area: "Ortigas, Pasig",
  lat: "14.58690",
  lng: "121.06140",
  work_type: "onsite",
  allowance: "₱400/day",
  hours: 600,
  moa: true,
  deadline: "2026-11-12",
  posted_at: "2026-10-30T04:00:00Z",
  snippet: "Clean delivery data.",
  apply_kind: "link",
  apply_url: "https://example.com/jobs/kalye-data-analyst",
  apply_email: null,
  is_active: true,
  internship_skills: [
    { skill_id: "python", required: false },
    { skill_id: "ms-excel", required: true },
    { skill_id: "not-a-skill", required: true },
  ],
};

describe("listings from the database", () => {
  it("maps a row to the shape every screen uses", () => {
    expect(listingFromRow(ROW, TODAY, NOW)).toEqual({
      id: "kalye-data-analyst",
      title: "Data Analyst OJT",
      company: "Kalye Logistics",
      verified: true,
      area: "Ortigas, Pasig",
      location: { lat: 14.5869, lng: 121.0614 },
      workType: "onsite",
      field: "data",
      allowance: "₱400/day",
      hours: 600,
      moa: true,
      source: "admin",
      deadlineInDays: 3,
      postedDaysAgo: 10,
      // Required first; unknown skills dropped.
      skills: [
        { id: "ms-excel", required: true },
        { id: "python", required: false },
      ],
      snippet: "Clean delivery data.",
      apply: { kind: "link", url: "https://example.com/jobs/kalye-data-analyst" },
    });
  });

  it("counts deadline days in Manila calendar days", () => {
    expect(daysBetween("2026-11-09", "2026-11-09")).toBe(0);
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
    expect(daysBetween("2026-11-09", "2026-11-08")).toBe(-1);
  });

  it("marks inactive and past-deadline listings closed", () => {
    expect(isClosed(listingFromRow({ ...ROW, is_active: false }, TODAY, NOW)!)).toBe(true);
    expect(isClosed(listingFromRow({ ...ROW, is_active: false, deadline: null }, TODAY, NOW)!)).toBe(true);
    expect(isClosed(listingFromRow({ ...ROW, deadline: "2026-11-08" }, TODAY, NOW)!)).toBe(true);
    expect(isClosed(listingFromRow({ ...ROW, deadline: TODAY }, TODAY, NOW)!)).toBe(false);
  });

  it("keeps remote listings without a location, and email applications", () => {
    const l = listingFromRow(
      { ...ROW, lat: null, lng: null, work_type: "remote", apply_kind: "email", apply_url: null, apply_email: "hr@kalye.example.com" },
      TODAY,
      NOW,
    );
    expect(l?.location).toBeNull();
    expect(l?.apply).toEqual({ kind: "email", email: "hr@kalye.example.com" });
  });

  it("skips rows it can't show safely", () => {
    expect(listingFromRow({ ...ROW, apply_url: "http://example.com/x" }, TODAY, NOW)).toBeNull();
    expect(listingFromRow({ ...ROW, apply_kind: "email", apply_url: null, apply_email: null }, TODAY, NOW)).toBeNull();
    expect(listingFromRow({ ...ROW, field_id: "astrology" }, TODAY, NOW)).toBeNull();
    expect(listingFromRow({ ...ROW, source: "scraped" }, TODAY, NOW)).toBeNull();
  });
});
