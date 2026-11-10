import Link from "next/link";
import type { Block, Inline } from "@/lib/content/markdown";
import { Checklist } from "./Checklist";

/** Renders a parsed guide. Server component: the text is in the HTML; only the checklist is interactive. */
export function GuideBody({ slug, blocks }: { slug: string; blocks: Block[] }) {
  return (
    <div data-guide-body className="max-w-[65ch] text-base leading-relaxed">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "h2":
            return (
              <h2 key={i} id={b.id} className="mt-10 scroll-mt-6 text-xl font-semibold lg:text-2xl">
                {b.text}
              </h2>
            );
          case "h3":
            return (
              // A deep link (like "Quick prep" → #iot) marks the section it lands on.
              <h3 key={i} id={b.id} className="mt-6 scroll-mt-6 text-lg font-semibold target:border-l-4 target:border-green target:bg-green-tint target:px-3 target:py-1">
                {b.text}
              </h3>
            );
          case "p":
            return (
              <p key={i} className="mt-3">
                <Inlines items={b.inlines} />
              </p>
            );
          case "ul":
          case "ol": {
            const List = b.type;
            return (
              <List key={i} className={b.type === "ul" ? "mt-3 list-disc space-y-1.5 pl-6" : "mt-3 list-decimal space-y-1.5 pl-6"}>
                {b.items.map((item, j) => (
                  <li key={j}>
                    <Inlines items={item} />
                  </li>
                ))}
              </List>
            );
          }
          case "callout":
            return (
              <p key={i} className="mt-4 border-l-4 border-green bg-green-tint px-4 py-3">
                <Inlines items={b.inlines} />
              </p>
            );
          case "checklist":
            return (
              <div key={i} data-print-keep className="mt-3">
                <Checklist slug={slug} items={b.items.map((it) => ({ id: it.id, text: it.text }))} />
              </div>
            );
        }
      })}
    </div>
  );
}

const LINK = "font-semibold text-green underline decoration-2 underline-offset-4";

function Inlines({ items }: { items: Inline[] }) {
  return (
    <>
      {items.map((it, i) => {
        if (it.type === "strong") return <strong key={i}>{it.text}</strong>;
        if (it.type === "text") return <span key={i}>{it.text}</span>;
        if (it.href.startsWith("https://")) {
          return (
            <a key={i} href={it.href} target="_blank" rel="noopener noreferrer" className={LINK}>
              {it.text}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          );
        }
        if (it.href.startsWith("#")) {
          return (
            <a key={i} href={it.href} className={LINK}>
              {it.text}
            </a>
          );
        }
        return (
          <Link key={i} href={it.href} className={LINK}>
            {it.text}
          </Link>
        );
      })}
    </>
  );
}
