# Contributing to InternQuest

Thanks for wanting to help. This is a small project, so the process is simple.

## Before you start

1. Read [SPEC.md](SPEC.md) and the "Hard rules" in [CLAUDE.md](CLAUDE.md). They protect users (server-side rewards, no API keys in the browser, account deletion, no game elements for companies or admin).
2. Open an issue first for anything bigger than a small fix, so we can agree on the approach.
3. Work is organized in phases (see the roadmap in the README). Pick up work from the current phase.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Making a change

- TypeScript strict mode. No `any` unless you comment why.
- Business logic (matching, EXP, streaks, leaderboard) goes in `src/lib/` as pure functions, with tests.
- Database changes go in a new numbered file in `supabase/migrations/`.
- Design tokens are defined once, in the `@theme` block of `src/app/globals.css`. Don't hard-code colors.
- Write complete files and keep the code readable.

## Definition of done

- Works at 360px (phone) and 1280px (desktop)
- Loading, empty, and error states are handled
- Keyboard accessible, and respects reduced-motion
- `npm run check` passes (lint, type-check, tests)
- No secrets in the code

## Pull requests

Keep them focused, say what changed and why, and add screenshots for UI changes (phone and desktop).

## Code of conduct

Be kind. Job hunting is stressful enough. Tone in this project is encouraging and never shaming, and that goes for how we talk to each other too.
