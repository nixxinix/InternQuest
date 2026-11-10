import { describe, expect, it } from "vitest";
import { cronAuthorized } from "@/lib/aggregator/cron";
import { jsearchUrl, parseJsearch } from "@/lib/aggregator/jsearch";
import { SNIPPET_MAX, findSkills, inferField, isInternship, listingId, makeSnippet, safeApplyUrl } from "@/lib/aggregator/normalize";
import { planImport } from "@/lib/aggregator/plan";
import type { ImportedListing } from "@/lib/aggregator/types";
import { dedupeKey } from "@/lib/listings/dedupe";

const NOW = new Date("2026-11-10T04:00:00Z");
const LONG = `<p>We are looking for a <b>Data Analyst Intern</b> to join our operations team in Ortigas.</p>
<ul><li>Clean and organize delivery data using Excel and SQL.</li><li>Build weekly dashboards in Power BI.</li></ul>
<p>${"You will also help with many other tasks across the team. ".repeat(12)}</p>`;

const job = (over: Record<string, unknown>) => ({
  job_id: "abc123==",
  employer_name: "Kalye Logistics Inc.",
  job_title: "Data Analyst Intern",
  job_description: LONG,
  job_apply_link: "https://careers.kalye.example.com/jobs/1",
  job_city: "Pasig",
  job_state: "Metro Manila",
  job_country: "PH",
  job_latitude: 14.5869,
  job_longitude: 121.0614,
  job_is_remote: false,
  job_posted_at_datetime_utc: "2026-11-08T02:00:00.000Z",
  job_offer_expiration_datetime_utc: "2026-11-30T15:59:00.000Z",
  job_employment_type: "INTERN",
  job_highlights: { Qualifications: ["Knowledge of Excel and SQL", "Python is a plus"] },
  ...over,
});

describe("normalizing outside postings", () => {
  it("keeps internships and OJT only", () => {
    expect(isInternship("Marketing OJT")).toBe(true);
    expect(isInternship("IT Trainee (Practicum)")).toBe(true);
    expect(isInternship("Senior Software Engineer")).toBe(false);
    expect(isInternship("Software Engineer", ["INTERN"])).toBe(true);
    expect(isInternship("International Sales Manager")).toBe(false); // "international" isn't "intern"
  });

  it("shows only a short snippet, whole sentences, no HTML", () => {
    const s = makeSnippet(LONG);
    expect(s.length).toBeLessThanOrEqual(SNIPPET_MAX);
    expect(s).not.toMatch(/<|>/);
    expect(s.startsWith("We are looking for a Data Analyst Intern")).toBe(true);
    expect(makeSnippet("Short and sweet.")).toBe("Short and sweet.");
    expect(makeSnippet("word ".repeat(200)).endsWith("…")).toBe(true);
  });

  it("allows only https apply links", () => {
    expect(safeApplyUrl("https://x.ph/apply")).toBe("https://x.ph/apply");
    for (const bad of ["http://x.ph", "javascript:alert(1)", "ftp://x.ph", "", null, 42]) expect(safeApplyUrl(bad), String(bad)).toBeNull();
  });

  it("finds skills by name, alias, and common spellings, but not ambiguous one-letter ones", () => {
    expect(findSkills("Knowledge of MS Excel, SQL, Power BI and Python")).toEqual(["ms-excel", "sql", "python", "power-bi"]);
    expect(findSkills("Experience with Node.js and HTML5")).toEqual(["html-css", "nodejs"]);
    expect(findSkills("Grade C or better in Math")).toEqual([]);
    expect(findSkills("Embedded C on microcontrollers")).toContain("c");
    // A skill at the end of a sentence still counts.
    expect(findSkills("You will use Excel and SQL.")).toEqual(["ms-excel", "sql"]);
  });

  it("infers the field from the title first, then the text and skills", () => {
    expect(inferField("Data Analyst Intern", "", [])).toBe("data");
    expect(inferField("HR Intern", "recruitment and payroll", [])).toBe("hr");
    expect(inferField("Intern", "Help our front office team at the hotel", [])).toBe("hospitality");
    expect(inferField("Intern", "", [])).toBeNull();
  });

  it("makes stable, readable ids that fit the database rule", () => {
    const id = listingId("js", "Kalye Logistics Inc.", "Data Analyst Intern (Ortigas)", "abc123==");
    expect(id).toMatch(/^js-kalye-logistics-inc-data-analyst-intern-ortigas-[0-9a-f]{6}$/);
    expect(id).toBe(listingId("js", "Kalye Logistics Inc.", "Data Analyst Intern (Ortigas)", "abc123=="));
    expect(id).not.toBe(listingId("js", "Kalye Logistics Inc.", "Data Analyst Intern (Ortigas)", "other"));
    expect(listingId("js", "x".repeat(100), "y".repeat(100), "r").length).toBeLessThanOrEqual(80);
  });
});

describe("JSearch adapter", () => {
  it("asks for one page of Philippine results", () => {
    const u = new URL(jsearchUrl("internship in Philippines"));
    expect(u.host).toBe("jsearch.p.rapidapi.com");
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ country: "ph", num_pages: "1" });
  });

  it("maps a posting to a listing, and counts why others were skipped", () => {
    const answer = {
      status: "OK",
      data: [
        job({}),
        job({ job_id: "2", job_title: "Senior Accountant", job_employment_type: "FULLTIME" }),
        job({ job_id: "3", job_country: "SG" }),
        job({ job_id: "4", job_apply_link: "http://insecure.example.com" }),
        job({ job_id: "5", job_title: "Intern", job_description: "Join us!", job_highlights: null }),
        job({ job_id: "6", employer_name: "" }),
        job({ job_id: "7", job_title: "Remote Web Developer Intern", job_is_remote: true, job_city: "", job_state: "" }),
      ],
    };
    const { listings, skipped } = parseJsearch(answer, NOW);
    expect(skipped).toEqual({
      "not an internship": 1,
      "outside the Philippines": 1,
      "no https apply link": 1,
      "field unclear": 1,
      "missing title or company": 1,
    });
    expect(listings).toHaveLength(2);

    const [a, remote] = listings;
    expect(a).toMatchObject({
      source: "jsearch",
      sourceRef: "abc123==",
      title: "Data Analyst Intern",
      company: "Kalye Logistics Inc.",
      field: "data",
      area: "Pasig, Metro Manila",
      lat: 14.5869,
      workType: "onsite",
      applyUrl: "https://careers.kalye.example.com/jobs/1",
      deadline: "2026-11-30",
      postedAt: "2026-11-08T02:00:00.000Z",
      dedupeKey: dedupeKey("Kalye Logistics Inc.", "Data Analyst Intern", "Pasig, Metro Manila"),
    });
    expect(a.snippet.length).toBeLessThanOrEqual(SNIPPET_MAX);
    // Skills in the title or the qualifications are required; others nice to have.
    // ("dashboards" is a way postings say data visualization.)
    expect(a.skills).toEqual([
      { id: "ms-excel", required: true },
      { id: "sql", required: true },
      { id: "data-visualization", required: false },
      { id: "power-bi", required: false },
    ]);
    expect(remote).toMatchObject({ workType: "remote", area: "Anywhere in the Philippines", lat: null, lng: null, field: "web" });
  });

  it("survives a broken answer", () => {
    expect(parseJsearch({ error: "quota" }, NOW)).toEqual({ listings: [], skipped: { "unexpected answer": 1 } });
    expect(parseJsearch(null, NOW).listings).toEqual([]);
  });
});

describe("JSearch v5 answer shape", () => {
  it("reads data.jobs, prefers the short job_uid, and builds the /search-v2 URL", () => {
    const longId = "UHpsN1ZSWlhoUUk0".repeat(20);
    const { listings, skipped } = parseJsearch(
      { status: "OK", data: { jobs: [job({ job_id: longId, job_uid: "Pzl7VRZXhQI4gF_OAAAAAA==" })] } },
      NOW,
    );
    expect(skipped).toEqual({});
    expect(listings).toHaveLength(1);
    expect(listings[0].sourceRef).toBe("Pzl7VRZXhQI4gF_OAAAAAA==");
    const url = new URL(jsearchUrl("internship in Philippines"));
    expect(url.pathname).toBe("/search-v2");
    expect(url.searchParams.get("country")).toBe("ph");
  });
});

describe("refresh plan (dedupe across sources)", () => {
  const incoming = (over: Partial<ImportedListing>): ImportedListing => ({
    ...parseJsearch({ data: [job({})] }, NOW).listings[0],
    ...over,
  });

  it("inserts new postings and refreshes ones seen before, keeping their id", () => {
    const fresh = incoming({});
    const plan = planImport([fresh], [{ id: "old-id", source: "jsearch", source_ref: "abc123==", dedupe_key: "something else" }]);
    expect(plan.update).toEqual([{ id: "old-id", listing: fresh }]);
    expect(planImport([fresh], []).insert).toEqual([fresh]);
  });

  it("never overwrites a company's direct post or an admin entry with an aggregator copy", () => {
    const fresh = incoming({});
    const plan = planImport([fresh], [{ id: "kalye-data-analyst", source: "direct", source_ref: null, dedupe_key: fresh.dedupeKey }]);
    expect(plan).toMatchObject({ insert: [], update: [], skipped: { directWins: 1 } });
  });

  it("doesn't revive our own copy once a company has published the same job (the copy was superseded)", () => {
    const fresh = incoming({});
    const plan = planImport(
      [fresh],
      [
        { id: "old-id", source: "jsearch", source_ref: fresh.sourceRef, dedupe_key: "superseded:old-id" },
        { id: "d-4444-abcd", source: "direct", source_ref: null, dedupe_key: fresh.dedupeKey },
      ],
    );
    expect(plan).toMatchObject({ insert: [], update: [], skipped: { directWins: 1 } });
  });

  it("keeps the first of two copies in one batch", () => {
    const a = incoming({});
    const b = incoming({ sourceRef: "other", id: "js-copy-123456" });
    const plan = planImport([a, b], []);
    expect(plan.insert).toEqual([a]);
    expect(plan.skipped.repeatInBatch).toBe(1);
  });
});

describe("cron protection", () => {
  const secret = "a-long-random-secret-123";
  it("accepts only Vercel Cron's bearer secret", () => {
    expect(cronAuthorized(`Bearer ${secret}`, secret)).toBe(true);
    expect(cronAuthorized(`Bearer wrong-secret-xxxxxxxx`, secret)).toBe(false);
    expect(cronAuthorized(null, secret)).toBe(false);
    expect(cronAuthorized(`Bearer ${secret}`, undefined)).toBe(false);
    expect(cronAuthorized("Bearer short", "short")).toBe(false); // too-short secrets are refused
  });
});
