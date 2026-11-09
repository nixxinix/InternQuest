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
(SPEC §3). Phase 7 adds a daily ping for the pilot.

**Recovery by email** needs an email-sending service (custom SMTP, for example
Resend's free tier). Until one is connected, recovery codes are the only way
to reset a password, and the email option is hidden (`src/lib/auth/features.ts`).
