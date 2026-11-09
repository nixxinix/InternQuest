# INTERNQUEST: Product and Build Spec

Working name. Change it anytime.

## 1. Goal
Help anyone looking for an internship/OJT find relevant listings near them,
apply faster, prepare better, and stay motivated through a game layer that can
be turned down or off. Built first as a school project, later launched for
real users in the Philippines.

## 2. Users
1. Interns (primary): anyone who wants to intern. School is optional. Profile
   has an optional status (student, fresh grad, career shifter, other).
2. Companies (secondary): verified companies who post internships.
3. Admin (the owner): reviews companies and reports.

## 3. Hosting and cost notes
- Vercel Hobby (free) is for personal, non-commercial use, and cron jobs on it
  run at most once per day. Pro is needed for commercial use.
- Supabase Free pauses a project after about 7 days of inactivity. Pro does not.
- For the school pilot, free tiers are fine. Add a scheduled ping so the
  database does not pause. For a real launch, plan on Vercel Pro and Supabase Pro.
- All scheduled jobs (listing refresh, weekly leaderboard reset, expiring
  listings) must work with a once-per-day schedule. The weekly reset runs on
  Monday, Asia/Manila time.
- Check the free quota of any listings API before relying on it.

## 4. Sign-in and privacy
- Username + password only. No email or real name required.
- Supabase Auth needs an email, so choose one: (a) synthetic internal email
  per username, or (b) custom auth with argon2/bcrypt and secure session
  cookies. Recommend one and explain why before building.
- Optional recovery email so users can reset their password.
- Privacy page, consent checkbox at sign-up, minimal data, hashed passwords,
  full account deletion, row-level security so users only access their own data.
- Follow the Philippine Data Privacy Act principles.

## 5. Core features (version 1)
1. Profile ("character sheet"): username, city/area typed by the user,
   skills (selectable tags from a skills table, searchable), interests/fields,
   preferred work type (onsite, remote, hybrid), optional status and
   school/group.
2. Location: user types a city or area. Geocode it (Nominatim first), then
   filter by radius using the Haversine formula.
3. Listings from a hybrid source model:
   - Aggregator API adapter (start with JSearch). Design a common adapter
     interface so Jooble/Adzuna can be added.
   - Direct posts from verified companies.
   - Manual entries imported by admin (CSV).
   Normalize into one `internships` table. Dedupe by normalized company +
   title + location. Show a source label ("via JSearch", "Posted directly",
   "Added by admin"). Store `is_active` and `last_checked`. A daily job
   refreshes and hides dead listings.
4. Ranked "best match" results with a "why this matched" breakdown.
5. Listing detail page on this site (snippet, skills, Match Panel, tips
   links). The Apply button goes through `/go/:id`, which logs the click and
   redirects to the original posting in a new tab. Direct posts may use an
   apply link or a `mailto:` link.
6. Quest log (application tracker): Saved, Applied, Interview, Result.
   Desktop: drag and drop. Mobile: tap a card to change status.
7. Apply confirmation: when the user returns to the tab after clicking Apply
   (`visibilitychange`), ask "Did you apply?" with a Yes button. Yes marks it
   Applied and awards EXP.

## 6. Skills matching on every listing
Every listing card and detail page shows a Match Panel:
- Match percentage as a stat bar
- Matched skills (chips)
- Missing skills (chips), called "Missing abilities" in game modes
- For each missing skill, 1 to 2 free learning resources from a curated
  `skill_resources` table (title, url, type, skill_id)
- A "Quick prep" link to resume tips for that listing's field
Logged-out visitors can use a quick skill picker to see the panel.

## 7. Matching algorithm (rule-based first)
score = 0.50 * skill_score + 0.25 * distance_score
      + 0.15 * interest_field_score + 0.10 * work_type_score
- skill_score: weighted overlap. Required skills weigh 2, nice-to-have 1.
  Normalize with a `skill_synonyms` table first (for example "IoT" and
  "embedded systems"). Return `matched[]` and `missing[]`.
- distance_score: 1.0 within 5 km, decaying to 0 at the user's chosen radius.
  Remote listings get a fixed 0.8.
- Return a JSON breakdown of every part so the UI can explain it.
- Weights live in one config file. Later upgrade: text embeddings.

## 8. Tips and guides
Written content in markdown under `content/tips/`, with contextual links.
- Resume tips: one-page structure, section order, action verbs, quantifying
  results, showing projects and school work when there is no job experience,
  ATS-friendly formatting, tailoring to each listing, common mistakes,
  printable checklist.
- Interview tips: preparing, researching the company, common internship
  questions, STAR method, questions to ask, online/video interview setup,
  what to wear, follow-up message, handling rejection.
- Application tips: cover letter structure, messaging a recruiter, follow-up
  timing.
Behavior: moving a card to "Interview" shows interview tips. Skill gaps link
to resume tips about showing related project experience. Finishing a tips
checklist gives small EXP. Write in friendly, clear language. No unverified
statistics.

## 9. Optional AI helper (keep simple)
Server-side only. Two actions: "Draft a cover letter for this listing" and
"Rewrite this resume bullet for this listing". Send only the user's skills,
their typed text, and the listing snippet. Cap at 5 uses per user per day
(`ai_usage` table). Label output "AI draft, review and edit before sending."
Do not store generated text unless the user saves it.

## 10. Gamification
Modes (chosen at onboarding, changeable anytime):
- Full Quest (DEFAULT): avatar, EXP, level-ups, weekly streaks, badges,
  weekly quests, motivational notes, leaderboard after unlock.
- Light: EXP bar and badges only, small toasts, no full-screen level-up,
  leaderboard hidden.
- Plain: clean tracker and listings, no game elements.

Gradual unlock, even in Full Quest:
- Start: matches, quest log, EXP bar
- After first application: EXP count-up, level-up screen, first badge
- After week 1: weekly streak and weekly quest
- Level 3: weekly leaderboard unlocks
In the first 2 to 3 sessions show "Too much? Switch to Light mode."

Settings toggles: streaks, leaderboard, "show me on leaderboard" (separate),
animations, sound (off by default), motivational note tone (cheerful, calm,
off). Respect `prefers-reduced-motion`.

Onboarding = character creation + tutorial quest:
1. Username and password
2. Choose a class (IoT Engineer, Web Dev, Data Analyst, Designer, Business,
   Other), pick skills as "abilities", type city/area
3. Tutorial quest: view your top match, save a listing, confirm your first
   application. Each step gives EXP so they reach Level 2.

EXP (server-side, authoritative, idempotent through an `exp_events` table):
```
Complete profile (once)             +50
Confirm an application              +20 (first 3 per day), then +5
Tailored cover letter used          +10
Update status in quest log          +5
Log a result (offer or rejection)   +10
Finish a skill gap resource         +15
Finish a tips checklist             +10
Weekly goal reached                 +30
Referred user joins                 +25
```
Reward effort, not results. Rejection message example: "Quest failed, but you
leveled up." Never shame.

Weekly streak: a week counts if the user does at least one qualifying action.
One "rest week" per month keeps the streak alive. Use Asia/Manila time.

Weekly leaderboard: resets every Monday, shows usernames only, can be grouped
by school/community or overall, and always shows a personal best ("You beat
last week by 2 applications"). Unlocked at Level 3. Users can opt out of
appearing.

Share card: level, EXP, number of applications, current streak, with a link
back. Users choose what to show.

Reward effects (medium): EXP count-up, bar fill, skippable pixel level-up
card. Animations under about 1 second.

Abuse prevention: daily EXP caps, only confirmed applications count, flag
unusual activity for admin review.

## 11. UI and UX
- Pixel-game layer on a clean, readable base. Pixel elements (avatar, EXP bar,
  badges, icons, level-up screen, streak flame) live in the header, rewards,
  and profile. Listings, forms, and tips use a readable sans-serif
  (DM Sans or Inter) on calm backgrounds.
- Pixel font only for headings and game elements (Press Start 2P, Silkscreen,
  or Pixelify Sans). Palette limited to 6 to 8 design tokens.
- Pixel-style buttons and borders in CSS (stepped corners, hard shadows).
  Use `image-rendering: pixelated` and integer sprite scaling. Avatar and
  badges as SVG or small sprite sheets.
- Concept: listings are "quests", the quest log is the tracker, the profile is
  a character sheet. Friendly, human wording. No generic startup phrases.
- Mobile-first. Mobile: bottom nav (Home, Search, Quest Log, Tips, Profile).
  Desktop: left sidebar with list and detail panel. Touch targets at least
  44px. No hover-only features.
- Screens: Home, Search results, Listing detail (with Match Panel), Quest log,
  Tips (resume, interview, application), Profile and avatar, Leaderboard,
  Settings, Company post form, Admin queue, Privacy page.
- Home: avatar, level, EXP bar, streak, weekly quest, top matches, "closing
  soon" saved listings.
- Performance: skeleton loaders, instant UI updates, filters stored in the
  URL, light assets for weak phones and data plans.
- Accessibility: strong contrast, never color-only meaning, keyboard and
  screen reader support, reduced-motion support.

## 12. Companies, trust, and safety
- Company registration with a company email. Block free email domains (gmail,
  yahoo, outlook, and similar) and require a confirmation link sent to that
  address.
- Email-domain verification only proves email access. Every new company also
  goes into an admin review queue before it can post.
- Verified badge and source label on every listing.
- "Report listing" button on every listing, feeding the admin queue.
- Companies can create, edit, and close their own postings, each with an
  apply link or application email.

## 13. Database (design full schema with indexes and row-level security)
users, profiles, skills, skill_synonyms, skill_resources, user_skills,
internships, internship_skills, applications (status, timestamps), click_logs,
exp_events, weekly_exp, streaks, badges, user_badges, weekly_quests,
user_settings, companies, company_members, company_verification, reports,
tips_progress, ai_usage.

## 14. Security and quality
Validate all input. Rate-limit login and AI endpoints. Never expose API keys.
Protect admin routes. Use row-level security. Log admin actions. Handle errors
everywhere. Write tests for scoring, EXP, streak, and leaderboard logic.

## 15. Build phases (one at a time, wait for "next")
- Phase 0: project setup, folder structure, env variables, design tokens
- Phase 1: auth, profile, skills, location, seeded listings, search and filter
- Phase 2: matching engine, Match Panel, listing detail, `/go/:id` redirect,
  quest log, apply confirmation
- Phase 3: gamification (EXP, levels, streaks, badges, quests, modes,
  onboarding, weekly leaderboard)
- Phase 4: tips content, skill gap resources, optional AI helper
- Phase 5: aggregator API adapter, dedupe, refresh jobs
- Phase 6: company posting, verification, admin queue, reports
- Phase 7: polish, accessibility, PWA, performance, pilot checklist
