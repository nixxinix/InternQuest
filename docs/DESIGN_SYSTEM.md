# INTERNQUEST: Design System (Design Brief, Step 3)

Date: 2026-11-09. Direction B, Pocket Console. To see every component live,
run `npm run dev` and open `/styleguide`; it has a Full / Light / Plain switch
and an Animations toggle.

## Where things live

| What | File |
| ---- | ---- |
| All tokens (the Tailwind config: Tailwind v4 is configured in CSS) | `src/app/globals.css` (`@theme`) |
| Fonts (self-hosted by next/font) | `src/app/layout.tsx` |
| Mode words and features | `src/lib/game/mode.ts` |
| Bar math, match labels | `src/lib/game/progress.ts` |
| Contrast math | `src/lib/design/contrast.ts` |
| Plain UI components | `src/components/ui/` |
| Game components (never used on company or admin screens) | `src/components/game/` |
| Mode and motion provider | `src/components/providers/GameModeProvider.tsx` |

## Tokens

**Colors (8 core):** `bezel`, `canvas`, `screen`, `ink`, `muted`, `lime`,
`green`, `alert`. **Derived state shades:** `bezel-raised`, `bezel-text`,
`bezel-track`, `green-press`, `green-tint`, `alert-tint`, `line`.

**Rules (enforced by `tests/tokens.contrast.test.ts`):**
- Every text and background pair in use passes WCAG AA (4.5:1). Control
  borders and focus rings pass 3:1.
- `lime` only appears on `bezel` or `bezel-raised`. It is about 1.3:1 on light
  surfaces.
- `line` is only for decorative dividers. Input borders use `muted`.

**Type:** Inter for everything people read (body text 16px minimum).
Silkscreen (`font-pixel`, always uppercase) for short HUD items only, at
`text-hud-sm` 12px, `text-hud` 16px, `text-hud-lg` 24px, and `text-hud-xl`
40px (the level-up number).

**Spacing:** Tailwind's 4px scale, plus `gutter` (16px page sides),
`section` (24px), and `tap` (44px minimum touch target: `min-h-tap`,
`size-tap`).

**Shape:** square corners everywhere (all radii removed). `px-frame` and
`px-frame-raised` draw stepped pixel corners for game panels.

**Shadows:** `shadow-raised` (hard 4px offset), `shadow-bevel` (console button
edge), and `shadow-bevel-pressed`. No blur anywhere.

**Motion:** `--motion-instant` 80ms, `fast` 150ms, `base` 240ms, `reward`
600ms, and `max` 900ms (SPEC: under about 1 second). `--ease-snap` for UI,
`steps()` for pixel effects. The OS reduced-motion setting and the in-app
toggle (`data-motion="reduce"`) both turn all motion off.

**Mode variants:** `mode-full:`, `mode-light:`, `mode-plain:`, and
`mode-game:` (Full or Light).

## Components

| Component | Notes |
| --------- | ----- |
| `Button`, `ButtonLink`, `IconButton` | primary (console bevel), secondary, ghost, danger, hud (bezel only). 44px minimum. Loading state blocks double submits. |
| `Card` | screen, bezel, or sunken. Square, with no pixel frame by default. |
| `Tag` | verified, source, deadline, neutral, hud. Meaning is always in the text. |
| `SkillChip` | matched (tint + check), missing (dashed + plus). Never color alone. |
| `SegmentBar` | the pixel "HP bar". Decorative; always paired with a text value. |
| `ListingCard` (+ skeleton) | whole card is a link; Save is a separate button. Shows the skills fit without opening. |
| `MatchPanel` | score, "why this matched" (4 weighted parts), matched, missing with 1 to 2 free resources, Quick prep. |
| `ExpBar` | progressbar role with text value. Counts up only in Full Quest, only upward. |
| `LevelUpDialog` | Full Quest only. Native `<dialog>`: focus trap, Escape, tap outside. |
| `Badge` | earned on the bezel, locked dashed with "Locked" text. Hidden in Plain. |
| `StreakFlame` | Full Quest only. Screen reader label includes the rest week. |
| `Avatar` | 12x12 sprite, integer scale, skin and hair presets. |
| `HudHeader` | Full: avatar, name, level, EXP, streak. Light: wordmark, level, EXP. Plain: wordmark. |
| `QuestLogCard` | status, date, "Did you apply?" inline, next-step hint, "Move to…" sheet with result outcomes. |
| `Tabs` | WAI-ARIA tabs with arrow keys. Equal width with stacked counts on phones. |
| `TextField`, `PasswordField`, `SelectField`, `Checkbox`, `ChipPicker` | label, hint, error linked by aria-describedby. 16px text (no iOS zoom). |
| `Toast` (`ToastProvider`, `useToast`) | bezel panel above the bottom nav. EXP chip only in game modes. Pauses on hover and focus. Undo action. |
| `Sheet` | bottom sheet on phones, dialog from 640px. |
| `EmptyState`, `ErrorState` | say why, never blame, one next step. |
| `BottomNav` | bezel, mode-aware labels, hidden from 1024px up. |
| `PixelIcon` (+ `sprites.ts`) | text-grid sprites rendered as small SVGs. 20 icons; no icon font or image files. |

## Self-review (Brief §5) for the component set

Checked with headless Edge screenshots at 360px and 1280px, in all three
modes, plus the level-up card, sheet, and toast opened.

- **360px and 1280px:** pass after fixes. The quest log tabs were clipped at
  360px, so they're now equal-width with stacked counts. The streak label
  wrapped, so it's now no-wrap. The EXP bar stretched across the 1280px header,
  so it's now capped at 384px.
- **Modes:** Plain has no EXP, badges, streak, or game words, and keeps the
  bezel frame. Light shows only the wordmark, level, and EXP.
- **Rewards:** found and fixed the EXP counting *down* after a level-up. Only
  one reward shows at a time (the level-up card replaces the toast).
- **Contrast:** 32 automated token checks pass.
- **Reduced motion:** global CSS override plus the hook. Count-up is off when
  reduced. Visually confirmed only through the code path, not with the OS
  setting turned on.
- **Not verified yet:** a real screen reader pass (NVDA or TalkBack) and a
  full keyboard walk-through on a real device. Those happen per screen in
  Step 5.
