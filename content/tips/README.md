# Tips content

Markdown guides for the Tips pages (SPEC §8): `resume.md`, `application.md`,
and `interview.md`. They're parsed by `src/lib/content/markdown.ts`, a small
safe subset with no raw HTML.

## Format

```
---
title: Interview tips
summary: One line for the Tips index.
---

## Section title {#anchor}      shown in "On this page"
### Sub-section {#anchor}
Paragraph text, **bold**, [links](/tips/resume) (site paths, #anchors, or https only).
- bullet
1. numbered
> a callout (tip or example)
- [ ] a checklist item {#stable-id}
```

## Rules

- **Never rename an anchor** that other screens link to. The tests check them:
  `/tips/resume#<field id>` (Quick prep on every listing),
  `/tips/application#follow-up`, `/tips/interview#offer`, `/tips/interview#rejection`.
- **Checklist ids are saved per user.** Changing one resets that tick.
- **Friendly, clear language. No unverified statistics** (SPEC §8). A test
  blocks percentage figures.
- Anchors must be unique within a guide (the parser refuses duplicates).
