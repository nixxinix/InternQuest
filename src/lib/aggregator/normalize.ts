/**
 * Turning outside postings into InternQuest listings (SPEC §5.3). Pure and
 * unit tested; every source adapter (JSearch now, Jooble or Adzuna later)
 * uses these helpers, so all sources follow the same rules:
 *  - internships and OJT only;
 *  - a short snippet only, never the full posting (CLAUDE.md hard rule),
 *    plus the link back to the original;
 *  - https apply links only;
 *  - field and skills inferred from the text, so matching works.
 */
import { FIELDS, type FieldId } from "@/lib/catalog/fields";
import { SKILLS } from "@/lib/catalog/skills";

/** Our snippet length for outside listings (the database allows 600). */
export const SNIPPET_MAX = 280;

const INTERN_WORDS = /\b(intern|interns|internship|internships|ojt|on[- ]the[- ]job|trainee|traineeship|practicum|apprentice|apprenticeship|work immersion)\b/i;

export function isInternship(title: string, employmentTypes: string[] = []): boolean {
  return INTERN_WORDS.test(title) || employmentTypes.some((t) => t.toUpperCase() === "INTERN");
}

/** Plain text from HTML or markdown-ish descriptions. */
export function plainText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/^[\s>*•·\-–#]+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The short preview we may show: whole sentences up to SNIPPET_MAX
 * characters, or the first sentence cut at a word with "…".
 */
export function makeSnippet(raw: string, max = SNIPPET_MAX): string {
  const text = plainText(raw);
  if (text.length <= max) return text;
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [];
  let out = "";
  for (const s of sentences) {
    if ((out + s).trim().length > max) break;
    out += s;
  }
  if (out.trim().length >= 60) return out.trim();
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 40)).trim()}…`;
}

/** Only https links leave our site (the database refuses anything else). */
export function safeApplyUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" && u.toString().length <= 500 ? u.toString() : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------------ */
/* Skills and field from the text                                            */
/* ------------------------------------------------------------------------ */

/** Extra ways postings write a skill. Very short or ambiguous words are left out on purpose. */
const EXTRA_PHRASES: Record<string, string[]> = {
  c: ["c programming", "c language", "embedded c"],
  "html-css": ["html", "css", "html5", "css3"],
  nodejs: ["node.js", "nodejs", "node js"],
  "ms-excel": ["microsoft excel", "ms excel", "excel"],
  "power-bi": ["power bi", "powerbi"],
  autocad: ["autocad", "auto cad"],
  "customer-service": ["customer service", "customer support"],
  "social-media": ["social media"],
  "data-visualization": ["data visualization", "data visualisation", "tableau"],
  english: ["english"],
  "video-editing": ["video editing", "premiere pro", "capcut"],
};
/** Names too short or too common to match safely on their own. */
const SKIP_PHRASES = new Set(["c", "ts", "charts", "testing"]);

/**
 * Lowercase words separated by single spaces. Dots survive only inside a word
 * ("node.js"), so a skill at the end of a sentence ("Excel and SQL.") still matches.
 */
const norm = (s: string) =>
  ` ${s
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\.(?![a-z0-9])|(?<![a-z0-9])\./g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;

const PHRASES: { id: string; phrases: string[] }[] = SKILLS.map((s) => ({
  id: s.id,
  phrases: [...new Set([s.name, ...(s.aliases ?? []), ...(EXTRA_PHRASES[s.id] ?? [])].map((p) => p.toLowerCase()))]
    .filter((p) => p.length >= 2 && !SKIP_PHRASES.has(p))
    .map((p) => norm(p).trim()),
}));

/** Skill ids mentioned in the text, in catalog order. */
export function findSkills(text: string): string[] {
  const t = norm(text);
  return PHRASES.filter((s) => s.phrases.some((p) => p && t.includes(` ${p} `))).map((s) => s.id);
}

const FIELD_WORDS: Record<FieldId, string[]> = {
  iot: ["iot", "embedded", "firmware", "electronics", "hardware", "microcontroller", "robotics"],
  web: ["web", "developer", "software", "frontend", "front end", "backend", "back end", "full stack", "mobile app", "programmer", "information technology", "it support", "qa"],
  data: ["data", "analyst", "analytics", "business intelligence", "data science"],
  design: ["design", "designer", "ux", "ui", "graphic", "multimedia", "creative", "illustrator"],
  business: ["marketing", "sales", "business development", "business administration", "e commerce", "operations", "admin assistant"],
  accounting: ["accounting", "accountancy", "accountant", "finance", "financial", "audit", "bookkeeping", "tax"],
  hr: ["hr", "human resources", "human resource", "recruitment", "recruiter", "talent acquisition", "payroll"],
  hospitality: ["hotel", "hospitality", "front office", "tourism", "restaurant", "culinary", "travel", "housekeeping", "food and beverage"],
  engineering: ["civil engineering", "mechanical", "electrical", "engineering", "ece", "architectural", "construction", "structural"],
  comms: ["communications", "communication arts", "content", "journalism", "writer", "copywriter", "social media", "media", "public relations", "broadcasting"],
};

/**
 * The field a posting most likely belongs to: title words count 3, words in
 * the description 1, and each found skill adds 1 to its fields. Null when
 * nothing points anywhere (such postings are skipped, not guessed).
 */
export function inferField(title: string, description: string, skills: string[]): FieldId | null {
  const t = norm(title);
  const d = norm(description);
  const scores = new Map<FieldId, number>(FIELDS.map((f) => [f.id, 0]));
  for (const [field, words] of Object.entries(FIELD_WORDS) as [FieldId, string[]][]) {
    for (const w of words) {
      const p = ` ${norm(w).trim()} `;
      if (t.includes(p)) scores.set(field, scores.get(field)! + 3);
      if (d.includes(p)) scores.set(field, scores.get(field)! + 1);
    }
  }
  for (const id of skills) {
    for (const f of SKILLS.find((s) => s.id === id)?.fields ?? []) scores.set(f, (scores.get(f) ?? 0) + 1);
  }
  let best: FieldId | null = null;
  let bestScore = 0;
  for (const f of FIELDS) {
    const score = scores.get(f.id) ?? 0;
    if (score > bestScore) {
      best = f.id;
      bestScore = score;
    }
  }
  return best;
}

/* ------------------------------------------------------------------------ */
/* Ids                                                                        */
/* ------------------------------------------------------------------------ */

export function slugPart(s: string, max: number): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

/** FNV-1a, 32 bits, as 6 hex characters: stable short suffix so two similar postings never share an id. */
export function shortHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0").slice(0, 6);
}

/** "js-kalye-logistics-data-analyst-ojt-1a2b3c": readable, stable per source posting, fits the id rule. */
export function listingId(prefix: string, company: string, title: string, sourceRef: string): string {
  const body = [slugPart(company, 24), slugPart(title, 36)].filter(Boolean).join("-") || "listing";
  return `${prefix}-${body}-${shortHash(sourceRef)}`.slice(0, 80);
}
