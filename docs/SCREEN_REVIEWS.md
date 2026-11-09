# Screen reviews (Design Brief, Step 6)

Each screen is checked against Brief §5 before it's called done.
Screenshots come from headless Edge at true 360px (in iframes) and 1280px.

## W1. Landing (logged out): 2026-11-09

| Check | Result |
| ----- | ------ |
| What to do next in 3 seconds? | Yes. The headline says what the site is, the chips are the obvious next step, and listings sit right below. |
| One clear primary action? | Picking skills. Saving a listing leads to sign-up; "Create character" is the one bezel call-to-action, at the end of the results. |
| 360px and 1280px | Pass. At 360x740 the first listing card is visible without scrolling in all states (newest, matches, empty). Desktop uses a sticky picker that scrolls on its own. |
| Loading, empty, error | Loading: skeleton picker and cards (Suspense). Empty: says which filter caused it, with one or two fixes. Error: global error page. Unknown city: inline message. |
| All three modes | Not applicable: visitors have no play style yet, so they see plain words ("Missing skills", "Listings"). |
| Reduced motion | Only color transitions on chips; the global reduce rules apply. |
| Pixel styling helping? | Yes. It's limited to the bezel header, the call-to-action band, and the segmented match bars. Listing text is plain Inter. |
| Copy human and encouraging? | Yes. Nice-to-have skills are shown apart from "Missing skills", so a listing never looks harder than it is. No made-up statistics. |
| Contrast and keyboard | Token contrast is tested. Field chips are native radios (arrow keys work), skill chips are toggle buttons (aria-pressed), the city input has a native datalist, and focus rings show on chips through `has-[:focus-visible]`. A skip link is in the header. |

**Fixed during review:**
- The empty-state heading contradicted its message.
- The city placeholder was cut off.
- Remote cards said "Remote" twice.
- Nice-to-have skills were shown as "missing".
- The desktop picker was taller than the screen while sticky, so its bottom part couldn't be reached.
- A synonym of a picked skill was still suggested.

**Not verified:** a real screen reader pass (NVDA or TalkBack), datalist behavior in iOS Safari, and real-device performance on an older Android phone.

## W5. Listing detail and the apply flow: 2026-11-09

| Check | Result |
| ----- | ------ |
| What to do next in 3 seconds? | Yes. Title, company, and the key facts (where, allowance, hours, MOA, deadline) are at the top. Apply is always visible: in the sticky bar on phones, in the right card on desktop. |
| One clear primary action? | Apply (or "Apply by email"). Save is secondary. Closed listings swap it for "See open … listings". |
| 360px and 1280px | Pass after fixes. Phones show header, facts, skills fit, about, safety, then the sticky Save / Apply bar. Desktop puts the content on the left and the action card plus Match Panel on the right. |
| Loading, empty, error | Loading: skeleton for the match and actions. No skills yet: a quick "Which of these do you have?" picker using the listing's own skills (SPEC §6). Unknown id: real 404 (noindex). Closed: banner plus similar listings. Unexpected errors: global error page. |
| All three modes | Not applicable yet (visitor view). The member version of "Did you apply?" is built into `ApplyReturnSheet` and wired when accounts exist. |
| Reduced motion | The sheets' rise animation is removed by the global reduce rules. |
| Pixel styling helping? | Limited to the Skills fit header and bars. The description and facts are plain Inter. |
| Copy human and encouraging? | "You can still apply without them" under missing skills. Nice-to-haves are labelled. Plain-language scam warning. The report sheet promises the company is never told who reported. |
| Contrast and keyboard | Token contrast is tested. Apply is a real link to `/go/:id` with "(opens … in a new tab)" for screen readers. Report reasons are native radios. Sheets use native `<dialog>`. Quick-pick chips are toggle buttons. |

**Verified in the browser:**
- `/go/:id` returns 302 to the stored link only. Email-only, closed, and unknown listings return 303 to the listing page.
- An unknown listing gives a 404.
- "Did you apply?" appears after a simulated Apply click and 6 seconds away. It doesn't appear for a quick tab switch (unit-tested).

**Fixed during review:**
- On desktop, the tall right column created big gaps in the left column.
- Closed listings still showed the skills fit and Save.
- The closed page had a duplicate button on phones.
- The resource link's external icon floated away from its text.

**Not wired yet (needs the database):**
- Click logging in `/go/:id`.
- Report submission (Phase 6).
- Save and the member "Yes, I applied" (Phase 2 and 3).

The learning-resource URLs are well-known free sites, but each one should be opened once before launch.

## W2. Onboarding, "create your character": 2026-11-09

| Check | Result |
| ----- | ------ |
| What to do next in 3 seconds? | Yes. Every step has one heading, a one-line reason, and one primary button. "Step 2 of 4" plus a 4-segment bar sits in the header. |
| One clear primary action? | Yes, per step. Skip (step 2) is a ghost button with the consequence written under it. |
| 360px and 1280px | Pass. One centered 512px column on both, so forms stay short and readable. |
| Loading, empty, error | Loading: skeleton (Suspense). Errors: specific, next to the field, after leaving the field or pressing Continue (never while typing a too-short password). Focus moves to the first problem. Taken username: offers 3 free alternatives. Deep links past an unfinished step land on the furthest allowed step. |
| All three modes | Step 3 chooses the mode, and step 4 adapts live. Full: "Your character" with avatar, class, and abilities. Light and Plain: "Your profile", main field, skills, no avatar. The final screen differs per mode (checked at 360px for Full and Plain). |
| Reduced motion | Only the final card's pop animation, removed by the global reduce rules. |
| Pixel styling helping? | Limited to the header, mode previews, avatar, and the final card. All form text is Inter. |
| Copy human and encouraging? | "Even a little experience counts." The password hint gives a memorable example (which is then blocked so nobody copies it). The consent line says in plain words what's stored. No made-up statistics: "(most people start here)" was replaced with "(the default)". |
| Contrast and keyboard | Native radios for recovery, mode, work type, and swatches (arrow keys work). Swatches have names for screen readers ("Medium dark") and show selection with a ring, not just color. The password countdown is hidden from screen readers so it isn't read out on every keystroke. |

**Privacy check:**
- The password stays only in component state.
- Recovery codes are never written to storage.
- Progress (without either) is kept in sessionStorage, which clears when the tab closes.
- The final screen states that nothing left the device.

**Fixed during review:**
- An unverified "most people" claim.
- The Download button used the bookmark icon.
- The final avatar wasn't centered.
- A focus hack for the skills error was replaced with a direct focus on the skill search box.

**Not wired yet (Phase 1), onboarding:**
- Account creation (recommended: Supabase Auth with a private internal email per username).
- Server-generated, hashed recovery codes.
- The real username availability check.
- Saving the profile and the +50 "complete profile" EXP.
- Saving the listing passed in `?save=`.

## W0 + W3. App shell and Home: 2026-11-09

The review uses a sample user. Review-only URL switches: `?mode=full|light|plain` and `?state=new`.

| Check | Result |
| ----- | ------ |
| What to do next in 3 seconds? | Yes. The most urgent thing comes first: "Did you apply to Tanglaw Solar?" with Yes / Not yet. Then the weekly quest (or, for new users, the first-quest checklist), then matches. |
| One clear primary action? | "Yes, I applied" when something is pending. Otherwise the top match card. |
| 360px and 1280px | Pass. Phones: HUD header, one column, bottom nav. Desktop: 240px sidebar (character, EXP, streak, nav), main column with matches, and a right rail with the weekly quest, Coming up, and Closing soon. |
| Loading, empty, error | Loading: skeleton of the shell (Suspense). No good matches: says why and links to editing skills. Coming up and Closing soon are hidden when empty (decision #32). |
| All three modes | Full: avatar, streak, weekly quest, game words, level-up card. Light: wordmark, level, EXP; rewards as small toasts; no weekly quest. Plain: wordmark only, "Applications", plain confirmations. Checked at 360px in all three. |
| Rewards | "Yes, I applied" at 480/500 EXP shows the level-up card in Full (no toast on top, decision #6) and a "You reached Level 5" toast with +20 EXP in Light. EXP never counts down after a level-up. |
| Reduced motion | Count-up and level-up pop follow the global and in-app reduce rules. |
| Copy human and encouraging? | The weekly note is specific ("One more… Kanto Coffee closes in 2 days, if it's a fit") and says resting counts too. "Too much game?" offers Light mode without judgement. |
| Contrast and keyboard | Skip link, sidebar with `aria-current`, tutorial steps say done or to do for screen readers, streak has a full spoken label. |

**Fixed during review:**
- A 25% listing appeared as a "top match". Home now only shows matches of 40% or more.
- The sidebar username was cut off ("mika.co…"). The streak moved to the level line.
- Settings and Leaderboard borrowed unrelated icons. Gear and trophy icons were added.

**Not wired yet:**
- The real user, EXP, streak, and weekly quest (Phases 1 and 3).
- Saving the play style choice (Phase 3, user_settings).

## W4. Search: 2026-11-09

Review-only URL switches: `?mode=full|light|plain` and `?state=error`.

| Check | Result |
| ----- | ------ |
| What to do next in 3 seconds? | Yes. The search box is on top, the most-used filters are one tap below it, and the best match comes first. |
| One clear primary action? | Open a listing. On desktop it opens in the right panel, where Apply is the main button. |
| 360px and 1280px | Pass. Phones: search box, one swipeable filter row, count and sort, then cards (10 at a time, then "Show more"). Desktop: results on the left, a sticky detail panel on the right showing the selected listing or the top result. |
| Loading, empty, error | Loading: skeleton of the shell, filters, and cards. Empty: names up to 3 filters that cause it, with how many results each brings back (decision #58). Error: "We couldn't load listings" with Try again, and filters are kept. |
| All three modes | Full: "Abilities" and "Missing abilities" on cards. Light and Plain: "Skills". Plain shows no EXP in the header. Checked at 360px (Full, Plain) and 1280px (Full, Light). |
| Reduced motion | No new motion. Chip color changes follow the global reduce rules. |
| Copy human and encouraging? | "Loosening one of these brings some back" instead of a dead end. Nice-to-have skills stay separate from missing ones. |
| Contrast and keyboard | The search box is a `role="search"` form with a label. Filters are native selects (styled as chips) and toggle buttons with `aria-pressed`. Opening a card on desktop moves focus to the panel heading. The result count is announced politely. Ctrl- or Cmd-click still opens the full page in a new tab. |

**Verified in the browser:** clicking a card at 1280px opens it in the panel and adds `?open=` to the URL; `?open=` loads straight into the panel.

**Fixed during review:**
- An empty search showed Sort and a second "Clear filters" next to the empty state's own fixes. Both are hidden when there are no results.

**Not wired yet:**
- Real listings and the user's radius from their profile (Phase 1).
- Saving to the database (Phase 2).
- On phones, a card opens the public detail page. The signed-in version (app shell and real Save) comes with accounts.

## W7. Quest log: 2026-11-09

Review-only URL switches: `?mode=`, `?state=new` (empty log), and `?state=fail` (every save fails and rolls back).

| Check | Result |
| ----- | ------ |
| What to do next in 3 seconds? | Yes. Phones open the tab with the most urgent step ("Did you apply?" puts you in Saved). In each column the most urgent card comes first: pending confirmations, the closest deadline, the oldest application (due a follow-up), the soonest interview. |
| One clear primary action? | The next step on the top card: "Yes, I applied", or its next-step link. |
| 360px and 1280px | Pass after fixes. Phones: equal-width tabs with counts, then cards, then "Add one from elsewhere". Desktop: a 4-column board with drag and drop; the Add button sits by the title. |
| Loading, empty, error | Loading: skeleton. Empty tabs say why and give one action (Find listings, Read interview tips). Empty board columns show a one-line hint. A failed save is undone, with a "Try again" toast (decision #65). |
| All three modes | Full: "Quest log", pixel column headers, EXP in toasts. Light: the same words, with small toasts. Plain: "Applications", plain headers, no EXP anywhere (the "doesn't earn EXP" note is hidden too). |
| Rewards | Previewed with the same rules the server will use (decision #63). The level-up card or toast comes from the shared `useReward`, so Home, Search, and the Quest log behave the same. |
| Reduced motion | Only the column highlight while dragging (a color change). |
| Copy human and encouraging? | "Every outcome counts as progress." A rejection toast reads "Not this time, but logging it still counts." The offer toast congratulates. No made-up statistics: the old "Most companies reply in 1 to 3 weeks" line isn't used. |
| Contrast and keyboard | "Move to…" works everywhere, and drag and drop is optional. Cards announce their status to screen readers even though it isn't shown visually. Forms show errors next to the field after submit and focus the first problem. |

**Privacy and security:**
- Notes are private to the user, as the form says. They must be covered by row-level security in Phase 2.
- Links added by hand must be http or https and open with `noopener noreferrer nofollow` (decision #67).

**Fixed during review:**
- Phones showed two "Add one from elsewhere" buttons (a display class conflict).
- Board cards were too tall: a repeated status chip, the Details button wrapping, and next-step hints of up to 4 lines. Hints were shortened, and the title now opens the details (decision #62).
- New users saw a "0 WK" streak flame (decision #66).
- The sample interview said "Wed, Nov 12". Nov 12, 2026 is a Thursday. Dates are now computed in Manila time, and Home uses the same sample.

**Not verified:** drag and drop with a real mouse. Headless screenshots can't drag; the drop logic shares `move()` with "Move to…", which was checked.

**Not wired yet (Phase 2):**
- The `applications` table, the server action, and EXP from `exp_events`.
- The +20 confirm reward checked against the click log and a minimum time.

## W9. Profile and share card: 2026-11-09

Review-only URL switches: `?mode=`, `?state=new`, and `?edit=1` (the editor).

| Check | Result |
| ----- | ------ |
| What to do next in 3 seconds? | Yes. The character card, then one primary button: "Edit character sheet" (or "Edit profile"). |
| One clear primary action? | Edit. Sharing is a secondary button on phones and a side panel on desktop. |
| 360px and 1280px | Pass. Phones: card, edit button, details, badges in a 2-column grid, Share, then Leaderboard, Settings, and Log out (wireframe decision 3). Desktop: content on the left, a sticky share panel on the right. The editor has a sticky Save and Cancel bar above the bottom nav on phones. |
| Loading, empty, error | Loading: skeleton. New user: 0 badges with "Your first one comes when you confirm your first application", and "Not shared" for status and school. Editor errors show after Save; focus moves to the field or the skill search. Image export failure says to use Copy text. |
| All three modes | Full: "Character sheet", avatar, streak, badges, share. Light: "Profile", no avatar or streak, badges and share kept. Plain: "Profile", details only, no stats, badges, or share. Checked at 360px in all three and at 1280px in Full and Light. |
| Reduced motion | No motion added. |
| Copy human and encouraging? | Locked badges say how to earn them. The share panel says nothing is posted for you. |
| Contrast and keyboard | The card preview is real text, readable by screen readers. Share options are native checkboxes. Opening the editor moves focus to its heading. Badge state is written ("Locked ·"), not shown by color alone. |

**Privacy:** no public profile pages (decision #69). The share card links to the home page. Image and text are made on the device.

**Fixed during review:**
- A hydration error: the card read the site address during render, so the server and browser disagreed. It's now read after hydration.
- The earned "Follow-through" badge icon was invisible on the dark panel (decision #72).
- The username on the card preview broke in the middle of a word.

**Not wired yet:** saving the profile (Phase 1), log out (Phase 1), real badges (Phase 3), and the real domain on the card. It shows whatever host the site runs on.

## W11. Settings: 2026-11-09

| Check | Result |
| ----- | ------ |
| What to do next in 3 seconds? | Yes, though Settings has no single main action. Sections run in the wireframe's order, and a section list sits on the left on desktop. |
| One clear primary action? | Not needed. Each change saves on its own with a toast (decision #73). Delete is set apart in a red box at the bottom. |
| 360px and 1280px | Pass after a fix. Phones: a back link to Profile, then one column. Desktop: a section list and the settings side by side. |
| Loading, empty, error | Loading: skeleton. No recovery method: the row says "Not set up" in red with an icon, and the sheet explains the risk. Forms show errors after submit. |
| All three modes | Full: every game switch. Light: one line explaining that streaks, the leaderboard, and notes are Full Quest only. Plain: no Game section. Switching play style takes effect on the page right away. |
| Reduced motion | The Animations switch drives the same reduce rules as the OS setting, and says when the OS already asks for it (decision #74). |
| Copy human and encouraging? | "Show me on the leaderboard" explains both states. Delete lists exactly what goes. |
| Contrast and keyboard | Switches are `role="switch"` buttons that also write On or Off as text. Play style uses native radios. All account actions open native-dialog sheets. Delete stays disabled until the username is typed. |

**Privacy and security:**
- Download my data excludes passwords and code hashes (unit-tested).
- The recovery email is masked.
- Password fields never store their values.
- New recovery codes replace the old ones and must be marked as saved before closing.

**Fixed during review:** the recovery row's value was cut off on phones ("Recovery co…"). It now says "Codes".

**Not wired yet (Phase 1 and 3):**
- Username, password, recovery, and delete as server actions.
- Delete must cascade to every user-owned row.
- Settings saved to `user_settings`.
- The Game switches don't yet change the other screens (they only update this page).
- Sound isn't built yet: the switch exists, but there are no sounds.

## W8. Tips (index and guides): 2026-11-09

Review-only URL switches: `?mode=` and `?state=new`.

| Check | Result |
| ----- | ------ |
| What to do next in 3 seconds? | Yes. "Up next for you" names the reason ("Interview at Ilaw Robotics, Thu, Nov 12 · 10:00 AM") and links to the right guide, which is also tagged in the list. |
| One clear primary action? | Index: the Up next button. Guide: read, then tick the checklist. |
| 360px and 1280px | Pass. Phones: back link, title, a collapsible "On this page", a 65-character text column, "Back to top", and no bottom nav. Desktop: table of contents and Print checklist on the left, text on the right. |
| Loading, empty, error | The text is static HTML, so there's no loading state. An unknown guide gives a 404. A new user is pointed to the resume guide. If storage is blocked, ticks still work for the visit. |
| All three modes | Full: pixel "Up next" panel, "+10 EXP (once)". Light: EXP text in the toast. Plain: plain panel, checklists kept with no EXP text. |
| Reduced motion | No motion added. |
| Copy human and encouraging? | Rejection is framed as practice ("It's still progress"). No percentage figures (test-enforced). Examples use local context: MOA, OJT hours, e-wallet scams. |
| Contrast and keyboard | Native checkboxes. The table of contents is real anchor links. A deep-link target is highlighted with a border and a tint, not only color. The guide text works without JavaScript. |

**Verified:** the server HTML contains the guide text and checklist. `/tips/resume#iot` lands on the IoT section. Ticking all 6 Application checklist items shows the done state.

**Fixed during review:** a hydration mismatch on every app screen. `data-shell={true}` rendered differently on the server and in the browser, so it's now `data-shell=""`. All 7 app pages were checked with no hydration errors.

**Not wired yet:** checklist progress and the +10 EXP on the server (Phase 3). Content can be refined in Phase 4.

## W12. Privacy notice: 2026-11-09

| Check | Result |
| ----- | ------ |
| What to do next in 3 seconds? | Yes. "The short version" answers the main question in 4 bullets. |
| 360px and 1280px | Pass. The 3-column table becomes one card per row on phones. A table of contents sits on the left on desktop. |
| Modes | Not applicable: a public page with no game elements. |
| Contrast and keyboard | The table has a caption, column headers, and row headers. Anchor links work in the table of contents. |

**Accuracy check against what's built:**
- Username-only sign-in, optional email.
- Masked email, download, and delete in Settings.
- Companies see totals only.
- City-only location.
- Device storage: the pending Apply prompt, checklist ticks, and onboarding progress.
- The AI helper sends only skills, the text you typed, and the listing snippet (SPEC §9).

**Open items before launch (marked in [brackets] on the page):**
- **Click-log retention (M9):** the page says 12 months, which is still a placeholder.
- **How long reports are kept.**
- **Supabase data region** and **the AI provider**.
- **A named privacy contact or Data Protection Officer.** The Data Privacy Act expects one for a real launch.
- **The age rule.** Senior high school work-immersion students are often under 18. Decide whether minors can sign up, and with what consent. ⚠ Legal risk.
- **A real legal review** before public launch.

## W10. Leaderboard: 2026-11-09

Review-only URL switches:
- `?mode=`
- `?state=new` (locked)
- `?state=hidden` (opted out)
- `?state=off` (turned off in Settings)

The URL also keeps `?period=all` and `?group=school`.

| Check | Result |
| ----- | ------ |
| What to do next in 3 seconds? | Yes. No action is needed. Your personal best leads ("You beat last week by 40 EXP and 2 applications."), and your row is always visible. |
| 360px and 1280px | Pass. One table at both sizes (Apps on phones, Applications on desktop). Your row sticks to the bottom of the screen when it's scrolled out of view, above the phone nav (decision #88). |
| Loading, empty, error | Loading: skeleton. Alone in your group: "You're the first one here this week." No school set: the school option says "add it in Profile". Locked below Level 3, turned off, and Light or Plain each explain why and give one link (decision #90). |
| All three modes | Full only. Light and Plain show a short notice with "Change play style". Checked at 360px. |
| Reduced motion | No motion. |
| Copy human and encouraging? | You're compared only with your own last week (decision #89). Lower than last week reads "…and resting is fine too." People without EXP this week aren't listed, so nobody is "last" for resting (decision #87). |
| Contrast and keyboard | A real table with a caption and column headers, and your row is marked `aria-current`. The period switch is the shared Tabs (arrow keys work). The personal best is announced politely. |

**Privacy:**
- Usernames only.
- Opted-out users never appear to others and see their own row as "Only you can see this" (tested).
- The page is never indexed.

**Fixed during review:**
- In the locked state, "+20 EXP" wrapped onto two lines and the "3" in "Unlocks at Level 3" dropped to its own line.
- The back link said "Character" in Light mode.

**Not wired yet (Phase 3):**
- The server-side `weekly_exp` ranking, the Monday reset job, and last week's totals.
- "Hide me" saving to `user_settings`.
- The real level curve for "EXP away".
