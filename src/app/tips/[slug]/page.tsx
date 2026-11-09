import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountScope } from "@/components/providers/AccountScope";
import { ChecklistProgress, PrintChecklistButton } from "@/components/tips/Checklist";
import { GuideBody } from "@/components/tips/GuideBody";
import { TipsShell } from "@/components/tips/TipsShell";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { loadGuide } from "@/lib/content/loadGuides";
import { GUIDE_SLUGS, isGuideSlug } from "@/lib/content/tips";

export function generateStaticParams() {
  return GUIDE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/tips/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!isGuideSlug(slug)) return { title: "Guide not found" };
  const guide = await loadGuide(slug);
  return { title: guide.title, description: guide.summary };
}

/** W8 guide page. The text is server-rendered from content/tips/<slug>.md; only the checklist is interactive. */
export default async function GuidePage({ params }: PageProps<"/tips/[slug]">) {
  const { slug } = await params;
  if (!isGuideSlug(slug)) notFound();
  const guide = await loadGuide(slug);
  const ids = guide.checklist.map((c) => c.id);

  const toc = (
    <ul className="space-y-0.5">
      {guide.toc.map((t) => (
        <li key={t.id}>
          <a href={`#${t.id}`} className="flex min-h-tap items-center py-1 text-base underline-offset-4 hover:underline">
            {t.text}
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    // Phones: no bottom nav on a guide; the back link and "Back to top" replace it.
    <AccountScope>
      <TipsShell bottomNav={false}>
        <Link
          href="/tips"
          className="no-print inline-flex min-h-tap items-center gap-1.5 font-semibold text-green underline-offset-4 hover:underline"
        >
          <PixelIcon name="chevronRight" scale={2} className="rotate-180" />
          Tips
        </Link>

        <div className="mt-2 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-10">
          {/* Desktop: table of contents on the left. */}
          <nav aria-label="On this page" className="no-print sticky top-8 hidden max-h-[calc(100dvh-4rem)] overflow-y-auto lg:block">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">On this page</p>
            <div className="mt-2 border-l-2 border-line pl-4">{toc}</div>
            {ids.length > 0 && (
              <div className="mt-4">
                <PrintChecklistButton />
              </div>
            )}
          </nav>

          {/* Bottom padding on phones so "Back to top" never covers the last line. */}
          <article aria-labelledby="guide-h" className="pb-16 lg:pb-0">
            <h1 id="guide-h" className="text-2xl font-semibold lg:text-3xl">
              {guide.title}
            </h1>
            <p className="no-print mt-1 flex flex-wrap gap-x-3 text-sm text-muted">
              <span>{guide.readMinutes} min read</span>
              {ids.length > 0 && <ChecklistProgress slug={guide.slug} ids={ids} />}
            </p>
            <p className="no-print mt-3 max-w-[65ch] text-lg">{guide.summary}</p>

            {/* Phones: a collapsible list at the top. */}
            <details className="no-print mt-4 max-w-[65ch] border border-line bg-screen lg:hidden">
              <summary className="flex min-h-tap cursor-pointer items-center px-4 font-semibold">On this page</summary>
              <nav aria-label="On this page" className="px-4 pb-3">
                {toc}
              </nav>
            </details>

            <GuideBody slug={guide.slug} blocks={guide.blocks} />
          </article>
        </div>

        <a
          href="#main"
          className="no-print fixed bottom-4 right-4 z-30 inline-flex min-h-tap items-center gap-1.5 bg-bezel px-4 font-semibold text-screen shadow-raised lg:hidden"
        >
          <PixelIcon name="chevronRight" scale={2} className="-rotate-90" />
          Back to top
        </a>
      </TipsShell>
    </AccountScope>
  );
}
