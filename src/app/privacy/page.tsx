import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { RETENTION_DAYS, retentionLabel } from "@/lib/retention";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "What InternQuest keeps, why, for how long, and your rights under the Data Privacy Act.",
};

const UPDATED = "November 10, 2026";

/**
 * W12 Privacy notice (SPEC §4, Data Privacy Act of 2012). Public, no game
 * elements. DRAFT: anything in [brackets] must be decided before launch and
 * is listed in docs/SCREEN_REVIEWS.md. Have it reviewed before real users sign up.
 */
const KEEP: { what: string; why: string; howLong: string }[] = [
  { what: "Username and password (stored scrambled, never readable)", why: "To sign you in", howLong: "Until you delete your account" },
  {
    what: "When you agreed to this notice and confirmed your age",
    why: "To show you gave your consent at sign-up",
    howLong: "Until you delete your account",
  },
  {
    what: "Counts of recent sign-in tries, per username and per network (the network address is scrambled first)",
    why: "To stop people guessing passwords",
    howLong: "Up to 24 hours",
  },
  {
    what: "Recovery email or recovery codes (optional; codes stored scrambled)",
    why: "To reset a forgotten password",
    howLong: "Until you remove it or delete your account",
  },
  {
    what: "Your profile: field, skills, city, work type, and, if you choose, status and school",
    why: "To match you with listings and group the school leaderboard",
    howLong: "Until you change it or delete your account",
  },
  { what: "Your quest log and notes", why: "So you can track your applications", howLong: "Until you delete them or your account" },
  { what: "EXP, levels, badges, streaks, and leaderboard rows", why: "The game layer, if you use it", howLong: "Until you delete your account" },
  {
    what: "Notes on unusual activity, such as many confirmed applications within an hour",
    why: "To keep the game fair. An admin looks; nothing is taken away automatically. If the activity wasn't real, the admin may remove the EXP from that hour or suspend the account.",
    howLong: `Until an admin reviews them, then ${retentionLabel(RETENTION_DAYS.flags)} more`,
  },
  { what: "Your settings", why: "To remember how you like the app", howLong: "Until you delete your account" },
  {
    what: "Tips checklist ticks, and which learning links you opened and when",
    why: "So your progress follows you across devices, and to check \"I finished this\" before giving EXP",
    howLong: "Until you delete your account",
  },
  {
    what: "When you used the AI helper and for which listing (never the text)",
    why: "To keep the 5-a-day limit and check \"I used this\" before giving EXP",
    howLong: "Until you delete your account",
  },
  {
    what: "Apply clicks: which listing, and when",
    why: "To ask “Did you apply?” and check EXP isn't faked. Companies see only totals, never who.",
    howLong: `${retentionLabel(RETENTION_DAYS.clicks)}, then deleted. Unlinked from you if you delete your account.`,
  },
  {
    what: "Reports you send about listings: the reason, your note if you add one, and your account if you're signed in",
    why: "To review and remove unsafe listings. The company never sees who reported.",
    howLong: `Until an admin reviews them, then ${retentionLabel(RETENTION_DAYS.reports)} more. Unlinked from you if you delete your account.`,
  },
  {
    what: "A log of admin decisions (what was decided about which company, listing, or account, and why)",
    why: "So every removal or suspension can be explained and checked",
    howLong: retentionLabel(RETENTION_DAYS.audit),
  },
  {
    what: "Company accounts: the company's name, website, and registration number, and the representative's work email and role",
    why: "To check a company is real before its listings go live",
    howLong: "Until the company deletes its account. Its published listings are then closed, not removed.",
  },
];

const SECTIONS = [
  { id: "short", label: "The short version" },
  { id: "keep", label: "What we keep" },
  { id: "never", label: "What we never do" },
  { id: "who", label: "Who can see what" },
  { id: "services", label: "Services we use" },
  { id: "device", label: "On your device" },
  { id: "rights", label: "Your rights" },
  { id: "contact", label: "Contact" },
] as const;

export default function PrivacyPage() {
  return (
    <>
      <PublicHeader />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-gutter pb-16 pt-6 lg:pt-10">
        <div className="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-10">
          <nav aria-label="On this page" className="sticky top-8 hidden lg:block">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">On this page</p>
            <ul className="mt-2 space-y-0.5 border-l-2 border-line pl-4">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="flex min-h-tap items-center py-1 text-base underline-offset-4 hover:underline">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <article aria-labelledby="privacy-h" className="max-w-[65ch] text-base leading-relaxed">
            <h1 id="privacy-h" className="text-2xl font-semibold lg:text-3xl">
              Privacy notice
            </h1>
            <p className="mt-1 text-sm text-muted">Updated {UPDATED} · 4 min read</p>

            <p className="mt-4 border-l-4 border-alert bg-alert-tint p-3 text-sm">
              <span className="font-semibold">Draft for the school pilot.</span> Items in [brackets] will be decided before
              InternQuest opens to the public.
            </p>

            <Section id="short" title="The short version">
              <ul className="list-disc space-y-1.5 pl-6">
                <li>You only need a username and a password. We never ask for your real name, and email is optional.</li>
                <li>We keep what&apos;s needed to match you with internships and track your applications, and nothing more.</li>
                <li>Companies never see who you are. You decide when to contact them.</li>
                <li>You can download your data or delete your account anytime, in Settings.</li>
              </ul>
            </Section>

            <Section id="keep" title="What we keep, why, and for how long">
              {/* Phones: one card per row of data. Desktop: a real table. */}
              <div className="mt-3 hidden sm:block">
                <table className="w-full border-collapse border border-line bg-screen text-left text-sm">
                  <caption className="sr-only">What InternQuest keeps, why, and for how long</caption>
                  <thead>
                    <tr className="bg-canvas">
                      <th scope="col" className="border border-line p-2 font-semibold">
                        What we keep
                      </th>
                      <th scope="col" className="border border-line p-2 font-semibold">
                        Why
                      </th>
                      <th scope="col" className="border border-line p-2 font-semibold">
                        How long
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {KEEP.map((r) => (
                      <tr key={r.what}>
                        <th scope="row" className="border border-line p-2 align-top font-normal">
                          {r.what}
                        </th>
                        <td className="border border-line p-2 align-top">{r.why}</td>
                        <td className="border border-line p-2 align-top">{r.howLong}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <dl className="mt-3 space-y-3 sm:hidden">
                {KEEP.map((r) => (
                  <div key={r.what} className="border border-line bg-screen p-3">
                    <dt className="font-semibold">{r.what}</dt>
                    <dd className="mt-1 text-sm">
                      <span className="text-muted">Why: </span>
                      {r.why}
                    </dd>
                    <dd className="text-sm">
                      <span className="text-muted">How long: </span>
                      {r.howLong}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3">
                We save your city, never an exact address. When you type a city, it may be looked up on a map service to find
                its location. Only the place name is sent, not who typed it.
              </p>
            </Section>

            <Section id="never" title="What we never do">
              <ul className="list-disc space-y-1.5 pl-6">
                <li>Sell your data, or share it for ads.</li>
                <li>Show your username to companies, or tell them who reported a listing.</li>
                <li>Use advertising or tracking cookies.</li>
                <li>Ask you to pay anything to apply for an internship.</li>
              </ul>
            </Section>

            <Section id="who" title="Who can see what">
              <ul className="list-disc space-y-1.5 pl-6">
                <li>
                  <span className="font-semibold">Other users</span> can see your username, level, and weekly EXP on the
                  leaderboard, if it&apos;s on. You can hide yourself in Settings.
                </li>
                <li>
                  <span className="font-semibold">Companies</span> see how many people opened or clicked Apply on their
                  listings, never who. They only learn about you when you apply to them yourself.
                </li>
                <li>
                  <span className="font-semibold">The InternQuest admin</span> can see account data when needed to keep the
                  site safe, for example to review a report. Every admin decision is logged with its reason.
                </li>
                <li>
                  <span className="font-semibold">A share card</span> shows only what you pick, and only when you share it.
                </li>
              </ul>
            </Section>

            <Section id="services" title="Services we use">
              <p>These companies process data for us, only to run InternQuest:</p>
              <ul className="mt-3 list-disc space-y-1.5 pl-6">
                <li>
                  <span className="font-semibold">Supabase</span>: our database and sign-in. [Data region to be confirmed.]
                </li>
                <li>
                  <span className="font-semibold">Vercel</span>: hosts the website. Like any web host, it keeps technical
                  logs, such as IP addresses, for a limited time for security.
                </li>
                <li>
                  <span className="font-semibold">Listing sources</span> such as JSearch: we fetch listings from them. We
                  don&apos;t send them anything about you.
                </li>
                <li>
                  <span className="font-semibold">A map service</span> (OpenStreetMap&apos;s Nominatim): turns a typed city
                  name into a location.
                </li>
                <li>
                  <span className="font-semibold">An email service</span> (optional, Resend): sends a company its email
                  confirmation link. It receives only that address and the message.
                </li>
                <li>
                  <span className="font-semibold">The AI helper</span> (optional, Anthropic&apos;s Claude): only if you use
                  it, we send your skills, the text you typed, and the listing&apos;s short description. Nothing else, and
                  the draft isn&apos;t saved unless you save it.
                </li>
              </ul>
            </Section>

            <Section id="device" title="On your device">
              <p>
                We use a sign-in cookie to keep you logged in, and nothing else. Your browser also stores a few small things only on your
                device: the listing you just clicked Apply on (so we can ask &ldquo;Did you apply?&rdquo;), your checklist
                ticks, and sign-up progress while you&apos;re still on the page. Clearing your browser data removes them.
              </p>
            </Section>

            <Section id="rights" title="Your rights (Data Privacy Act of 2012)">
              <p>Under the Philippine Data Privacy Act, you have the right to:</p>
              <ul className="mt-3 list-disc space-y-1.5 pl-6">
                <li>
                  <span className="font-semibold">Be informed</span> about what we do with your data. That&apos;s this page.
                </li>
                <li>
                  <span className="font-semibold">Access</span> and <span className="font-semibold">take your data</span>:
                  Settings › Download my data.
                </li>
                <li>
                  <span className="font-semibold">Correct</span> it: edit your profile anytime.
                </li>
                <li>
                  <span className="font-semibold">Erase</span> it: Settings › Delete my account removes everything right away.
                </li>
                <li>
                  <span className="font-semibold">Object</span> to how we use it: turn off the leaderboard, or contact us.
                </li>
                <li>
                  <span className="font-semibold">Complain</span> to the National Privacy Commission if you think we got
                  something wrong.
                </li>
              </ul>
              <p className="mt-3">
                To sign up, you need to be 18 or older, or have your parent&apos;s or guardian&apos;s permission. [To be
                confirmed by a legal review before launch.]
              </p>
            </Section>

            <Section id="contact" title="Contact">
              <p>
                Questions or requests about your data: [privacy contact and Data Protection Officer to be named before launch].
                You can also manage most things yourself in{" "}
                <Link href="/settings" className="font-semibold text-green underline decoration-2 underline-offset-4">
                  Settings
                </Link>
                .
              </p>
            </Section>
          </article>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="mt-10 scroll-mt-6">
      <h2 id={`${id}-h`} className="text-xl font-semibold">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
