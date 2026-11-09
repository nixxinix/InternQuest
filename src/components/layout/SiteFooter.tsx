import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-screen">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-gutter py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>Each listing shows where it came from. Always apply through the original posting.</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-1">
          <Link href="/privacy" className="inline-flex min-h-tap items-center px-2 font-semibold text-ink underline-offset-4 hover:underline">
            Privacy
          </Link>
          <Link href="/companies" className="inline-flex min-h-tap items-center px-2 font-semibold text-ink underline-offset-4 hover:underline">
            For companies
          </Link>
        </nav>
      </div>
    </footer>
  );
}
