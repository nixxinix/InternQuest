# DESIGN BRIEF: UI and Flow Ownership

You own the UI design and the user flow of INTERNQUEST. The requirements are in
`docs/SPEC.md`. This brief tells you what I care about and how to work. I am
not giving you screens to copy. I am giving you goals, limits, and a process.
Make the design as good as you can, and show your reasoning.

## 1. What the design must achieve
1. A first-time visitor understands what the site does within 5 seconds and
   sees real, relevant listings before being asked to sign up.
2. Finding a match, checking the skills fit, and applying takes as few taps as
   possible, on a phone.
3. The game layer motivates people who like games, and never blocks or
   annoys people who do not. Light and Plain modes must feel designed, not
   like broken leftovers.
4. Job hunting is stressful. The tone is encouraging, human, and never shaming.
5. It looks like a real product with a clear personality, not a template.

## 2. Non-negotiables
- Pixel-game style is a LAYER on a clean readable base (see SPEC section 11).
- Mobile-first, equally good on desktop.
- Listing text, forms, and tips stay calm and highly readable.
- Companies and admin screens have no game elements.
- Accessibility: strong contrast, keyboard use, screen reader labels,
  reduced-motion support, no color-only meaning.
- Light on data and CPU. Many users have older phones and weak connections.

## 3. Avoid the generic AI look
Do not use: purple-to-blue gradients, glassmorphism everywhere, identical
rounded cards on every screen, stock hero sections with vague slogans,
emoji as icons, lorem ipsum, or copy like "Unlock your potential."
Do use: a limited palette with one strong accent, a consistent pixel icon set,
real sample content (realistic internship titles, companies, Philippine
locations), distinct spacing and typography choices, and specific, playful but
respectful microcopy.

## 4. How to work (follow this order)
Step 1. User flows. Write the main journeys as short step lists: first visit,
sign up and onboarding, find and apply, track in the quest log, prepare with
tips (resume and interview), level up, post a listing as a company, admin
review. Point out any friction and fix it.
Step 2. Design directions. Propose 2 distinct visual directions (name, palette,
fonts, mood, one example screen in rough HTML or ASCII each) and recommend one.
STOP and wait for my choice.
Step 3. Style foundation. Design tokens (colors, type scale, spacing, borders,
shadows, motion timings) in the Tailwind config, plus a component set: button,
card, listing card, Match Panel, EXP bar, level-up screen, badge, streak flame,
quest log card, tabs, form fields, toasts, empty and error states.
Step 4. Wireframes. Low-fidelity layouts for each screen in SPEC section 11,
mobile and desktop. STOP and wait for my feedback.
Step 5. Build screens, one at a time, using the component set.
Step 6. Self-review (see section 5) before saying a screen is done.

## 5. Self-review checklist (run on every screen)
- Can a new user tell what to do next in 3 seconds?
- Is there one clear primary action?
- Does it work at 360px wide and at 1280px wide?
- Are loading, empty, and error states designed?
- Is text readable in all three modes (Full Quest, Light, Plain)?
- Does it follow reduced-motion settings?
- Is the pixel styling helping, or is it getting in the way of reading?
- Is the copy human, specific, and encouraging?
- Contrast and keyboard use checked?
If you can run a browser tool (for example Playwright), take screenshots at
360px and 1280px and critique them against this list. Fix problems before
reporting. If you cannot, say so and describe what you could not verify.

## 6. Decisions and checkpoints
- For any major design choice, give me 2 options with a recommendation and a
  short reason, then wait. Minor choices you decide yourself.
- Record each decision in `docs/DESIGN_DECISIONS.md`: date, decision, options
  considered, why. Keep it short.
- If a requirement in SPEC.md conflicts with good UX, tell me and propose a
  fix instead of silently changing it.
- Tell me if you think a requirement is missing. I would rather hear it.

## 6b. Flow ideas to evaluate (you may improve or reject these)
- Show real top matches on the landing page before sign-up, using a quick
  skill picker, then ask the user to create a character to save results.
- Apply flow: Apply opens the original posting in a new tab. When the user
  returns, a friendly "Did you apply?" prompt appears and rewards EXP.
- Quest log cards show next-step hints ("Prepare for your interview" linking to
  tips) when the status changes.
- Motivational notes change with activity and the chosen tone.
- A "Too much? Switch to Light mode" nudge in the first few sessions.

## 7. Done means
Each screen passes section 5, matches the design tokens, and is logged in
`docs/DESIGN_DECISIONS.md` where a choice was made.
