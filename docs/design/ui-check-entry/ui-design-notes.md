# UI check: mandarineer.com entry pages (2026-10-28)

Method: Build to Launch "Check my UI design" (measure, compare, report). Shots and tool output are in this folder (`landing/`, `welcome/`).

## Pages

- `/` landing: `family: 1` (Landing page). Job: make a parent understand the app and tap Play free.
- `/welcome`: `family: 6` (Learning app), first-run screen. Job: make the first child and start.

## Tool count (tell-check, 1440 px)

- Landing: 2 of 16. L1 centered hero; K2 icon cards in a row of three.
- Welcome: 1 of 16. L1 centered hero.
- Sideways scroll at 390 px: none on both pages.

## Eye check

- Landing: no real product picture anywhere. The page shows a panda emoji, text and three icon cards. A parent never sees a lesson screen.
- Landing: the hero sits in the middle of a tall empty first screen (the panda starts about 230 px down at 1440 px), and the hills band cuts the page in two.
- Landing: weak claim words (W1): "gentle, playful", "remembered for good".
- Landing: "Free while in early access — no payment details asked" will be wrong when payments go live.
- Welcome: no way out (no Back, no sign-in for a returning grown-up). A stale child cookie sends every visit of `/` here. Not a tell; a top problem.
- Welcome: 12 avatar tiles with four colored bottom edges that mean nothing; a large empty band above the panda.

## Result per layer

| Layer | Landing | Welcome |
|---|---|---|
| Layout | off: no product picture; feature points are icon cards (nearest layout 1A, product first) | close: one job, one button; no way back |
| Parts | close: one clear main button; footer good | close: name field and Let's go are clear; tiles too many colors |
| Motion | pass: still page | pass |
| Numbers | pass: body text size and contrast fine by eye (not measured with the tool) | pass |
| Style | pass: one brand system (Sunrise Playground) | pass |

## Fix list

- [ ] L1 centered hero (landing) — fix with the product-first layout: headline left, a real lesson screenshot beside it.
- [ ] K2 icon cards (landing) — fix: each point shows a cropped real screen (a lesson, the path, the Parent Zone report).
- [ ] L1 centered hero (welcome) — on purpose? Proposal: yes, a one-task kid screen is centered by design. Jenny confirms.
- [x] Welcome dead end — fixed: Back (website only) and "Grown-ups: already have an account? Sign in"; a stale child cookie is now cleared, so `/` shows the landing again. Browser test passed on localhost.

## Top 3 fixes (fix order)

1. Structure (landing): product-first layout 1A. Headline and Play free on the left, a real phone shot of a lesson on the right; on a phone, the shot comes under the button.
2. Structure (landing): replace the three icon cards with three real screens (the lesson, the path, the Parent Zone report), one short line each.
3. Copy (landing): replace the soft claims with facts parents can check; remove "no payment details asked" before payments go live.

## Nearest template

Product-first landing page (1A): https://tools.buildtolaunch.ai/design/templates#h-1a-product-first — phone shot https://tools.buildtolaunch.ai/design/packages/1a-product-first/shots/base-390-light.png

## What works

One brand look on every page, one clear main button, a plain footer with Privacy and Terms, no sideways scroll, no fake numbers or fake quotes.
