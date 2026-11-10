import { describe, expect, it } from "vitest";
import { CSV_TEMPLATE, parseAdminCsv, parseCsv, parseField, parseSkills, rowOutcome } from "@/lib/admin/csvImport";
import { RETENTION_DAYS, retentionLabel } from "@/lib/retention";

const TODAY = "2026-11-10";
const HEADER = "title,company,field,city,work_type,description,apply,deadline,allowance,hours,moa,skills";
const DESC = "Help the team clean and enter delivery data in spreadsheets every week.";
const row = (over: Partial<Record<string, string>> = {}) => {
  const base: Record<string, string> = {
    title: "Data Encoder Intern",
    company: "Kalye Logistics",
    field: "data",
    city: "Pasig",
    work_type: "onsite",
    description: DESC,
    apply: "https://kalye.example.com/careers",
    deadline: "2026-12-15",
    allowance: "",
    hours: "486",
    moa: "yes",
    skills: "Excel*; SQL",
    ...over,
  };
  return HEADER.split(",")
    .map((h) => `"${(base[h] ?? "").replace(/"/g, '""')}"`)
    .join(",");
};
const csv = (...rows: string[]) => [HEADER, ...rows].join("\r\n");

describe("parseCsv", () => {
  it("handles quotes, commas and newlines inside quotes, escaped quotes, CRLF, a BOM, and blank lines", () => {
    const text = '﻿a,b\r\n"x, y","say ""hi""\nthere"\r\n\r\n1,2\n';
    expect(parseCsv(text)).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"\nthere'],
      ["1", "2"],
    ]);
  });
});

describe("cell rules", () => {
  it("reads a field by id, label, or short label", () => {
    expect(parseField("data")).toBe("data");
    expect(parseField("Data & Analytics")).toBe("data");
    expect(parseField("  web & mobile  ")).toBe("web");
    expect(parseField("Astrology")).toBeNull();
  });

  it("reads skills by name, id, or alias, with * for required, and reports unknown ones", () => {
    const { skills, unknown } = parseSkills("Excel*; reactjs; Python ; Basket weaving; excel");
    expect(skills).toEqual([
      { id: "ms-excel", required: true },
      { id: "react", required: false },
      { id: "python", required: false },
    ]);
    expect(unknown).toEqual(["Basket weaving"]);
  });
});

describe("parseAdminCsv", () => {
  it("accepts the downloadable template as is, with no warnings", () => {
    const { rows, fileError } = parseAdminCsv(CSV_TEMPLATE, TODAY);
    expect(fileError).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].warnings).toEqual([]);
    expect(rows[0].listing).toMatchObject({ field: "data", workType: "onsite", moa: true, hours: 486, apply: { kind: "link" } });
  });

  it("maps a good row, with the city's location and a stable id", () => {
    const [r] = parseAdminCsv(csv(row()), TODAY).rows;
    expect(r.line).toBe(2);
    expect(r.listing).toMatchObject({ title: "Data Encoder Intern", company: "Kalye Logistics", area: "Pasig", deadline: "2026-12-15" });
    expect(r.listing?.lat).not.toBeNull();
    expect(r.listing?.id).toMatch(/^ad-kalye-logistics-data-encoder-intern-[0-9a-f]{6}$/);
    expect(parseAdminCsv(csv(row()), TODAY).rows[0].listing?.id).toBe(r.listing?.id);
  });

  it("refuses a file without the required columns, or too many rows", () => {
    expect(parseAdminCsv("title,company\nA,B", TODAY).fileError).toMatch(/Missing columns: field, city/);
    expect(parseAdminCsv(HEADER, TODAY).fileError).toMatch(/at least one listing/);
    expect(parseAdminCsv(csv(...Array.from({ length: 501 }, (_, i) => row({ title: `Intern ${i}` }))), TODAY).fileError).toMatch(/at most 500/);
  });

  it("lists every problem in a bad row, and imports none of it", () => {
    const [r] = parseAdminCsv(
      csv(row({ title: "X", field: "Astrology", work_type: "sometimes", description: "Short.", apply: "http://x.ph", deadline: "2020-01-01", hours: "lots", moa: "maybe" })),
      TODAY,
    ).rows;
    expect(r.listing).toBeNull();
    expect(r.errors).toHaveLength(8);
  });

  it("allows remote without a city, takes an email to apply, and only warns about an unknown city or skill", () => {
    const rows = parseAdminCsv(
      csv(
        row({ title: "Remote Data Intern", city: "", work_type: "remote", apply: "OJT@Kalye.example.com" }),
        row({ title: "Field Data Intern", city: "Tuguegarao", skills: "Basket weaving" }),
      ),
      TODAY,
    ).rows;
    expect(rows[0].listing).toMatchObject({ area: "Anywhere in the Philippines", lat: null, apply: { kind: "email", email: "ojt@kalye.example.com" } });
    expect(rows[1].errors).toEqual([]);
    expect(rows[1].warnings.join(" ")).toMatch(/isn't on our city list/);
    expect(rows[1].warnings.join(" ")).toMatch(/Basket weaving/);
  });

  it("refuses an onsite row without a city, and a repeat of an earlier row in the same file", () => {
    const rows = parseAdminCsv(csv(row({ city: "" }), row(), row({ company: "KALYE LOGISTICS" })), TODAY).rows;
    expect(rows[0].errors).toContain("Add a city (or set work type to remote).");
    expect(rows[1].errors).toEqual([]);
    expect(rows[2].errors).toEqual(["Same company, title, and city as an earlier row in this file."]);
  });
});

describe("rowOutcome (admin sits between a company's post and an aggregator copy)", () => {
  it("never touches a company's post, updates an earlier admin entry, and replaces an aggregator copy", () => {
    expect(rowOutcome(undefined)).toBe("new");
    expect(rowOutcome({ id: "d-1", source: "direct", dedupe_key: "k" })).toBe("company-post-wins");
    expect(rowOutcome({ id: "ad-1", source: "admin", dedupe_key: "k" })).toBe("update");
    expect(rowOutcome({ id: "js-1", source: "jsearch", dedupe_key: "k" })).toBe("replaces-aggregator");
  });
});

describe("retention", () => {
  it("labels periods for the privacy notice", () => {
    expect(retentionLabel(365)).toBe("12 months");
    expect(retentionLabel(730)).toBe("2 years");
    expect(retentionLabel(180)).toBe("6 months");
    expect(retentionLabel(10)).toBe("10 days");
  });

  it("keeps every period at least a week (the database refuses less) and clicks longer than the 14-day apply checks", () => {
    for (const days of Object.values(RETENTION_DAYS)) expect(days).toBeGreaterThanOrEqual(7);
    expect(RETENTION_DAYS.clicks).toBeGreaterThan(14);
  });
});
