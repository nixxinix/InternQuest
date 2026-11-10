import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FIELDS } from "@/lib/catalog/fields";
import { EMPTY_CHECKLIST, doneCount, parseChecklist, toggleItem } from "@/lib/content/checklist";
import { isSafeHref, parseInline, parseMarkdown, readMinutes, slugify } from "@/lib/content/markdown";
import { GUIDE_SLUGS, toGuide, upNext, type Guide, type GuideSlug } from "@/lib/content/tips";
import { nextStepHint } from "@/lib/tracker/status";

const guide = (slug: GuideSlug): Guide =>
  toGuide(slug, parseMarkdown(readFileSync(path.join(process.cwd(), "content", "tips", `${slug}.md`), "utf8")));

describe("markdown subset", () => {
  it("reads front matter, headings with anchors, lists, callouts, and checklists", () => {
    const doc = parseMarkdown(
      [
        "---",
        "title: T",
        "summary: S",
        "---",
        "## Before the day {#before}",
        "First line",
        "second line.",
        "",
        "- one",
        "- two",
        "",
        "1. a",
        "2. b",
        "",
        "> Tip **here**",
        "",
        "### Sub heading",
        "- [ ] Do it {#do-it}",
        "- [ ] Then this",
      ].join("\n"),
    );
    expect(doc.meta).toEqual({ title: "T", summary: "S" });
    expect(doc.blocks.map((b) => b.type)).toEqual(["h2", "p", "ul", "ol", "callout", "h3", "checklist"]);
    expect(doc.toc).toEqual([{ id: "before", text: "Before the day" }]);
    expect(doc.checklist.map((c) => c.id)).toEqual(["do-it", "then-this"]);
    expect(doc.blocks[1]).toEqual({ type: "p", inlines: [{ type: "text", text: "First line second line." }] });
  });

  it("refuses duplicate anchors, so a link can never land in the wrong place", () => {
    expect(() => parseMarkdown("## A {#x}\n## B {#x}")).toThrow(/Duplicate anchor/);
  });

  it("only makes links for site paths, anchors, and https", () => {
    expect(isSafeHref("/tips/resume")).toBe(true);
    expect(isSafeHref("#star")).toBe(true);
    expect(isSafeHref("https://example.com")).toBe(true);
    expect(isSafeHref("http://example.com")).toBe(false);
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(parseInline("see [this](javascript:alert(1)) now")).toEqual([
      { type: "text", text: "see " },
      { type: "text", text: "this" },
      { type: "text", text: ") now" },
    ]);
  });

  it("treats HTML as plain text", () => {
    const doc = parseMarkdown("<script>alert(1)</script>");
    expect(doc.blocks).toEqual([{ type: "p", inlines: [{ type: "text", text: "<script>alert(1)</script>" }] }]);
  });

  it("makes readable anchors and read times", () => {
    expect(slugify("What to wear?")).toBe("what-to-wear");
    expect(slugify("Mapúa & co.")).toBe("mapua-co");
    expect(readMinutes(0)).toBe(1);
    expect(readMinutes(401)).toBe(3);
  });
});

describe("the guides in content/tips", () => {
  it.each(GUIDE_SLUGS)("%s parses, has a title, sections, and a checklist", (slug) => {
    const g = guide(slug);
    expect(g.title).toBeTruthy();
    expect(g.toc.length).toBeGreaterThan(3);
    expect(g.checklist.length).toBeGreaterThanOrEqual(5);
  });

  it("has every anchor other screens link to", () => {
    const anchors = (slug: GuideSlug) =>
      new Set(guide(slug).blocks.flatMap((b) => (b.type === "h2" || b.type === "h3" ? [b.id] : [])));
    // "Quick prep" on every listing links to /tips/resume#<field>.
    for (const f of FIELDS) expect(anchors("resume")).toContain(f.id);
    // Quest log next steps.
    for (const [status, outcome] of [["applied", null], ["interview", null], ["result", "offer"], ["result", "not_selected"]] as const) {
      const hint = nextStepHint(status, outcome);
      const [page, hash] = hint!.href.replace("/tips/", "").split("#");
      if (hash) expect(anchors(page as GuideSlug)).toContain(hash);
    }
  });

  it("uses no unverified statistics (no percentage figures in the advice)", () => {
    for (const slug of GUIDE_SLUGS) {
      const text = readFileSync(path.join(process.cwd(), "content", "tips", `${slug}.md`), "utf8");
      expect(text).not.toMatch(/\d+\s?(%|percent)/i);
    }
  });
});

describe("checklist progress", () => {
  const ids = ["a", "b"];

  it("rewards only the first time every item is ticked", () => {
    const one = toggleItem(EMPTY_CHECKLIST, "a", ids);
    expect(one.completedNow).toBe(false);
    const both = toggleItem(one.state, "b", ids);
    expect(both.completedNow).toBe(true);
    const untick = toggleItem(both.state, "b", ids);
    expect(untick.state.rewarded).toBe(true);
    expect(toggleItem(untick.state, "b", ids).completedNow).toBe(false);
  });

  it("only counts items still in the guide", () => {
    expect(doneCount({ done: ["a", "old"], rewarded: false }, ids)).toBe(1);
  });

  it("survives broken stored data", () => {
    expect(parseChecklist("not json")).toEqual(EMPTY_CHECKLIST);
    expect(parseChecklist('{"done":[1,"a"],"rewarded":"yes"}')).toEqual({ done: ["a"], rewarded: false });
  });
});

describe("up next for you", () => {
  it("puts an upcoming interview first, then follow-ups, then the resume", () => {
    expect(upNext({ interview: { company: "Ilaw Robotics", when: "Thu" }, applicationsOut: 2 })).toMatchObject({ slug: "interview" });
    expect(upNext({ interview: null, applicationsOut: 1 })).toMatchObject({
      slug: "application",
      anchor: "follow-up",
      reason: "1 application is waiting for a reply",
    });
    expect(upNext({ interview: null, applicationsOut: 0 })).toMatchObject({ slug: "resume" });
  });
});
