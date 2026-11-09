/**
 * Tips guides: the list, their shape, and which one to suggest next.
 * Pure (no file access), so it can run in the browser and in tests.
 */
import { readMinutes, type Block, type ChecklistItem, type Doc } from "./markdown";

export const GUIDE_SLUGS = ["resume", "application", "interview"] as const;
export type GuideSlug = (typeof GUIDE_SLUGS)[number];

export function isGuideSlug(value: unknown): value is GuideSlug {
  return typeof value === "string" && (GUIDE_SLUGS as readonly string[]).includes(value);
}

export type Guide = {
  slug: GuideSlug;
  title: string;
  summary: string;
  readMinutes: number;
  blocks: Block[];
  toc: { id: string; text: string }[];
  checklist: ChecklistItem[];
};

export type GuideMeta = Pick<Guide, "slug" | "title" | "summary" | "readMinutes"> & { checklistIds: string[] };

export function toGuide(slug: GuideSlug, doc: Doc): Guide {
  const title = doc.meta.title;
  const summary = doc.meta.summary;
  if (!title || !summary) throw new Error(`content/tips/${slug}.md needs a title and a summary`);
  return { slug, title, summary, readMinutes: readMinutes(doc.words), blocks: doc.blocks, toc: doc.toc, checklist: doc.checklist };
}

export function toMeta(g: Guide): GuideMeta {
  return { slug: g.slug, title: g.title, summary: g.summary, readMinutes: g.readMinutes, checklistIds: g.checklist.map((c) => c.id) };
}

export type UpNext = { slug: GuideSlug; anchor: string | null; reason: string };

/**
 * The guide for the user's current stage (W8): an interview coming up beats
 * applications waiting for a reply, which beats getting a resume ready.
 */
export function upNext(input: { interview: { company: string; when: string } | null; applicationsOut: number }): UpNext {
  if (input.interview) {
    return { slug: "interview", anchor: null, reason: `Interview at ${input.interview.company}, ${input.interview.when}` };
  }
  if (input.applicationsOut > 0) {
    return {
      slug: "application",
      anchor: "follow-up",
      reason: `${input.applicationsOut} ${input.applicationsOut === 1 ? "application is" : "applications are"} waiting for a reply`,
    };
  }
  return { slug: "resume", anchor: null, reason: "A good place to start before you apply" };
}
