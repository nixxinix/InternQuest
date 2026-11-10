/**
 * Server only: reads the guides from content/tips/*.md. Cached, so each file
 * is read and parsed once per build (they're static content).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseMarkdown } from "./markdown";
import { GUIDE_SLUGS, toGuide, toMeta, type Guide, type GuideMeta, type GuideSlug } from "./tips";

export async function loadGuide(slug: GuideSlug): Promise<Guide> {
  "use cache";
  const source = await readFile(path.join(process.cwd(), "content", "tips", `${slug}.md`), "utf8");
  return toGuide(slug, parseMarkdown(source));
}

export async function loadGuideMetas(): Promise<GuideMeta[]> {
  "use cache";
  const guides = await Promise.all(GUIDE_SLUGS.map((s) => loadGuide(s)));
  return guides.map(toMeta);
}
