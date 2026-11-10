import type { Metadata } from "next";
import Link from "next/link";
import { BusinessHeader, HEADER_LINK } from "@/components/layout/BusinessHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "For companies",
  description: "Post internships and OJT slots for free, and reach interns who match your needs.",
};

const STEPS = [
  { title: "Register with your work email", body: "Use an address on your company's own domain. Free email addresses can't be used." },
  { title: "Confirm your email", body: "We send a link to that address. It proves you can use it." },
  { title: "We review your company", body: "A person checks your website and details, usually within a few working days. You can write drafts while you wait." },
  { title: "Your listings go live", body: "They show a Verified mark. You can edit or close them anytime." },
];

/** W13 entry page (USER_FLOWS §7.1). Public, no game elements. */
export default function CompaniesPage() {
  return (
    <>
      <BusinessHeader area="for companies" home="/companies">
        <Link href="/companies/login" className={HEADER_LINK}>
          Log in
        </Link>
      </BusinessHeader>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-gutter pb-16 pt-8 lg:pt-12">
        <h1 className="max-w-2xl text-3xl font-semibold lg:text-4xl">Find interns who already have the skills you need</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          Post internships and OJT slots for free. Students and fresh grads see how well they match before they apply, and every
          application goes straight to you.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/companies/register" size="lg">
            Register your company
          </ButtonLink>
          <ButtonLink href="/companies/login" size="lg" variant="secondary">
            Log in
          </ButtonLink>
        </div>

        <section aria-labelledby="how-h" className="mt-12">
          <h2 id="how-h" className="text-xl font-semibold">
            How it works
          </h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="border border-line bg-screen p-4">
                <p className="text-sm font-semibold text-muted">Step {i + 1}</p>
                <p className="mt-1 font-semibold">{s.title}</p>
                <p className="mt-1 text-base text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="see-h" className="mt-12 grid gap-6 lg:grid-cols-2">
          <div>
            <h2 id="see-h" className="text-xl font-semibold">
              What interns see
            </h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-6 text-base">
              <li>Your listing with a Verified mark and &ldquo;Posted directly&rdquo;.</li>
              <li>How well their skills match yours, with the required and nice-to-have skills you set.</li>
              <li>Allowance, OJT hours, whether you sign a school MOA, and your deadline.</li>
              <li>An Apply button that goes to your link or your company email.</li>
            </ul>
          </div>
          <div>
            <h2 className="text-xl font-semibold">What you see</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-6 text-base">
              <li>How many people clicked Apply on each listing. Never who, until they apply to you.</li>
              <li>Your drafts, active listings, and closed ones in one place.</li>
            </ul>
            <p className="mt-4 border-l-4 border-ink bg-screen p-3 text-base">
              <span className="font-semibold">Our one rule:</span> listings can never ask interns to pay for anything. Listings
              that do are removed, and the company is suspended.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
