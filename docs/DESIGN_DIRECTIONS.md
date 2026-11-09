# INTERNQUEST: Design Directions (Design Brief, Step 2)

Date: 2026-11-09. Status: **B, Pocket Console, chosen**, with two fixes
applied (see "Chosen direction" at the end).

Live preview: open `docs/directions/compare.html` in a browser. Both phones use
the same markup, so the only difference is the styling. Each phone has a
Full Quest / Light / Plain switch and a "Simulate" button that shows how
reward feedback changes by mode.

Both directions follow the same rules:
- 8 color tokens, one strong accent.
- The pixel font is only used for game elements and headings. All listing text,
  forms, and tips use a readable sans-serif.
- Listing cards are calm. The pixel touch on a card is limited to the match bar.
- The match level is always written out as a number ("86% match"), and missing
  skills have a "Missing" label plus a dashed outline. Nothing is shown by
  color alone.
- Press Start 2P is rejected for both. It is very wide and hard to read at the
  12 to 14px sizes the header needs.

---

## Direction A: Field Manual (recommended)

**Mood:** a well-loved RPG strategy guide or a school field notebook. Warm,
tactile, a bit nostalgic. Ink lines on paper, with one bright mango highlight
for anything that is "yours" (EXP, progress, the active tab).

**Fonts:** Pixelify Sans (game elements and headings; readable in mixed case,
works at 14px) + DM Sans (everything else; warm, open shapes, good on low-DPI
screens).

**Palette** (contrast checked against WCAG 2.1):

| Token   | Hex       | Role                          | Contrast                      |
| ------- | --------- | ----------------------------- | ----------------------------- |
| paper   | `#F6F1E7` | page background               | –                             |
| surface | `#FFFDF8` | cards, header, nav            | –                             |
| ink     | `#1F1A14` | text, pixel borders, shadows  | 15.3:1 on paper               |
| muted   | `#5E554A` | secondary text, input borders | 6.5:1 on paper                |
| line    | `#D9CFBF` | hairline dividers only        | decorative                    |
| mango   | `#F4A51C` | THE accent: EXP, progress, primary button fill | ink on mango 8.4:1 |
| leaf    | `#2B7448` | matched skills, verified, success | 5.1:1 on paper            |
| brick   | `#B3412E` | deadlines, errors             | 5.0:1 on paper                |

Rule: mango is only 1.8:1 on paper, so it is **never** used for text or for a
bare shape on paper. It always carries ink text or sits inside an ink border.

**Pixel treatment:** 2 to 3px ink borders with stepped corners, a 5px hard ink
shadow on game panels and primary buttons, and segmented ticks on the EXP bar.
Listing cards keep a 1px hairline with no shadow, so they stay calm. The top
match gets a 4px ink edge.

**Modes:**
- Full Quest: avatar, EXP bar, streak flame, weekly quest panel, quest vocabulary.
- Light: EXP bar and level only, plain vocabulary, small toasts.
- Plain: same paper and ink with the brand name in the header; headings switch
  to DM Sans. It looks like a calm, finished product, not a stripped one.

```
+------------------------------------+
| [AVATAR] mika.codes      Lv 4  [F] |
|          [#####|#####|##    ]  3WK |
|          340 / 500 EXP             |
+====================================+  <- 3px ink rule
|  +==============================+  |
|  | Weekly quest                 |# |  <- ink border + hard shadow
|  | Send 4 applications          |# |
|  | [#][#][#][ ]  3 of 4         |# |
|  | One more and this week's     |# |
|  | quest is done.               |# |
|  +==============================+# |
|   ################################ |
|  Quests for you        (pixel font)|
|  +-------------------------------+ |
|  || IoT Firmware Intern   3.2 km  | |
|  || Tanglaw Solar  [v] Verified   | |
|  || Cubao, QC · Onsite · Allowance| |
|  || [##########====]  86% match   | |
|  || [v C] [v Arduino] [v Sensors] | |
|  || Missing abilities: [+ MQTT]   | |
|  || Posted directly               | |
|  +-------------------------------+ |
|  Closing soon                      |
|  Data Analyst OJT      3 days left |
|  Kalye Logistics · Ortigas, Pasig  |
+====================================+
| [HOME] Search  Quest log Tips  Char|
+------------------------------------+
```

## Direction B: Pocket Console

**Mood:** a handheld game console. A dark bezel frames a bright screen, and the
HUD glows lime. Crisp, techy, energetic.

**Fonts:** Silkscreen (header and section labels, all caps) + Inter (everything
else; very clear at small sizes).

**Palette:**

| Token  | Hex       | Role                                | Contrast            |
| ------ | --------- | ----------------------------------- | ------------------- |
| bezel  | `#16202A` | header, nav, weekly quest panel     | –                   |
| canvas | `#EEF2F0` | page background                     | –                   |
| screen | `#FFFFFF` | cards                               | –                   |
| ink    | `#121A21` | text                                | 17.6:1 on screen    |
| muted  | `#52606B` | secondary text                      | 5.7:1 on canvas     |
| lime   | `#A6F05A` | THE accent, on dark only: EXP, level, active tab | 12.0:1 on bezel |
| green  | `#0B6E42` | buttons, links, matched skills on light | white on green 6.3:1 |
| alert  | `#C2412D` | deadlines, errors                   | 5.1:1 on screen     |

**Pixel treatment:** segmented "HP bar" blocks for EXP and match, square
corners everywhere, and the dark bezel bands are the main game signal.

```
+####################################+
|# [AVATAR] mika.codes      LV 4  [F]#|
|# [■■■■■■■■■■□□□□□]           3 WK  #|
|# 340 / 500 EXP                     #|
+####################################+
|  +##############################+  |
|  # WEEKLY QUEST                 #  |  <- dark panel, lime label
|  # Send 4 applications          #  |
|  # [■][■][■][ ]  3 of 4          #  |
|  +##############################+  |
|  Q U E S T S   F O R   Y O U       |
|  +------------------------------+  |
|  | IoT Firmware Intern   3.2 km |  |
|  | Tanglaw Solar   [v] Verified |  |
|  | [■■■■■■■■□□]       86% match  |  |
|  | [v C] [v Arduino] [v Sensors]|  |
|  | Missing abilities: [+ MQTT]  |  |
|  +------------------------------+  |
+####################################+
|# [HOME] Search  Quest log Tips  Me #|
+####################################+
```

---

## Recommendation: A, Field Manual

1. **Tone.** Job hunting is stressful (Brief §1.4). Warm paper and ink feel
   encouraging and human. B's dark, glowing console feels more like a
   competitive game.
2. **Plain and Light modes.** In A, Plain keeps the same paper, ink, and
   shapes, so the game layer is only *absent*. In B, the dark bezel *is* the
   identity, and Plain has to replace it with white bars. That reads like a
   different, generic app (see the preview), which goes against Brief §1.3.
3. **Readability and phones.** Silkscreen is all-caps and has to be
   letter-spaced. That slows reading in section labels. Pixelify Sans reads
   normally. B's dark bands also take about 140px of a 640px phone screen in
   Full Quest.
4. **Audience.** B's lime console look leans toward IT students. A is neutral
   enough for accountancy, HRM, and tourism interns too, who are a large share
   of Philippine OJT.

What B does better: its HUD is more striking at first glance and its segmented
bars feel more "game". If you like that, I can borrow the segmented match bar
into A as a minor tweak.

## Chosen direction: B, Pocket Console (2026-11-09)

You chose B over my recommendation. These fixes deal with the two weaknesses I
raised, and both are applied in the preview:

1. **Silkscreen only for short HUD items:** level, EXP numbers, streak, weekly
   quest label, badge names, the level-up card, and the wordmark. Section
   headings use Inter 700 in sentence case ("Quests for you"), so nothing
   long is set in letter-spaced caps.
2. **Plain mode keeps the bezel.** The dark header and bottom nav are the brand
   frame in every mode. Plain shows only the wordmark in the header. Light
   shows the wordmark, level, and EXP bar. Full shows the whole HUD. The app
   looks like the same product in all three modes.
3. **Header height (Step 3 detail):** on scroll, the Full Quest HUD collapses
   to a 48px bar (level and mini EXP bar), so the bezel doesn't take up the
   phone screen.
4. **Lime is only used on the dark bezel.** Lime on white is about 1.3:1, so it
   never appears on light surfaces. Green `#0B6E42` is the accent on light
   surfaces.

## Next: Step 3 (style foundation)

Expand the 8 tokens into usable tints and shades, check every text and
background pair, write the tokens into the Tailwind config, and build the
component set.
