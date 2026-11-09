# INTERNQUEST: User Flows (Design Brief, Step 1)

Date: 2026-11-09. Status: reviewed. S1 to S4 accepted (S4 as Option 1), S5
dropped, M1 to M5 accepted (see section 10).

Notation: **[tap]** is a deliberate user action. "Sheet" means a bottom sheet on
mobile and a dialog on desktop. Every flow is written for a 360px phone first.
Desktop differences are noted where they matter.

Items marked **SPEC CHANGE** need your approval because they differ from
`SPEC.md`. They are collected again in section 10.

---

## 1. First visit (logged out)

Goal: understand the site in 5 seconds and see real listings before any sign-up.

1. Land on `/`. Above the fold, in this order:
   - One plain sentence: "Internships and OJT near you, matched to your skills."
   - The quick picker: field chips (Web, IoT, Data, Design, Business, HR,
     Accounting, Hospitality, more...), then skill chips for that field
     (top 8 plus search), a city box, and a "Remote is fine" toggle.
   - Real listings already visible below the picker ("Newest across the
     Philippines"), so the page is never empty while the user decides.
2. **[tap]** a field, then **[tap]** 2 to 5 skills. Results re-rank live. Each
   card shows the match bar, matched chips, and missing chips. No submit button
   needed. On mobile, a sticky "See 24 matches" button scrolls to results.
3. Type a city (optional). It autocompletes from a local list of Philippine
   cities and municipalities. Distance appears on cards.
4. **[tap]** a card to open the detail page with the full Match Panel.
5. **Apply works without an account.** It goes through `/go/:id` as normal.
   On return, the sheet says: "Did you apply? Create a character to track it
   and earn your first EXP." Dismissible.
6. **Save** is the moment we ask for an account: "Create your character to
   keep this listing. Your skills and city come with you." This leads into flow 2.

Friction found and fixed:
- *Picker before content* would leave the first screen empty. Fix: real
  listings render immediately; the picker re-ranks them.
- *Gating Apply behind sign-up* adds 3+ screens before the user gets any value.
  Fix: only Save and tracking need an account.
- *Location by IP or GPS* raises privacy questions and needs permission prompts.
  Fix: typed city only, and it is optional.

## 2. Sign up and onboarding (character creation)

> **Built order (2026-11-09, decision #47):** Account → Recovery → Play style →
> Character. Play style moved before Character so the character step can adapt
> (Plain shows "Your profile" with no avatar). The steps below keep their
> original numbering for reference.

**SPEC CHANGE (onboarding order):** SPEC §10 starts with username and password.
I propose that account creation comes *after* the user has seen value, and
that it carries over everything they already picked.

1. Entry: from Save, from the "Did you apply?" sheet, or from "Create character".
2. **Screen 1: Account.** Username (live "available" check), password
   (show/hide, plain-language strength hint), consent checkbox with a 3-line
   summary ("We keep your username, skills, city, and quest log. No real name
   or email needed.") and a link to the full Privacy page.
   A strip shows "Coming with you: 4 abilities, Quezon City."
3. **Screen 2: Recovery (skippable).** Choose an optional recovery email *or*
   download 8 one-time recovery codes. "Skip for now" is clearly visible.
   See missing requirement M3.
4. **Screen 3: Character.** Class, avatar (6 presets plus a color pick),
   abilities (pre-filled from the picker), city, work type, optional status
   and school or group. If the user came from the picker, this is a review
   screen with everything pre-filled.
5. **Screen 4: Play style.** Full Quest (pre-selected), Light, or Plain. Each
   has a small preview and one line about what changes. "Change anytime in
   Settings."
6. Land on Home. The tutorial quest is a checklist card on Home, not a series
   of modals: View your top match, Save a listing, Finish your character
   sheet. Finishing these reaches Level 2.

Friction found and fixed:
- **SPEC CHANGE (tutorial):** SPEC makes "confirm your first application" a
  tutorial step. That pushes people to fake a confirmation or apply somewhere
  they don't want to, just to finish the tutorial. Fix: make it a *bonus*
  objective. The three steps above reach Level 2 on their own. This needs
  one-time tutorial EXP for "view top match" and "save a listing", which the
  EXP table does not have yet.
- **SPEC CHANGE (classes):** the class list (IoT Engineer, Web Dev, Data
  Analyst, Designer, Business, Other) leaves most Philippine OJT students
  under "Other" (accountancy, HRM, tourism, civil/mechanical/electrical
  engineering, communication, education). Fix: about 10 classes that map to
  fields, with Other as the last option.
- Required screens are only 1 and 3. Screens 2 and 4 have safe defaults
  (no recovery, Full Quest).

## 3. Find and apply

Target: **3 taps** from Home to a confirmed application.

1. Home shows the top 3 matches. The Search tab shows the full ranked list.
   Filters (radius, work type, field, allowance, posted within) live in the
   URL so links can be shared and the back button keeps state.
2. Each card shows: title, company with Verified mark and source label, area
   and distance, work type, allowance, match bar with %, up to 3 matched chips,
   and the missing skills. The skills fit is visible with **0 taps**.
3. **[tap 1]** a card. Mobile: full page. Desktop: the right-hand detail panel,
   with the list still visible on the left.
4. The detail page has a sticky bottom bar: Save (secondary) and Apply
   (primary). The Match Panel sits above the snippet, and each missing skill
   lists 1 to 2 free resources.
5. **[tap 2]** Apply opens `/go/:id` in a new tab. The app stores an
   "awaiting confirmation" marker for that listing.
6. The user comes back (`visibilitychange` to visible, within 2 hours of the
   click, once per click). A sheet appears: "Did you send your application to
   Tanglaw Solar?" with **Yes, I applied** and **Not yet**.
7. **[tap 3]** Yes. The card moves to Applied and the server awards EXP. The
   reward then plays at the level set by the user's mode (flow 6).

### Can we know they really applied?

**Not for listings on other sites.** InternQuest sends people to the
original posting. After that, the browser does not let our site see what
happens on another site, and JSearch and the companies send nothing back.
"Did you apply?" is always the user's own word. So the system treats it as
*self-reported* and makes lying not worth the effort:

1. **A click is required.** EXP for an application needs a `/go/:id` click
   logged on the server for that user and listing within the last 7 days.
2. **A minimum time gap.** The server compares its own click time with its
   own confirm time. If the gap is under a short minimum (start with 60
   seconds and adjust it using pilot data), the card still moves to Applied
   but gives no EXP. The browser cannot fake this, because both times come
   from the server.
3. **Once per listing**, ever. Daily caps follow the SPEC: +20 for the first 3
   per day, then +5.
4. **Manual adds** ("I applied somewhere else") are allowed for tracking
   only. They give no application EXP and don't count on leaderboards.
5. **Flags:** many confirmations in a row with gaps just over the minimum, or
   an unusual daily count, go to the admin Flagged activity queue.
6. **Honest wording:** the UI says "Confirmed by you", never "Verified".

**For direct company posts, it can be real (later option).** An
"Apply on InternQuest" form would send a short message and resume link to
the company's dashboard. Then we *know* the application happened. That adds
privacy duties (storing applications, deleting them on request), so I suggest
deciding after the pilot (Phase 6 or later). Until then, direct posts use
the same self-reported flow.

Things that **won't** work: reading the other site's page (blocked by the
browser), getting confirmations back from aggregators (they don't send any),
and adding `?ref=internquest` to links (that only shows up in the company's
own analytics, not ours).

Friction found and fixed:
- *The prompt fires when the user just switched apps for something else.*
  Fix: it only fires after an Apply click, within a 2-hour window, at most
  once per click.
- *The user closed the tab and never came back.* Fix: on the next visit, the
  quest log card shows an inline "Did you apply?" chip. No pop-up.
- *"Not yet" must not nag.* It keeps the card in Saved with an "Apply pending"
  tag, and we don't ask again.
- *`mailto:` does nothing on phones without a mail app.* Fix: a sheet shows the
  email address with a Copy button, a suggested subject line, and "Open email
  app."
- *Scam listings ask for "training fees".* See missing requirement M2.

## 4. Track in the quest log

1. Statuses: Saved, Applied, Interview, Result.
2. **Mobile:** 4 tabs with counts ("Applied 5") because 4 columns don't fit at
   360px. **[tap]** a card to open a sheet with big status buttons, a notes
   field, and an optional interview date.
3. **Desktop:** a 4-column board with drag and drop. Each card also has a
   "Move to..." menu button, so keyboard and screen reader users never need to
   drag.
4. Every status change shows a toast with **Undo** for 5 seconds.
5. Next-step hints appear on the card after a change:
   - Applied: "Most companies reply in 1 to 3 weeks. Here's a follow-up message
     you can send." (The wording avoids claiming a statistic.)
   - Interview: "Prepare for your interview" links to the interview guide. If
     the user adds a date, it appears on Home under "Coming up".
   - Result: the user picks an outcome (see M5).
6. Outcomes:
   - Offer: celebration (scaled to mode) and "Questions to ask before you say yes."
   - Not selected: "This one didn't work out. You still earned +10 EXP." plus a
     template for asking for feedback. *(SPEC suggests "Quest failed, but you
     leveled up." I'd soften "failed". Your call, minor.)*
   - No reply / I withdrew: filed quietly, no EXP penalty, no judgement.

Friction found and fixed:
- *Status toggling to farm EXP.* Fix: EXP for status changes is idempotent per
  (application, status) on the server. Undo does not grant or remove extra EXP.
- *Drag-only boards break for keyboard and touch.* Fixed by the menu fallback.

## 5. Prepare with tips (resume and interview)

1. Entry points:
   - Tips tab: Resume, Interview, Application guides.
   - Listing detail: "Quick prep" goes to the resume guide for that field.
   - A missing-skill chip goes to "Showing related project experience."
   - Moving a card to Interview links to the interview guide.
2. Guide page: a short intro, a jump-to section list, a readable column (about
   65 characters per line), and a checklist at the end.
3. The checklist saves as the user ticks items. Finishing it gives +10 EXP
   once. A Print button uses a clean print stylesheet (printable checklist).
4. Reading pages have no game elements apart from checklist progress.

Friction found and fixed:
- *Long guides on small phones.* Fix: the jump-to list and "back to top" button,
  and every section is a deep-linkable anchor so contextual links land on the
  exact part.

## 6. Level up (reward feedback by mode)

1. The user does a qualifying action. The server records an `exp_events` row
   and returns the new EXP, level, and anything unlocked.
2. **Full Quest:** EXP counts up in the header (under 800ms), the bar fills.
   On level-up, a pixel level-up card appears: new level, what unlocked
   ("Weekly leaderboard unlocked" at Level 3), and Continue. Skippable by tap,
   Escape, or Continue. Focus is trapped while open and returns afterwards.
3. **Light:** small toast "+20 EXP · Level 3" and the bar fill. No overlay.
4. **Plain:** a plain confirmation only ("Marked as applied").
5. **Reduced motion** (OS setting or app toggle): numbers swap instantly and
   the card appears without movement.

Friction found and fixed:
- *A level-up card interrupting a task* (for example on top of the "Did you
  apply?" sheet). Fix: rewards wait until the current sheet or form closes.
- *Several rewards at once* (application + weekly quest + level). Fix: they
  merge into one card or toast, never a chain of three.

## 7. Post a listing (company, no game elements)

1. `/companies`: a separate, plain entry page explaining verification and what
   interns see.
2. Register: company name, work email, password, your role. A free-email domain
   (gmail, yahoo, outlook, and similar) is blocked with one clear sentence:
   "We need an email on your company's own domain to verify you."
3. **[tap]** the confirmation link in the email.
4. Company profile: website, address, industry, logo, and an optional DTI/SEC
   registration number (it helps the admin decide quickly).
5. Status banner: "Under review. We'll email you when you're approved."
   **Drafting listings is allowed while pending.** Drafts publish on approval.
6. Post form: title, field, description, skills (each marked Required or Nice to
   have), location, work type, allowance (amount, or an explicit "Unpaid"),
   OJT hours or duration, start date, deadline, apply method (link or email).
7. Preview: "How interns will see this", with a sample Match Panel.
8. Manage: Active / Draft / Closed tabs, apply-click counts, Edit, Close.

Friction found and fixed:
- *Small businesses that only use Gmail are shut out.* Accepted trade-off for
  v1 (S5 dropped), because a manual path means more admin work. If you want
  a listing from such a business, you can add it yourself through CSV import
  ("Added by admin").
- *Waiting for review with nothing to do.* Fixed by allowing drafts.

## 8. Admin review (no game elements)

1. `/admin`, protected by role, with three queues: Companies, Reports, Flagged
   activity. Each shows a count.
2. **Company:** one screen with the automatic checks in a row (email
   confirmed, email domain matches website, website loads, DTI/SEC number
   given). Actions: **Approve**, or **Reject** with a reason picked from a
   list. The company sees the reason and can register again. There is no
   messaging back and forth.
3. **Report:** listing preview, reason, number of reports. Actions: Hide
   listing, Dismiss, Suspend company. Listings with 3 or more "Asks for
   payment" reports are hidden automatically until you look at them.
4. **Flagged activity:** user, the pattern (for example 30 confirmations in an
   hour). Actions: Clear, Reverse EXP, Suspend.
5. Every action needs a reason and is written to an admin audit log.
6. CSV import with a dry-run preview showing duplicates before anything is saved.

---

## 9. Mode vocabulary (decided, minor)

| Concept        | Full Quest        | Light          | Plain          |
| -------------- | ----------------- | -------------- | -------------- |
| Listing        | Quest             | Listing        | Listing        |
| Tracker (nav)  | Quest log         | Quest log      | Applications   |
| Skills         | Abilities         | Skills         | Skills         |
| Missing skills | Missing abilities | Missing skills | Missing skills |
| Profile        | Character sheet   | Profile        | Profile        |
| Home heading   | Quests for you    | Top matches    | Top matches    |

## 10. Decisions on spec changes

### Spec changes
- **S1. Onboarding order: ACCEPTED (recommended, see why below).** The
  picker and results come first. The account comes last and carries the picks
  over.
  - *Better for users:* they see real matches before any form, and nothing
    has to be typed twice.
  - *Better for the system:* no half-finished accounts in the database. A
    visitor's picks stay in their browser (URL and local storage) and are
    only sent once, at sign-up, so we store nothing about people who don't
    sign up. That fits the Data Privacy Act's "minimal data" principle.
  - *Cost:* the matching endpoint has to work for logged-out visitors, so it
    needs a rate limit and caching. This is a small amount of extra work in
    Phase 1.
- **S2. Tutorial: ACCEPTED.** "Confirm your first application" is a bonus.
  View top match (+10, once) and Save a listing (+10, once) are tutorial EXP
  events. Exact level thresholds are set in Phase 3.
- **S3. Classes: ACCEPTED.** IoT & Embedded, Web & Mobile Dev, Data &
  Analytics, Design & Multimedia, Business & Marketing, Accounting & Finance,
  HR & Admin, Hospitality & Tourism, Engineering (Civil, Mech, EE, ECE),
  Communication & Media, Other. A class sets the avatar outfit and suggests
  starting skills. It never limits which listings someone sees.
- **S4. Leaderboard: ACCEPTED, Option 1** (2026-11-09). You suggested a weekly
  board plus an overall application board. The options were:
  - **Option 1 (recommended):** a "This week" tab ranked by weekly EXP, and
    an "All time" tab ranked by total EXP. Application counts appear on every
    row and in the personal best ("2 more applications than last week").
  - **Option 2 (your idea, made safer):** a "This week" tab ranked by weekly
    EXP, and an "All time" tab ranked by total applications. Only confirmed
    applications that pass the click checks in section 3 count, with at most 3
    per day.
  - *Why I recommend Option 1:* applications are self-reported, so they are
    the easiest number to inflate. An all-time application ranking also
    rewards sending as many as possible. Total EXP includes preparation and
    interviews, so it rewards effort.
- **S5. Manual company verification: DROPPED.** You prefer less admin work.
  The free-email block stays as written in the SPEC. The admin queue is
  designed so each review is one screen and one decision (section 8).

### Missing requirements (accepted unless you say otherwise)
- **M1. Philippine OJT fields:** allowance (amount or unpaid), required hours
  or duration, start date, and "can sign a school MOA". These are listing
  fields and filters.
- **M2. Scam safety:** a note on every listing ("Legit internships never ask
  you to pay a fee") and "Asks for payment" as a report reason.
- **M3. Recovery codes:** downloadable one-time codes for users who skip the
  recovery email.
- **M4. Deadlines:** a deadline field drives "Closing soon". Listings without
  one show "Posted 3 weeks ago" instead.
- **M5. Result outcomes:** Offer, Not selected, No reply, I withdrew.
- **M6. Language: default English** for v1, with every string in one file so
  Filipino/Taglish can be added later. Say so if you want Taglish microcopy
  now.

### Risk flags
- **Nominatim usage policy** (legal/cost): no autocomplete-as-you-type, at
  most 1 request per second, and a proper User-Agent is required. Fix:
  autocomplete from a local table of Philippine cities and municipalities
  with coordinates (PSGC-based). Use Nominatim only on submit for unusual
  places, and cache the results.
- **Logged-out click logs** (privacy): `/go/:id` for logged-out users should
  store no IP address, only the listing ID and time.
- **File paths:** `CLAUDE.md` and the brief refer to `docs/SPEC.md`, but SPEC.md
  is in the project root. I put new docs in `docs/` and didn't move your files.
