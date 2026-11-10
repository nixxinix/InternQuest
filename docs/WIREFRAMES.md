# INTERNQUEST: Wireframes (Design Brief, Step 4)

Date: 2026-11-09. Status: **waiting for your feedback.**
Low-fidelity layouts only: structure, order, and actions, not visual polish.
The visual style comes from `docs/DESIGN_SYSTEM.md`.

## Legend

```
####  bezel (dark console frame)        [[ Apply ]]  primary action (one per screen)
[ Save ]   secondary button             [=====-----] segmented bar (always with a text value)
{React}    matched skill chip           {+ MQTT}     missing skill chip (dashed)
( ) (o)    radio                        [ ] [x]      checkbox / toggle
~~~~~~~~   body text lines              <-  back      >  opens something
(F) (L) (P)  shown in Full / Light / Plain mode only
```

Phone wireframes are drawn at 360px. Desktop is 1280px. Between 640 and 1023px
the phone layout is used with wider gutters.

---

## W0. App shell

**Phone:** HUD header on top, bottom nav at the bottom, both on the bezel.
Child pages (listing detail, a tips guide) replace the bottom nav with their
own sticky action bar and show a back arrow.

```
+--------------------------------------+
|## [av] mika.codes       Lv 4   [fl] #|  Full: 80px. Collapses to 48px on scroll:
|## [==========--------] 340/500 3 wk #|  "Lv 4 [=====---]" in one row
+--------------------------------------+
|                                      |
|  page title                          |
|  content, 16px gutters               |
|                                      |
+--------------------------------------+
|## Home  Search  Quest log  Tips  Me #|  60px + safe area
+--------------------------------------+
  Light:  ## INTERNQUEST    Lv 4 [=====---] ##   (no avatar, no streak)
  Plain:  ## INTERNQUEST                    ##   (wordmark only)
```

**Desktop:** the bottom nav becomes a 240px left sidebar. The character
summary moves into the top of the sidebar, so there is no top bar and the
content starts higher.

```
+------------------+-------------------------------------------------------------+
|## INTERNQUEST   #|                                                             |
|##               #|  Page title                                                 |
|## [av] mika     #|                                                             |
|## Lv 4  3 wk    #|  content (max 1100px)                                       |
|## [=====----]   #|                                                             |
|## 340/500 EXP   #|                                                             |
|##---------------#|                                                             |
|## > Home        #|                                                             |
|##   Search      #|                                                             |
|##   Quest log   #|                                                             |
|##   Tips        #|                                                             |
|##   Leaderboard #|  (F) only, after Level 3                                    |
|##   Profile     #|                                                             |
|##   Settings    #|                                                             |
+------------------+-------------------------------------------------------------+
```

On phones, Leaderboard and Settings are reached from Profile, because the
bottom nav has 5 slots (SPEC §11).

---

## W1. Landing (first visit, logged out)

**Primary action:** pick skills. Results update live, with no submit button.
**The 5-second test:** the headline and real listings are both visible
without scrolling.

```
PHONE                                   DESKTOP
+--------------------------------------+ +--------------------------------------------------------------+
|## INTERNQUEST       [ Log in ]      #| |## INTERNQUEST                     [ For companies ] [ Log in ]#|
+--------------------------------------+ +--------------------------------------------------------------+
| Internships and OJT near you,        | | Internships and OJT near you, matched to your skills.        |
| matched to your skills.              | | No sign-up needed to look around.                            |
| No sign-up needed to look around.    | +-------------------------+------------------------------------+
|                                      | | 1. YOUR FIELD           |  24 matches · nearest first  [sort]|
| 1. Your field                        | | {Web}{IoT}{Data}{Design}| +--------------------------------+ |
| {Web}{IoT}{Data}{Design}{Business}   | | {Business}{HR}{Acctg}.. | | IoT Firmware Intern     3.2 km | |
| {HR}{Accounting}{Hospitality} more > | |                         | | Tanglaw Solar  v Verified      | |
|                                      | | 2. SKILLS (pick 2 to 5) | | [========--] 86% match         | |
| 2. Your skills (pick 2 to 5)         | | {Arduino}{C}{+Python}   | | {C}{Arduino}{Sensors} {+MQTT}  | |
| {x Arduino}{x C}{Python}{Sensors}    | | {+Sensors}{+MQTT}       | +--------------------------------+ |
| [ search skills...           ]       | | [search skills...    ]  | +--------------------------------+ |
|                                      | |                         | | Frontend Dev Intern     12 km  | |
| 3. City (optional)                   | | 3. CITY (optional)      | | ...                            | |
| [ Quezon City               ]        | | [Quezon City        ]   | +--------------------------------+ |
| [x] Remote is fine                   | | [x] Remote is fine      |                                    |
|                                      | |                         |  (sticky left column)              |
|+------------------------------------+| +-------------------------+------------------------------------+
|| [[ See 24 matches  v ]]            || |  Save a listing to create your character. Your picks come    |
|+------------------------------------+| |  with you.                                                   |
| Newest across the Philippines        | +--------------------------------------------------------------+
| +----------------------------------+ |
| | IoT Firmware Intern       3.2 km | |  Before any skill is picked, the list shows "Newest across
| | Tanglaw Solar   v Verified       | |  the Philippines" with no match bars, then re-ranks live.
| | Cubao, QC · Onsite · P500/day    | |
| | [========--] 86% match           | |
| | {C}{Arduino}  Missing: {+MQTT}   | |
| +----------------------------------+ |
| ...                                  |
+--------------------------------------+
```

- No bottom nav when logged out. The header holds Log in. On desktop there's
  also a "For companies" link.
- States: loading shows 3 skeleton cards. Empty shows "Nothing within 10 km
  yet" with [Turn on remote] and [Search all of PH]. Error shows "Listings
  didn't load" with [Try again], and the picker stays usable.

## W2. Onboarding (create your character)

The same centered card on every screen size (max 480px). It has a step
counter and a back arrow. Required steps: 1 and 3. Steps 2 and 4 have safe
defaults.

```
STEP 1: ACCOUNT                         STEP 2: RECOVERY (skippable)
+--------------------------------------+ +--------------------------------------+
| <-   Step 1 of 4                     | | <-   Step 2 of 4                     |
| Create your character                | | A way back in, if you forget         |
| Coming with you: 4 abilities, QC     | |                                      |
|                                      | | ( ) Add a recovery email             |
| Username                             | |     [ email                     ]    |
| [ mika.codes            ] v free     | | (o) Save 8 recovery codes            |
| Password                             | |     [ Download codes ] [ Copy ]      |
| [ ********           ] [eye]         | |                                      |
| At least 10 characters               | | Without either one, a forgotten      |
|                                      | | password can't be reset.             |
| [x] I agree to the privacy notice >  | |                                      |
|   We keep your username, skills,     | | [[ Continue ]]                       |
|   city and quest log. No real name.  | | [ Skip for now ]                     |
|                                      | +--------------------------------------+
| [[ Create character ]]               |
| Already have one? Log in             |
+--------------------------------------+

STEP 3: CHARACTER                       STEP 4: PLAY STYLE
+--------------------------------------+ +--------------------------------------+
| <-   Step 3 of 4                     | | <-   Step 4 of 4                     |
| [avatar preview, 96px]               | | How much game do you want?           |
| Look: (o)(o)(o)(o)(o)  hair (o)(o)   | |                                      |
|                                      | | (o) Full Quest   [mini preview]      |
| Class                                | |     EXP, levels, streaks, quests     |
| [ IoT & Embedded          v ]        | | ( ) Light        [mini preview]      |
| Abilities (from your picks)          | |     Just an EXP bar and badges       |
| {x Arduino}{x C}{x Sensors}{+ more}  | | ( ) Plain        [mini preview]      |
| City  [ Quezon City          ]       | |     Clean tracker, no game parts     |
| Work type ( )Onsite (o)Hybrid ( )Rem | |                                      |
| Status (optional) [ Student   v ]    | | You can change this anytime in       |
| School or group (optional) [      ]  | | Settings.                            |
|                                      | |                                      |
| [[ Continue ]]                       | | [[ Start my first quest ]]           |
+--------------------------------------+ +--------------------------------------+
```

- Errors appear inline under the field ("That username is taken. Try
  mika.codes2"). The form never clears what the user typed.
- In Plain mode, step 3 is titled "Your profile" and the avatar picker is
  hidden. Step 4 is where the user chooses, so it always shows.

## W3. Home

**Primary action:** the first top match (or the pending "Did you apply?" card,
if there is one).

```
PHONE (Full Quest, week 2)               DESKTOP (Full Quest)
+--------------------------------------+ +---------+--------------------------------------------------+
|## [av] mika.codes  Lv 4  [=====--] fl| |## side ##| Good to see you, mika.codes                      |
+--------------------------------------+ |##  bar  ##+--------------------------+-----------------------+
| +----------------------------------+ | |##       ##| QUESTS FOR YOU           | WEEKLY QUEST (bezel)  |
| | Did you apply to Tanglaw Solar?  | | |##       ##| +----------------------+ | Send 4 applications   |
| | [[ Yes, I applied ]] [ Not yet ] | | |##       ##| | IoT Firmware Intern  | | [#][#][#][ ]  3 of 4  |
| +----------------------------------+ | |##       ##| | ... 86% match        | | "One more and this    |
| +## WEEKLY QUEST #################+ | |##       ##| +----------------------+ |  week's quest is done"|
| ## Send 4 applications          ## | |##       ##| +----------------------+ +-----------------------+
| ## [#][#][#][ ]  3 of 4         ## | |##       ##| | Frontend Dev Intern  | | COMING UP             |
| ## One more and this week's     ## | |##       ##| +----------------------+ | Interview, Sari Studio|
| ## quest is done.               ## | |##       ##| +----------------------+ | Wed Nov 12, 10:00 AM  |
| +##################################+ | |##       ##| | HR Operations OJT    | | > Prepare             |
|                                      | |##       ##| +----------------------+ +-----------------------+
| Quests for you          See all >    | |##       ##| [ See all matches > ]    | CLOSING SOON (saved)  |
| +----------------------------------+ | |##       ##|                          | Data Analyst OJT  3d  |
| | IoT Firmware Intern (top match)  | | |##       ##|                          | UX Design Intern  Fri |
| | ... [========--] 86% match       | | +---------+--------------------------+-----------------------+
| +----------------------------------+ |
| (2 more cards)                       |
|                                      |
| Coming up                            |
| Interview · Sari Studio · Wed 10 AM >|
|                                      |
| Closing soon (saved)                 |
| Data Analyst OJT · Kalye   3 days  > |
| UX Design Intern · Sari    Fri     > |
+--------------------------------------+
|## Home  Search  Quest log  Tips  Me #|
+--------------------------------------+
```

- **New user (week 1):** the weekly quest card is replaced by the tutorial
  checklist: [ ] View your top match, [ ] Save a listing, [ ] Finish your
  character sheet, plus the bonus: confirm your first application. In the
  first 2 to 3 sessions (Full), a dismissible line underneath says "Too much?
  Switch to Light mode."
- **Light:** no weekly quest and no motivational note. Heading "Top matches".
- **Plain:** "Did you apply?", Top matches, Coming up, Closing soon. Nothing
  else.
- States: skeleton cards while loading. No matches yet: "Add 2 more skills to
  get better matches" [Edit skills]. Nothing saved: the Closing soon section
  is hidden (not shown empty).

## W4. Search results

**Primary action:** open a listing. Filters live in the URL.

```
PHONE                                   DESKTOP (list + detail panel)
+--------------------------------------+ +---------+--------------------------+------------------------------+
|## Lv 4 [=====---]          (compact)#| |## side ##| [search title, company ] | <- (panel)            [x]    |
+--------------------------------------+ |##  bar  ##| Radius[10km v] Type[All v]| IoT Firmware Intern         |
| [ search title, company...   ] [Q]   | |##       ##| [Allowance] [MOA] [More v]| Tanglaw Solar  v Verified   |
| [10 km v][Hybrid v][Allowance][More] | |##       ##| 24 results · best match v | Cubao, QC · Onsite · P500/d |
| 24 results          Sort: best match | |##       ##| +----------------------+ | [[ Apply ]] [ Save ]         |
| +----------------------------------+ | |##       ##| |> IoT Firmware Intern | | +-## SKILLS FIT ###########+ |
| | ListingCard                      | | |##       ##| |  86% ... (selected)  | | | [========--] 86% Strong  | |
| +----------------------------------+ | |##       ##| +----------------------+ | +--------------------------+ |
| +----------------------------------+ | |##       ##| | Frontend Dev Intern  | | | Why this matched ...     | |
| | ListingCard                      | | |##       ##| +----------------------+ | | Missing: {+MQTT} > guide | |
| +----------------------------------+ | |##       ##| | HR Operations OJT    | | +--------------------------+ |
| ...                                  | |##       ##| +----------------------+ | About this internship        |
| [ Load more ]                        | |##       ##| ...                      | ~~~~~~~~~~~~~~~~ (snippet)   |
+--------------------------------------+ |##       ##|                          | Safety: legit internships    |
|## Home  Search  Quest log  Tips  Me #| |##       ##|                          | never ask you to pay a fee.  |
+--------------------------------------+ +---------+--------------------------+------------------------------+
  [More] opens a filter sheet: work type,
  allowance (paid only), MOA available,
  hours, posted within, show remote.
```

- Desktop: clicking a card opens it in the right panel and updates the URL
  (`/search?...&open=l1`), so the back button and shared links work.
- States: skeletons. Empty with active filters: "No matches with these
  filters" [Clear filters], plus how many results each filter removed. Error
  shows [Try again].

## W5. Listing detail (phone; desktop is the W4 panel)

**Primary action:** Apply (sticky at the bottom).

```
+--------------------------------------+
|## <-  Quest              [share][⋮] #|   ⋮ = Report listing
+--------------------------------------+
| IoT Firmware Intern                  |
| Tanglaw Solar Systems  v Verified    |
| Posted directly · 5 days left        |
| Cubao, QC · 3.2 km · Onsite          |
| P500/day · 486 hours · MOA: yes      |
|                                      |
| +## SKILLS FIT ####################+ |
| ## [========--] 86% · Strong match ## |
| +----------------------------------+ |
| | Why this matched                 | |
| |  Skills    [====-] 3 of 3 req.   | |
| |  Distance  [=====] 3.2 km        | |
| |  Field     [=====] IoT & Embed.  | |
| |  Work type [==---] you prefer hyb| |
| | Abilities you have {C}{Arduino}..| |
| | Missing abilities                | |
| |  {+MQTT}  Article: MQTT Essent. >| |
| | > Quick prep: resume tips for IoT| |
| +----------------------------------+ |
|                                      |
| About this internship                |
| ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ |
| ~~~~~~~~~~~~~~~ (snippet only for    |
| aggregator listings)                 |
| [ Read the full posting > ]          |
|                                      |
| ! Legit internships never ask you to |
|   pay a fee. Report listing >        |
+--------------------------------------+
| [ Save ]          [[ Apply  > ]]     |   sticky; replaces the bottom nav
+--------------------------------------+
```

- An Apply button using email opens the mailto sheet (W6b) instead of a new
  tab.
- States: a closed or removed listing shows "This listing is closed" with
  [See similar listings], and Apply is disabled. Error shows [Try again].

## W6. Sheets (apply and report)

```
a) DID YOU APPLY? (on return)           b) APPLY BY EMAIL                     c) REPORT LISTING
+--------------------------------------+ +----------------------------------+ +----------------------------------+
| Did you send your application to     | | Apply by email                   | | What's wrong with this listing?  |
| Tanglaw Solar Systems?          [x]  | | hr@tanglaw.ph        [ Copy ]    | | ( ) Asks for payment or fees     |
| We'll move it to Applied.            | | Subject: OJT application:        | | ( ) Looks fake or a scam         |
|                                      | |  IoT Firmware Intern [ Copy ]    | | ( ) Closed or expired            |
| [[ Yes, I applied ]]                 | | Tip: attach your resume as PDF.  | | ( ) Wrong details                |
| [ Not yet ]                          | |                                  | | ( ) Something else [         ]   |
+--------------------------------------+ | [[ Open email app ]]             | | [[ Send report ]]                |
  Yes: card to Applied, reward by mode   | > Cover letter tips              | | We review every report. You      |
  (toast / level-up queued after close)  +----------------------------------+ | won't be named to the company.   |
                                                                              +----------------------------------+
```

## W7. Quest log

**Primary action:** the next step on the most urgent card ("Did you
apply?", then upcoming interviews).

```
PHONE                                   DESKTOP (board)
+--------------------------------------+ +---------+---------------+---------------+---------------+---------------+
|## [av] mika  Lv 4 [=====---]        #| |## side ##| SAVED 2       | APPLIED 5     | INTERVIEW 1   | RESULT 3      |
+--------------------------------------+ |##  bar  ##| +-----------+ | +-----------+ | +-----------+ | +-----------+ |
| Quest log                            | |##       ##| | IoT Firm. | | | Data An.  | | | UX Design | | | Offer:    | |
| +--------+---------+--------+------+ | |##       ##| | Did you   | | | Nov 3     | | | Wed 10 AM | | | Bayanihan | |
| | Saved  | Applied |Interview|Result| | |##       ##| | apply?    | | | > Follow- | | | > Prepare | | +-----------+ |
| |   2    |    5    |    1    |  3   | | |##       ##| | [Yes][No] | | |   up msg  | | +-----------+ | | No reply  | |
| +--------+---------+--------+------+ | |##       ##| +-----------+ | +-----------+ |               | +-----------+ |
| +----------------------------------+ | |##       ##| | Frontend  | | | ...       | |               |               |
| | Data Analyst OJT                 | | |##       ##| [Move to v]  | drag cards between columns, or use [Move to v]  |
| | Kalye Logistics · Applied Nov 3  | | +---------+---------------+---------------+---------------+---------------+
| | > Follow-up message you can send | |
| | [ Move to... ]                   | |   Tap a card: sheet with notes, interview date,
| +----------------------------------+ |   and the original posting link.
| ...                                  |
| [ + Add one I applied to elsewhere ] |   (tracking only, no EXP: decision #18)
+--------------------------------------+
|## Home  Search [Quest log] Tips  Me #|
+--------------------------------------+
```

- Plain: the page is titled "Applications" and the header shows the wordmark
  only.
- States: an empty tab shows a reason and one action ("Nothing saved yet"
  [Find listings]). Errors show a toast with [Try again], and the change is
  rolled back.

## W8. Tips (index and guide page)

**Primary action (index):** open the guide for your current stage, which is
highlighted. **Guide page:** read, then tick the checklist.

```
INDEX (phone)                           GUIDE PAGE (desktop: table of contents on the left)
+--------------------------------------+ +---------+---------------------+--------------------------------------+
|## ... HUD ...                       #| |## side ##| ON THIS PAGE        | Interview tips                       |
+--------------------------------------+ |##  bar  ##| > Before the day    | 8 min read · Checklist 3 of 9        |
| Tips                                 | |##       ##|   Research the comp.|                                      |
| +## Up next for you ###############+ | |##       ##|   Common questions  | Before the day                       |
| ## Interview at Sari Studio, Wed ## | |##       ##|   STAR method       | ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ |
| ## > Interview tips            ## | |##       ##|   Questions to ask  | ~~~~~~~~~~~~~~~~~~~~~ (65ch column)  |
| +##################################+ | |##       ##|   Online interviews |                                      |
| +----------------------------------+ | |##       ##|   What to wear      | STAR method                          |
| | Resume tips          checklist 4/10| |##       ##|   Follow-up message |  Situation · Task · Action · Result  |
| | One page, projects, ATS-friendly | | |##       ##|   If it's a no      | ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ |
| +----------------------------------+ | |##       ##|                     |                                      |
| | Interview tips        checklist 3/9| |##       ##| [ Print checklist ] | Checklist                            |
| +----------------------------------+ | |##       ##|                     | [x] Researched the company           |
| | Application tips     checklist 0/6| |##       ##|                     | [ ] Prepared 3 STAR stories          |
| +----------------------------------+ | |##       ##|                     | ...  (finish: +10 EXP once)          |
+--------------------------------------+ +---------+---------------------+--------------------------------------+
```

- Phone guide page: "On this page" is a collapsible list at the top, with a
  sticky "Back to top" button. There's no bottom nav on guide pages; a back
  arrow goes to Tips.
- Plain: checklists stay (they're useful) but give no EXP text.

## W9. Profile (character sheet) and share card

**Primary action:** edit profile. The share card is secondary.

```
PHONE (Full)                            DESKTOP
+--------------------------------------+ +---------+--------------------------------+----------------------------+
|## ... HUD ...                       #| |## side ##| +## mika.codes ##############+ | Share card                 |
+--------------------------------------+ |##  bar  ##| ## [avatar 96]  Lv 4      ## | +##########################+|
| +## [avatar 96]  mika.codes #######+ | |##       ##| ## IoT & Embedded · Student## | ## mika.codes   Lv 4     ##|
| ## Lv 4 · IoT & Embedded         ## | |##       ##| ## [=======---] 340/500   ## | ## 12 applications       ##|
| ## [=======---] 340/500 EXP      ## | |##       ##| +############################+ | ## 3-week streak         ##|
| ## Applications 12 · Streak 3 wk ## | |##       ##| Abilities  {Arduino}{C}{...}   | ## internquest.ph        ##|
| +##################################+ | |##       ##| City: Quezon City · Hybrid     | +##########################+|
| [[ Edit character sheet ]]           | |##       ##| School: T.I.P. Quezon City     | Show: [x]Level [x]Apps     |
|                                      | |##       ##| Badges [*][#][ locked ]  >     |       [x]Streak [ ]EXP     |
| Abilities  {Arduino}{C}{Sensors} +2  | |##       ##| [[ Edit character sheet ]]     | [ Download image ][ Copy ] |
| City Quezon City · Hybrid            | +---------+--------------------------------+----------------------------+
| Status Student · T.I.P. Quezon City  |
| Badges [*][#][ ]  See all >          |
| [ Share my progress > ]              |
| ---------------------------------    |
| Leaderboard >                        |   (Full only, after Level 3)
| Settings >                           |
| Log out                              |
+--------------------------------------+
```

- Light: no avatar or streak. The stats line shows Level, EXP and Badges.
- Plain: titled "Profile". Shows skills, city, work type, status, and school,
  with no game card. "Share my progress" is hidden.

## W10. Leaderboard (Full Quest, Level 3 and up)

**Primary action:** none needed. The page is for looking at your place. The
personal best leads, so it's never just a rank.

```
PHONE                                   DESKTOP
+--------------------------------------+ +---------+------------------------------------------------------+
|## ... HUD ...                       #| |## side ##| Leaderboard          [This week | All time]            |
+--------------------------------------+ |##  bar  ##| Group: [Overall v]  Resets Monday, Manila time       |
| Leaderboard                          | |##       ##| +-------------------------------------------------+  |
| [ This week ][ All time ]            | |##       ##| | You beat last week by 40 EXP and 2 applications |  |
| Group: [ Overall        v ]          | |##       ##| +-------------------------------------------------+  |
| +## You beat last week by 40 EXP ##+ | |##       ##|  #   Username          EXP this week  Applications |
| ## and 2 more applications.      ## | |##       ##|  1   kape.coder        310            6            |
| +##################################+ | |##       ##|  2   ...                                           |
|  1  kape.coder        310 EXP · 6 ap | |##       ##| >14  mika.codes (you)  180            4            |
|  2  jun.builds        290 EXP · 5 ap | +---------+------------------------------------------------------+
|  ...                                 |
| 14  mika.codes (you)  180 EXP · 4 ap |   your row is pinned at the bottom if you're off-screen
| Resets Monday, Manila time           |
| [ Hide me from the leaderboard ]     |
+--------------------------------------+
```

- **Locked (below Level 3):** "Unlocks at Level 3. You're 60 EXP away," with
  ideas for earning EXP. No list is shown.
- **Opted out:** you see the board and your personal best, and your row is
  marked "Only you can see this."
- Hidden in Light and Plain. Turning the leaderboard off in Settings hides it
  everywhere.
- Empty (a new group): "You're the first one here this week."

## W11. Settings

**Primary action:** none. Each change saves on its own and shows a "Saved"
toast.

```
PHONE                                   DESKTOP: same sections in a 2-column grid (section list left, settings right)
+--------------------------------------+
| <- Settings                          |
| PLAY STYLE                           |
| (o) Full Quest  ( ) Light  ( ) Plain |
| GAME                     (F)(L) only |
| Weekly streaks              [on ]    |
| Leaderboard                 [on ]    |
| Show me on the leaderboard  [on ]    |
| Motivational notes  [Cheerful v]     |   cheerful / calm / off
| MOTION AND SOUND                     |
| Animations                  [on ]    |   off = same as reduced motion
| Sound                       [off]    |
| ACCOUNT                              |
| Username      mika.codes        >    |
| Password                        >    |
| Recovery email / codes          >    |
| PRIVACY                              |
| Download my data                >    |   (missing requirement M7, below)
| Privacy notice                  >    |
| ------------------------------------ |
| [ Delete my account ]   (danger)     |   type your username to confirm
+--------------------------------------+
```

## W12. Privacy page (public, no game elements)

```
+--------------------------------------+
|## INTERNQUEST                       #|
+--------------------------------------+
| Privacy notice                       |
| Updated Nov 2026 · 4 min read        |
|                                      |
| The short version                    |
| +----------------------------------+ |
| | What we keep | Why    | How long | |
| | Username     | log in | until you| |
| | Skills, city | match  | delete   | |
| | Quest log    | track  | ...      | |
| | Apply clicks | stats  | 12 months| |
| +----------------------------------+ |
| We never need your real name or      |
| email. ...                           |
| Your rights (Data Privacy Act)       |
| ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ |
| Contact: [privacy contact]           |
+--------------------------------------+
  Desktop: the same 65ch column, centered, with a table of contents on the left.
```

## W13. Company: register, dashboard, post form (no game elements)

The bezel header says "InternQuest for companies". There's no HUD, no EXP,
no pixel font, and no game words.

```
DASHBOARD (phone)                       POST FORM (desktop: form left, live preview right)
+--------------------------------------+ +----------------------------------------------------------------------+
|## INTERNQUEST for companies  [menu] #| |## INTERNQUEST for companies          Tanglaw Solar  [Account v]     #|
+--------------------------------------+ +-------------------------------------------+--------------------------+
| ! Under review. We'll email you when | | New listing                               | How interns will see it  |
|   you're approved. You can draft     | | Title        [ IoT Firmware Intern     ] | +----------------------+ |
|   listings now.                      | | Field        [ IoT & Embedded        v ] | | ListingCard preview  | |
| [[ + New listing ]]                  | | Description  [ ~~~~~~~~~~~~~~~~~~~~~~~ ] | | with a sample match  | |
| [Active 2][Drafts 1][Closed 4]       | | Skills       {C *req}{Arduino *req}     | | for a typical intern | |
| +----------------------------------+ | |              {MQTT nice} [+ add skill]  | +----------------------+ |
| | IoT Firmware Intern     Active   | | | Location     [ Cubao, Quezon City     ] | Checklist                |
| | 128 apply clicks · closes Nov 20 | | | Work type    (o)Onsite ( )Hybrid ( )Rem  | [x] Title                |
| | [ Edit ] [ Close listing ]       | | | Allowance    (o)Amount [P500/day] ( )None| [x] Skills (3)           |
| +----------------------------------+ | | OJT hours    [ 486 ]  MOA [x] can sign   | [ ] Deadline             |
| ...                                  | | Start date   [ Jan 6 ] Deadline [ Nov 20]| [x] Apply method         |
+--------------------------------------+ | Apply by     (o)Link [https://...]       |                          |
                                         |              ( )Email [hr@tanglaw.ph]    |                          |
REGISTER: company name, work email,      | [ Save draft ]   [[ Publish ]]            |                          |
password, your role. A free-email domain +-------------------------------------------+--------------------------+
is blocked with one plain sentence.
Then: "Check your email" screen.         Publish is disabled until approved: "Saved as draft.
                                         It goes live when your company is approved."
```

## W14. Admin queue (no game elements; desktop first, works on phones)

**Primary action:** decide the item that's open.

```
DESKTOP
+----------------------------------------------------------------------------------------------+
|## INTERNQUEST admin                                       [Import CSV] [Audit log]  [Log out]#|
+------------------------------+---------------------------------------------------------------+
| [Companies 3][Reports 5][Flagged 1]                                                          |
| +--------------------------+ | Tanglaw Solar Systems                                         |
| |> Tanglaw Solar  2h ago   | | hr@tanglaw.ph · tanglaw.ph                                    |
| |  Kalye Logistics  1d ago | | Checks:  v Email confirmed   v Domain matches website         |
| |  ...                     | |          v Website loads     - No DTI/SEC number given        |
| +--------------------------+ | Draft listings: 1 (preview >)                                 |
|                              | [[ Approve ]]   [ Reject: [reason v] ]                        |
|                              | Every action is logged with your reason.                      |
+------------------------------+---------------------------------------------------------------+
PHONE: the list is full width; tapping an item opens the decision screen with a back arrow.
Reports: listing preview, reason, count -> [Hide listing] [Dismiss] [Suspend company]
Flagged: user, pattern ("30 confirmations in 1 hour") -> [Clear] [Reverse EXP] [Suspend]
Empty queue: "All caught up."
```

---

## Decisions made while wireframing (minor, logged)

1. **Desktop:** the character summary sits at the top of the left sidebar and
   there's no top bar, which saves vertical space.
2. **Phone child pages** (listing detail, guide pages) swap the bottom nav for
   a sticky action bar with a back arrow.
3. **Phone access to Leaderboard and Settings** is from Profile (5-slot nav
   limit). Desktop has them in the sidebar.
4. **Desktop search** opens listings in the right panel, with the selection in
   the URL.
5. **Home hides empty sections** (for example Closing soon with nothing saved)
   instead of showing empty boxes.
6. **Company and admin pages** keep the bezel as the brand header but drop
   everything else game-related.

## New gaps found (please confirm)

- **M7. Download my data:** the Data Privacy Act gives users a right to
  access their data. I added "Download my data" (a JSON or CSV export) to
  Settings. Recommend: yes.
- **M8. School grouping:** "school or group" is free text, so the same school
  would split into "TIP QC", "T.I.P. Quezon City", and "tip". The
  leaderboard's school grouping needs a fixed list. Options:
  - **(a, recommended)** a curated list of schools to pick from, with "Other"
    falling back to Overall.
  - **(b)** join codes that a teacher or group leader shares.

  (a) needs no extra admin work from you beyond seeding the list once.
- **M9. Click log retention:** I wrote "12 months" on the privacy page as a
  placeholder. Pick a real retention period before launch.
