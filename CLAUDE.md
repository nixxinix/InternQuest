# CLAUDE.md

Project: INTERNQUEST (working name), a game-like internship finder.
Full requirements live in `docs/SPEC.md`. Read it before starting any task.

## What this is
A website that matches anyone who wants to intern (students, fresh grads,
career shifters) to internships near them, based on skills, interests, and
preferences. It has a game layer (EXP, levels, streaks, badges) that users can
turn down or off. Built first as a school project, later launched for real.

## Stack
- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres, row-level security, scheduled jobs)
- Vercel for hosting
- Framer Motion for reward animations, PWA for mobile install

## How to work
- Work on ONE phase at a time from `docs/SPEC.md` (section BUILD PHASES).
  Do not start the next phase until I say "next".
- Start every phase with a short plan and your assumptions. Ask me at most
  3 questions, and only if you are truly blocked. Otherwise assume and say so.
- Always write complete files. No "rest of the code here", no partial diffs
  in explanations. When you change a file, leave the whole file correct.
- After each task, give a 2 to 3 sentence casual summary of what changed.
- Add tests for the matching score, EXP, streak, and leaderboard logic.
- Run lint, type-check, and tests before saying a task is done.
- Flag any legal, privacy, cost, or security risk as soon as you see it.

## Conventions
- TypeScript strict mode. No `any` unless commented why.
- Keep business logic (matching, EXP, streaks) in `src/lib/` as pure
  functions so it is easy to test. Matching weights live in one config file.
- Database changes go in numbered SQL migration files in `supabase/migrations/`.
- Environment variables go in `.env.local` and are documented in
  `.env.example`. Never commit real keys.
- Content for Tips pages lives as markdown in `content/tips/`.
- UI: mobile-first. Pixel style is a layer on top of a clean readable base.
  Design tokens (colors, fonts, spacing) are defined once in the Tailwind config.

## Hard rules
- Username + password sign-in only. Do not require an email or real name.
- EXP, streaks, and leaderboard are calculated on the server only. Never trust
  the client for rewards.
- Only show a short snippet of listings from outside APIs, plus a link back.
- Never expose API keys to the browser. AI calls happen on the server only.
- Users must be able to delete their account and data.
- Companies and admin screens have no game elements.

## Definition of done (for any task)
- Works on a phone-sized screen and a desktop screen
- Handles loading, empty, and error states
- Keyboard accessible, and respects reduced-motion settings
- Tests pass, and no secrets in the code
