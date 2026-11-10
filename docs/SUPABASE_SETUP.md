# Connecting Supabase (about 10 minutes, free plan)

1. **Create a project** at supabase.com → New project.
   - Region: **Southeast Asia (Singapore)**, the closest to the Philippines.
   - Save the database password in a password manager. The app doesn't need it.

2. **Copy the keys** (Project Settings → API Keys, and Project Settings → Data API
   for the URL) into `.env.local`, which is never committed:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key, sb_publishable_...>
   SUPABASE_SERVICE_ROLE_KEY=<secret key, sb_secret_...>   # server only, never share it
   ```
   The URL is the **API** address ending in `.supabase.co`, not the dashboard
   address (`supabase.com/dashboard/project/...`).

3. **Create the tables:** SQL Editor → New query → paste each file → Run, in order:
   1. `supabase/migrations/0001_core.sql`
   2. `supabase/migrations/0002_accounts.sql`
   3. `supabase/migrations/0003_places.sql`
   4. `supabase/migrations/0004_quest_log.sql`
   5. `supabase/migrations/0005_game.sql`
   6. `supabase/migrations/0006_learning.sql`, then run `supabase/seed.sql` again
      (it adds the learning resources; running it twice is safe)
   7. `supabase/migrations/0007_imports.sql`
   8. `supabase/migrations/0008_companies.sql`
   9. `supabase/migrations/0009_retention.sql`
   10. `supabase/migrations/0010_listing_updated_at.sql`

   Later migrations go in the same way, in number order, once each.

4. **Reference data and sample listings** (dev project only): SQL Editor → paste
   `supabase/seed.sql` → Run. For the real pilot, run only the parts before
   "Sample listings". Real listings come from admin import and JSearch.
   The seed is needed: profiles point at its fields, skills, and schools.

5. **Auth settings** (Authentication → Sign In / Providers → Email, or
   Authentication → Settings on older dashboards):
   - **Turn OFF "Allow new users to sign up".** Accounts are created only by our
     server, which checks the username rules, the consent box, and the age box
     first. With public sign-up on, anyone could make sign-in users with the
     public key and skip those checks.
   - "Confirm email" can stay as it is: the server marks each account as
     confirmed itself (intern accounts use a private internal address,
     `<username>@users.internquest.invalid`, that can't receive mail).
   - Minimum password length: **10** (matches the form).

6. **Auth rate limits** (Authentication → Rate Limits): sign-ins go through our
   server, so on Vercel they arrive from a few shared addresses. Raise
   "Sign-ups and sign-ins" from the default to about **300 per 5 minutes**, or
   a class logging in together can be blocked. Our own per-username limits
   (`src/lib/auth/limits.ts`) still stop password guessing.

Then run `npm run dev`. With the keys present, the app switches from the
design preview to real accounts: app pages ask you to log in, and sign-up
creates a real account.

**Map lookups:** `NOMINATIM_USER_AGENT` in `.env.local` must name the app and a
way to reach you. A project URL works; it doesn't have to be a personal email.
Without it, only cities on our list can be picked.

**Free-plan note:** a free project pauses after about 7 days without activity
(SPEC §3). The daily job below uses the database every day, which keeps it
awake; check Vercel → Cron Jobs if the project ever pauses.

**Recovery by email** needs an email-sending service (custom SMTP, for example
Resend's free tier). Until one is connected, recovery codes are the only way
to reset a password, and the email option is hidden (`src/lib/auth/features.ts`).

**Daily listings refresh (Phase 5):** `vercel.json` runs `/api/cron/daily` once a
day at 04:00 Manila. On Vercel, add `CRON_SECRET` (16+ random characters) and,
for imports, `JSEARCH_API_KEY` to the project's environment variables. To run
it by hand: `curl -H "Authorization: Bearer <CRON_SECRET>" https://<site>/api/cron/daily`.
Each run is logged in the `import_runs` table (counts only). The same job deletes
data past its retention period (`src/lib/retention.ts`, Phase 7).

**Admin access (Phase 6):** nobody is an admin until you add them by hand. Sign
up a normal account for yourself on the site, then find its id under
Authentication → Users, and run in the SQL Editor:
```sql
insert into public.admins (user_id) values ('<that user id>');
```
Then log in with that account and open `/admin`. To remove an admin, delete the
row. Keep the list short: admins can approve companies, hide listings, and
suspend accounts.

**Company accounts (Phase 6):** companies sign up at `/companies/register` with
their real work email. Supabase's own "Confirm email" setting doesn't apply here
because the server creates the account. To prove the company can read that
inbox, set `RESEND_API_KEY`, `RESEND_FROM` (an address on a domain you've
verified in Resend), and `SITE_URL` (the public address, for the link). Without
them, no email is sent: during review the admin checks the address another way
(for example, a call to the company's listed number) and presses "I checked the
email another way", which is logged.

**Suspending** a company or a user (from `/admin`) blocks their sign-in through
Supabase Auth (Authentication → Users shows them as banned). To undo it, remove
the ban there and set the company's `status` back to `approved` in the
`companies` table.
