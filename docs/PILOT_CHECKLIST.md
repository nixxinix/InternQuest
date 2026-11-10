# Pilot checklist

For running the school pilot: a small group of real interns, a few companies,
and you as the admin. Tick each box before inviting anyone. Items marked ⚠
are legal or privacy decisions only you (and ideally a lawyer or your school's
data protection officer) can make.

## 1. Set up the services

**Supabase** (full steps in [SUPABASE_SETUP.md](SUPABASE_SETUP.md))
- [ ] Project in **Southeast Asia (Singapore)**.
- [ ] Migrations `0001` to `0010` run in order, once each.
- [ ] `supabase/seed.sql` run (reference data). For the pilot, run only the part
      before "Sample listings": the samples are fictional.
- [ ] Authentication: **"Allow new users to sign up" OFF**, minimum password
      length 10, sign-in rate limit about 300 per 5 minutes.
- [ ] Your account added to `public.admins`. Log in and open `/admin` to check.

**Vercel**
- [ ] Project created from the repo. Environment variables set (copy names from
      `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
      `SUPABASE_SERVICE_ROLE_KEY`, `NOMINATIM_USER_AGENT`, `CRON_SECRET`,
      `SITE_URL`. Optional: `JSEARCH_API_KEY`, `AI_API_KEY`, `RESEND_API_KEY` + `RESEND_FROM`.
- [ ] The daily job ran: Vercel → Cron Jobs shows a 200, and the `import_runs`
      table has a row. It also keeps the free Supabase project from pausing.
- [ ] `NOMINATIM_USER_AGENT` names the app and a real contact (a project URL is fine).

**Optional services**
- [ ] JSearch: check the plan's monthly quota first. The job uses about 60 requests a month.
- [ ] AI helper: set a **monthly spend limit** in the Anthropic console before adding `AI_API_KEY`.
- [ ] Resend: sender domain verified, so company confirmation emails arrive.
      Without it, confirm each company's email by hand in `/admin`.

## 2. Decide the open legal and privacy items ⚠

The privacy notice (`/privacy`) marks these in [brackets]. Fill them in before
anyone signs up, and take the brackets out.
- [ ] ⚠ **Age rule.** Sign-up asks "18 or older, or I have my parent's or
      guardian's permission". Senior high work-immersion students are often
      minors. Confirm this with your school or a lawyer (decision #102).
- [ ] ⚠ **Privacy contact / Data Protection Officer.** Name a person and an email
      address for data requests (Data Privacy Act).
- [ ] ⚠ **Retention periods.** Proposed in `src/lib/retention.ts`: Apply clicks 12
      months, resolved reports and flags 6 months after review, admin log 2
      years. The daily job deletes data on that schedule, and the privacy notice
      shows those numbers. Change them there if you decide differently.
- [ ] ⚠ **Supabase data region** stated on the privacy page.
- [ ] ⚠ **A breach plan.** Under the Data Privacy Act, a personal data breach
      may need to be reported to the National Privacy Commission within 72
      hours. Write down who you'd contact and how.
- [ ] Hosting terms: Vercel Hobby is for **non-commercial** use only. A school
      pilot fits; anything paid or for a business needs Vercel Pro.

## 3. Check the content

- [ ] Open every learning link once (`src/lib/catalog/resources.ts`, through
      `/learn/<id>`). Replace any that moved or now need payment.
- [ ] Read through the tips (`content/tips/`). No made-up statistics.
- [ ] School list: add the pilot schools (decision M8) to `src/lib/catalog/schools.ts`,
      then regenerate the seed (`npm run db:seed`) and re-run it.
- [ ] Starting listings: import real ones in `/admin/import` (download the
      template there). Each must be a real, current opening.

## 4. Test it yourself (about 20 minutes, phone and laptop)

Use a phone on mobile data for at least the intern part.

**Intern**
- [ ] Sign up, pick a class and skills, type a city. The tutorial quest appears.
- [ ] Search, filter, open a listing, see the Match Panel and a learning link.
- [ ] Save a listing, press Apply, come back, answer "Yes, I applied". EXP goes up once.
- [ ] Move the card through the quest log. Switch to Plain mode: no game elements.
- [ ] Report a listing as a guest (logged out).
- [ ] Settings: download my data, then delete the account. Logging in again fails.

**Company**
- [ ] Register with a work email (a gmail address must be refused).
- [ ] Save a draft. Publishing is locked until approval.
- [ ] As admin: approve the company. Then publish the listing; it shows "Posted
      directly" and "Verified" in search.
- [ ] Close the listing; its page says it's closed.

**Admin**
- [ ] The report from above is in the queue. Dismiss it; the audit log shows it.
- [ ] Import a small CSV, then import the same file again: rows say "Updates an earlier import".

**Phone app**
- [ ] Android Chrome: menu → "Add to home screen" / "Install app". It opens
      without the browser bar, with the pin icon.
- [ ] iPhone Safari: Share → "Add to Home Screen".
- [ ] Turn on airplane mode and open a page: "You're offline" appears, not the browser's error.

## 5. During the pilot

- [ ] Check `/admin` daily: new companies, reports, unusual-activity flags.
- [ ] Check `import_runs` weekly for errors (quota, outages).
- [ ] Watch the AI spend and Supabase usage (database size, monthly active users).
- [ ] Keep notes for tuning after the pilot: the unusual-activity threshold
      (decision #99), the level curve (#119), the JSearch searches (#131).

**If something goes wrong**
- A bad listing: hide it from `/admin` (report it first if it isn't in the queue).
- A bad company or user: suspend from `/admin`. Undo in Supabase → Authentication → Users.
- AI misbehaving or too costly: remove `AI_API_KEY` in Vercel and redeploy. The
  helper disappears; nothing else changes.
- Bad imports: remove `JSEARCH_API_KEY` in Vercel. The daily clean-up still runs.

## 6. Before a public launch (after the pilot)

- [ ] A real legal review of the privacy notice and the age rule.
- [ ] Vercel Pro and Supabase Pro (no pausing, commercial use, backups).
- [ ] Resend (or another email service) for company confirmations.
- [ ] A final name, if "InternQuest" changes.
