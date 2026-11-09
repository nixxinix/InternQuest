/**
 * A small Markdown parser for the Tips guides (SPEC §8). Only the subset the
 * guides use, so there's no dependency and nothing to sanitize:
 *
 *   ---                       front matter (key: value lines)
 *   ## Heading {#anchor}      h2 (in "On this page"); ### for h3
 *   paragraph lines           joined into one paragraph
 *   - item / 1. item          lists
 *   - [ ] item {#id}          a checklist item (ticked on the page, saved per user)
 *   > text                    a callout
 *   **bold**, [text](href)    inline
 *
 * Raw HTML is never produced: everything becomes typed blocks rendered as
 * React text. Links must be site-relative ("/", "#") or https; anything else
 * is shown as plain text.
 */

export type Inline = { type: "text"; text: string } | { type: "strong"; text: string } | { type: "link"; text: string; href: string };

export type ChecklistItem = { id: string; text: string; inlines: Inline[] };

export type Block =
  | { type: "h2" | "h3"; id: string; text: string }
  | { type: "p"; inlines: Inline[] }
  | { type: "ul" | "ol"; items: Inline[][] }
  | { type: "checklist"; items: ChecklistItem[] }
  | { type: "callout"; inlines: Inline[] };

export type Doc = {
  meta: Record<string, string>;
  blocks: Block[];
  /** h2 headings, for "On this page". */
  toc: { id: string; text: string }[];
  checklist: ChecklistItem[];
  words: number;
};

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isSafeHref(href: string): boolean {
  return href.startsWith("/") || href.startsWith("#") || /^https:\/\/[^\s]+$/.test(href);
}

/** Splits "Text {#id}" into its text and explicit id. */
function takeId(raw: string): { text: string; id: string | null } {
  const m = raw.match(/^(.*?)\s*\{#([a-z0-9-]+)\}\s*$/);
  return m ? { text: m[1].trim(), id: m[2] } : { text: raw.trim(), id: null };
}

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (const m of src.matchAll(re)) {
    if (m.index > last) out.push({ type: "text", text: src.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ type: "strong", text: m[1] });
    else if (isSafeHref(m[3])) out.push({ type: "link", text: m[2], href: m[3] });
    else out.push({ type: "text", text: m[2] });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ type: "text", text: src.slice(last) });
  return out;
}

const plain = (inlines: Inline[]) => inlines.map((i) => i.text).join("");

export function parseMarkdown(source: string): Doc {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const meta: Record<string, string> = {};
  let i = 0;

  if (lines[0]?.trim() === "---") {
    i = 1;
    while (i < lines.length && lines[i].trim() !== "---") {
      const m = lines[i].match(/^([a-zA-Z]+):\s*(.*)$/);
      if (m) meta[m[1]] = m[2].trim();
      i++;
    }
    i++; // closing ---
  }

  const blocks: Block[] = [];
  const ids = new Set<string>();
  const claimId = (id: string, where: string) => {
    if (ids.has(id)) throw new Error(`Duplicate anchor "#${id}" (${where})`);
    ids.add(id);
    return id;
  };
  let words = 0;
  const count = (t: string) => {
    words += t.split(/\s+/).filter(Boolean).length;
  };

  let para: string[] = [];
  const flushPara = () => {
    if (para.length) {
      const text = para.join(" ");
      count(text);
      blocks.push({ type: "p", inlines: parseInline(text) });
      para = [];
    }
  };

  for (; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();

    if (!t) {
      flushPara();
      continue;
    }

    const heading = t.match(/^(#{2,3})\s+(.*)$/);
    if (heading) {
      flushPara();
      const { text, id } = takeId(heading[2]);
      count(text);
      blocks.push({ type: heading[1].length === 2 ? "h2" : "h3", id: claimId(id ?? slugify(text), text), text });
      continue;
    }

    if (t.startsWith(">")) {
      flushPara();
      const parts: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        parts.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      i--;
      const text = parts.join(" ");
      count(text);
      blocks.push({ type: "callout", inlines: parseInline(text) });
      continue;
    }

    if (/^- \[[ x]\]\s+/.test(t)) {
      flushPara();
      const items: ChecklistItem[] = [];
      while (i < lines.length && /^- \[[ x]\]\s+/.test(lines[i].trim())) {
        const { text, id } = takeId(lines[i].trim().replace(/^- \[[ x]\]\s+/, ""));
        const inlines = parseInline(text);
        count(text);
        items.push({ id: claimId(id ?? slugify(plain(inlines)), text), text: plain(inlines), inlines });
        i++;
      }
      i--;
      blocks.push({ type: "checklist", items });
      continue;
    }

    const bullet = /^- /.test(t);
    const numbered = /^\d+\.\s/.test(t);
    if (bullet || numbered) {
      flushPara();
      const items: Inline[][] = [];
      const re = bullet ? /^- / : /^\d+\.\s/;
      while (i < lines.length && re.test(lines[i].trim()) && !/^- \[[ x]\]/.test(lines[i].trim())) {
        const text = lines[i].trim().replace(re, "");
        count(text);
        items.push(parseInline(text));
        i++;
      }
      i--;
      blocks.push({ type: bullet ? "ul" : "ol", items });
      continue;
    }

    para.push(t);
  }
  flushPara();

  return {
    meta,
    blocks,
    toc: blocks.flatMap((b) => (b.type === "h2" ? [{ id: b.id, text: b.text }] : [])),
    checklist: blocks.flatMap((b) => (b.type === "checklist" ? b.items : [])),
    words,
  };
}

/** Rounded up, at about 200 words a minute; never "0 min". */
export function readMinutes(words: number): number {
  return Math.max(1, Math.ceil(words / 200));
}
