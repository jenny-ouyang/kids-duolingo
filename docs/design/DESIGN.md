---
version: 1.0
name: Sunrise Playground
description: >
  The design language for the kids Chinese+Math app. A warm sunrise-cream world with
  jade hills, a panda guide with a 福 lantern, and toy physics: every button is a chunky
  block that visibly presses down. There is NO BLACK anywhere — depth comes from each
  element's own hue, darkened. Chinese characters are the visual hero of every screen
  that contains them. Verified colorblind-safe (Viénot/Brettel simulation, 2026-08-19):
  subjects split on the coral/ocean-blue axis, success is teal + ✓ badge, and color is
  never the only signal for anything.
---

## Colors

```yaml
# Canvas & scenery
canvas-top:      "#FFF8E7"   # sunrise cream, page gradient top
canvas-mid:      "#FFEFD0"
canvas-bottom:   "#FFE6BD"
hill-near:       "#9FD8AB"   # jade hill (front)
hill-far:        "#C0E7C7"   # mint hill (back)
sun:             "#FFCF57"

# Ink (NEVER #000 / gray-900 — warmth is the brand)
ink:             "#6B4423"   # headings, primary text — warm brown
ink-soft:        "#B0813F"   # secondary text, prompts
ink-on-color:    "#FFFFFF"   # text on coral/blue/teal surfaces

# Subjects — colorblind-safe axis (do NOT change one without re-simulating)
chinese:         "#F4576B"   # coral — Chinese subject, hanzi accents, pinyin
chinese-light:   "#FF7A82"   # gradient partner
chinese-edge:    "#C13A52"   # press edge (deeper own-hue, replaces any outline)
math:            "#3D7DE4"   # ocean blue — Math subject
math-light:      "#57A5F5"
math-edge:       "#2B5AB0"

# Feedback — color is never the only signal
success:         "#1FA88C"   # teal-mint. ALWAYS paired with a ✓ badge + motion
success-bg:      "#E2F7EE"
success-edge:    "#147663"
wrong:           (no red!)   # wrong = tile grays to canvas-mid + gentle shake,
                             # correct answer glows. No-punishment philosophy.

# Delight (decoration ONLY — never carries meaning)
gold:            "#FFCF57"   # sun, hanzi underline, progress bar start
gold-deep:       "#F5B93F"   # sparkles
gold-edge:       "#D9A32C"
plum:            "#9A7BE8"   # 4th tile edge color
card-edge:       "#F0D8A8"   # press edge for white/neutral cards
chip-track:      "#F5E9CC"   # empty progress ring / track
```

Tile press-edge rotation (answer grids): chinese → math → gold-deep → plum, by index.
These edges are decorative rhythm; correctness is shown by success tokens + ✓, never
by which edge color a tile has.

## Typography

```yaml
display:   "Baloo 2"           # weights 600–800. All latin UI text, headings, buttons.
hanzi:     "ZCOOL KuaiLe"      # ALL Chinese characters, always. Loaded via next/font.
body-fallback: "Baloo 2, ui-rounded, system-ui, sans-serif"
emoji:     "Apple Color Emoji, Noto Color Emoji, Segoe UI Emoji"
           # Noto Color Emoji is LOADED AS A WEBFONT so Windows/Android render the
           # panda, lantern, and stickers like the design, not flat Segoe glyphs.
```

Scale (mobile-first): hero greeting 36px/800 · screen title 27px/800 · hanzi hero
52–60px (largest thing on screen, gold 6px underline, ZCOOL KuaiLe) · card title
18px/800 · body 15px/700 · caption 14px/800 ink-soft. Baloo 2 is round enough that
nothing needs letter-spacing tweaks.

## Depth & Shape — "toy physics"

- Radii: cards/buttons 22–26px, chips/pills 999px, sticker frames 14–16px.
- **Press edge**: every interactive element sits on `box-shadow: 0 6px 0 <own-edge-color>`
  (buttons 7px, small chips 3–4px). On `:active`: `translateY(5px)` and remove/shrink
  the shadow. This is THE interaction signature — everything tappable visibly presses.
- NO borders as outlines. NO black or gray shadows. Ambient depth (rare) uses the
  element's own hue at low alpha: `0 14px 30px -12px <hue>59`.
- Sticker frames: pack emojis sit in tinted rounded squares rotated -4deg.

## Scenery & mascot

Every kid-facing screen is a *place*: canvas gradient + two overlapping hill ellipses
pinned to the bottom (`border-radius: 50% 50% 0 0`, near overlaps far) + 1–3 gold
sparkles (✦, `twinkle` 2.8s). Home adds the sun (top-right) and a swaying 福 lantern.
The mascot is 🐼 (72–76px, `bob` 3.2s ease-in-out infinite, warm drop-shadow) with a
white speech bubble ("你好!" default) shadowed in gold. Parent zone and trust pages:
same palette, no mascot/hills — calm version.

## Motion vocabulary

```yaml
bob:      mascot idle       — translateY 0→-7px, ±2deg, 3.2s infinite
sway:     lantern           — rotate ±6deg from top-center, 4s infinite
twinkle:  sparkles          — opacity+scale pulse, 2.6–2.8s infinite, staggered delays
press:    any tap           — translateY(5px) + shadow collapse, 100ms
pop:      ✓ badge / reward  — spring scale 0→1.1→1 (framer-motion, stiffness ~400)
shake:    wrong answer      — x: [-6,6,-4,4,0], 300ms; tile fades to canvas-mid
ride:     progress bar      — 🏮 rides the bar tip; bar is gold→coral gradient
reduced:  honor prefers-reduced-motion — idle loops off, presses/pops kept subtle
```

## Component rules

- **Subject cards**: gradient (light→base) + own-hue press edge + white text +
  rotated hanzi seal (中文 / 数学) in a translucent rounded square.
- **Answer tiles**: white, huge emoji (46px), ink label, rotating edge colors.
  Correct: success-bg fill, success edge, ✓ badge pops at top-right corner.
- **Progress**: white track with card-edge shadow; gold→coral fill; 🏮 at the tip.
- **Mastery rings**: conic-gradient success on chip-track, ink % label on white core.
- **Chips** (hearts/streak): white pill, gold-tinted press edge, ink text.
- **Hanzi hero block**: white card, prompt in ink-soft caps, hanzi with gold underline,
  pinyin in coral with a gold 🔊 pill (press physics).

## Accessibility (hard rules)

1. Colorblind: subject split stays on the coral/blue axis; success stays teal;
   gold never means anything. Re-run the CVD simulation if any of these hues move.
2. Color is never the sole signal: correct = fill + ✓ + pop; wrong = gray + shake;
   subjects also differ by emoji, seal text, and position.
3. Text contrast: ink on canvas ≥ 7:1; white on chinese/math/success base ≥ 4.5:1.
   ink-soft is for secondary text ≥ 18px only.
4. Tap targets ≥ 56px tall for kid-facing controls.
5. `prefers-reduced-motion`: disable idle loops (bob/sway/twinkle).

## Cross-platform (Windows parity)

- Load **Noto Color Emoji** (next/font or @font-face subset) and put it in the emoji
  stack ahead of Segoe UI Emoji — the panda/lantern/sticker rendering then matches
  the design on Windows and Android instead of falling to flat Segoe glyphs.
- Baloo 2 + ZCOOL KuaiLe ship via next/font (self-hosted) — identical on all OSes.
- Desktop/windowed layout: kid screens stay a centered column (max-width ~28rem) with
  the scenery filling the full viewport width behind it; pack grids go 2-col ≥ 768px.
  Test at 1280×800 mouse + 390×844 touch. Hover states exist but nothing requires hover.
- Scrollbars: content fits without horizontal scroll at 320px width.

## Reference

Interactive mockups of this system (and the rejected directions A/B/B2/C/C2):
`docs/design/direction-explorer.html` → tab "D · Sunrise Playground ★★".
Decision trail: B2's vermillion-vs-jade failed protan/deutan simulation; dark modes
rejected by owner; chocolate outlines rejected as "too black".
