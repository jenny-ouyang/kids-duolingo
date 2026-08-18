# Launch Readiness — Product Gap Spec

**Date:** 2026-08-17
**Method:** Static code review of `app/`, `components/`, `lib/`, `prisma/`, `data/packs/`. App not run.
**Goal:** Free public web launch, later a paid iOS app.
**Lens:** A stranger — a parent who just found the link — with no context about this family.

---

## 0. The one structural blocker everything else hangs on

Every API route pins all data to a single hardcoded child:

- `app/api/progress/route.ts:4` — `const CHILD = 'julian'`
- `app/api/answers/route.ts:4` — same
- `app/api/packs/route.ts:4` — same
- `app/api/profile/route.ts:4` — same
- `app/api/questions/[packId]/route.ts:5` — same
- `app/api/math/questions/[topicId]/route.ts:6` — same

Consequence for a public launch: **every visitor on the internet reads and writes the same DB rows.** A stranger's kid answering questions mutates the shared SM-2 progress, shared hearts total, and shared streak. Two families practicing at once corrupt each other's session picks. This is simultaneously a data-integrity bug and a privacy problem (visitor A's answer history is served to visitor B).

Nothing else in this spec matters until there is a per-visitor identity. The cheapest fix that works for a free web launch: an anonymous `childId` (UUID) minted client-side, stored in localStorage, sent with every API call, replacing `CHILD`. Accounts can come later for iOS.

> **DECISION POINT (D1): Identity model for web launch.** (a) Anonymous device-scoped child ID, no signup — lowest friction, progress lost if browser data cleared, no cross-device sync; (b) lightweight parent account (email magic link) with child profiles under it — needed eventually for paid iOS anyway. Recommendation: (a) for web launch with the schema written so (b) layers on top (childId already exists as a column — `childName` — so this is mostly a rename in meaning, not a migration).

---

## 1. First-visit experience

### What a stranger sees today at `/`

`app/page.tsx` renders the kid home directly: floating clouds, a panda mascot, and the heading **"Hi, Julian! 👋"** (`app/page.tsx:90`), then "What do you want to learn today?" with two subject cards (Chinese, Math) and a small "Parent Dashboard" link. The browser tab says **"Julian's Chinese"** (`app/layout.tsx:13-14`, also the meta description: "Learn Mandarin Chinese with Julian").

A stranger gets: someone else's child's name, no statement of what the app is, who it's for (age range?), what it costs, or what happens to their kid's data. Most parents close the tab at "Hi, Julian."

### Spec: landing page + kid home coexistence

**New marketing landing at `/`** (server-rendered, indexable):
- Hero: app name + one-line value prop aimed at the parent, e.g. "8-question Mandarin and math sessions for kids 4–7. No ads, no punishment — wrong answers teach, they don't cost lives."
- 3 proof blocks: (1) how a session works (hear the word → tap the picture → celebrate), (2) the no-punishment philosophy (already the app's genuine differentiator — it's in CLAUDE.md as core philosophy), (3) spaced repetition in parent terms ("words your kid struggles with come back sooner").
- Screenshots or a short looping demo of PictureChoice + celebrate screen (static images, no video hosting needed for v1).
- Primary CTA: **"Start free — no account needed"** → onboarding flow (Section 3) → kid home.
- Footer: Privacy, Terms, Contact (Section 5).

**Kid home moves to `/home`** (or `/play`). Returning visitors with an existing child profile in localStorage skip the landing: `/` checks for the profile and redirects to `/home`. This keeps the kid's daily entry point one tap while strangers always land on the explanation.

> **DECISION POINT (D2): App name.** "Julian's Chinese" cannot ship. The name gates the landing page, metadata, OG images, and iOS listing. Also decide whether Math is in the name/positioning or a bonus feature — the current metadata says "Chinese" but the home screen sells two subjects equally.

---

## 2. Hardcoded personal content — full inventory

Every occurrence of the family context, from `grep -rni julian` plus manual review:

**Kid-visible UI**
- `app/page.tsx:90` — heading `Hi, Julian! 👋`
- `app/layout.tsx:13` — site title `"Julian's Chinese"`
- `app/layout.tsx:14` — meta description `'Learn Mandarin Chinese with Julian'`
- `lib/encouragement.ts:70` — `"You're a superstar, Julian!"` (HEADINGS_PERFECT)
- `lib/encouragement.ts:80` — `'Great job, Julian!'` (HEADINGS_GREAT)
- `lib/encouragement.ts:88` — `'Well done, Julian!'` (HEADINGS_GREAT)
- `lib/encouragement.ts:94` — `'Good try, Julian!'` (HEADINGS_GOOD)
- `lib/encouragement.ts:223` — spotlight template `'Julian knows {chinese}! Teach it to someone!'`

**Parent-visible UI**
- `app/parent/page.tsx:86` — subtitle `Julian's learning progress`
- `app/parent/page.tsx:167` — "Julian's progress uses the SM-2 algorithm. Words **he** gets right…" (name + gendered pronoun)
- `app/parent/page.tsx:187` — "This will delete all of Julian's progress."

**Data layer / identifiers**
- `app/api/progress/route.ts:4`, `app/api/answers/route.ts:4`, `app/api/packs/route.ts:4`, `app/api/profile/route.ts:4`, `app/api/questions/[packId]/route.ts:5`, `app/api/math/questions/[topicId]/route.ts:6` — `const CHILD = 'julian'` (see Section 0)
- `lib/progress.ts:4` — localStorage key `'julian-progress'`
- `lib/progress.ts:44` — `childName: 'Julian'` default
- `app/parent/page.tsx:51` — `localStorage.removeItem('julian-progress')`

**Comments/docs only (no user impact, fix opportunistically)**
- `app/api/answers/route.ts:38`, `app/api/profile/route.ts:8`, `app/celebrate/page.tsx:151`, `components/exercise/PictureChoice.tsx:199`, `lib/encouragement.ts:44`

The seed data (`data/packs/*.json`, `prisma/seed-math.ts`) is clean — no personal references found. Family missions in `lib/encouragement.ts` reference "mom"/"dad" generically ("Tell mom your age in Chinese!", "Say 谢谢妈妈 or 谢谢爸爸 tonight!") — fine for a general audience, though worth a pass for family-structure neutrality ("Tell a grown-up…").

**Fix pattern:** the four encouragement strings and the home greeting should take the child's name as a template variable (`{name}`) from the onboarding profile, falling back to name-free variants ("You're a superstar!"). This turns the personalization from a liability into the feature it was for Julian.

---

## 3. Onboarding

### What a new family actually needs before first practice

Minimum: a **child's first name** (drives the greeting and the four personalized praise strings) and a minted anonymous **childId** (Section 0). That's it — the app already defaults sensibly everywhere else (all packs available, SM-2 starts cold, hearts start at 0).

Optional but cheap and useful: **starting point** — "New to Chinese" vs "Knows some words" (could map to which packs are suggested first) — and TTS check ("Tap to hear 你好" — surfaces the known iOS silent-mode/voice issue *before* the first exercise confuses a kid).

### Where it fits

`Landing (/) → "Start free" → 2-screen onboarding → /home`

- Screen 1: "What's your kid's name?" (single field; explicitly say "first name only — this stays on your device", which is also your COPPA posture, see Section 5). Skippable — skip yields name-free strings.
- Screen 2: audio check + one-line "how it works" for the parent (8 questions, no losing, hand the device to your kid now).

Do **not** ask for email, age, or account creation on the free web flow — every field costs conversion and creates data obligations.

> **DECISION POINT (D3): Ask for the child's name at all?** Name-free copy everywhere is less work and zero data collected. Personalized praise is warmer and is the app's heritage. Recommendation: ask, keep it localStorage-only, never send it to the server (use the anonymous UUID as the DB key, not the name — note the current schema keys on `childName`, so this decision affects the Section 0 fix).

---

## 4. Parent-facing needs

### What `app/parent/page.tsx` shows today

- Header "Parent Dashboard / Julian's learning progress"
- Two stat cards: words practiced, words mastered (3+ reviews)
- Per-pack list with mastery bars and **Lock/Unlock buttons**
- "About Spaced Repetition" explainer (references Julian by name and "he")
- Two-click progress reset (removes `julian-progress` from localStorage)

### Problems beyond the name

1. **It reads the wrong data source.** The dashboard is built entirely on `loadProgress()` from localStorage (`lib/progress.ts`), but practice sessions save progress to the **DB** via `/api/progress` — the localStorage model is a vestige of an earlier architecture. A parent whose kid has practiced for a week will see zeros. The reset button likewise only clears localStorage; DB progress survives. This is the "broken-looking thing a stranger hits" in its purest form: the one page built for the paying adult shows wrong numbers.
2. **Lock/Unlock is dead weight.** It writes `unlocked` flags to localStorage, but `app/packs/page.tsx` renders packs from `/api/packs` and (from review of its render path) doesn't gate on those flags — and `lib/progress.ts` even force-unlocks everything in its v2 migration. Remove or actually wire it.
3. **No gate.** The parent area is one tap from the kid home with no "adult check" (the standard kids-app pattern: "hold for 3 seconds" or a simple math question). A kid can two-tap reset their own progress.

### Spec for the public version

- **Progress overview from the DB** per child: words practiced/mastered, streak, hearts, per-pack mastery, last practiced — all of this already exists in `ChineseProgress`/`MathProgress`/`AnswerEvent`/`ChildProfile`; the API route to aggregate it is new but small.
- **Child settings:** edit name, reset progress (DB + localStorage, with real confirmation).
- **Privacy panel:** plain-English "what we store" + link to policy (Section 5).
- Keep the SM-2 explainer — genuinely good parent-facing content — with `{name}`/neutral pronouns.
- Simple adult gate on the route.
- Multi-child switcher: **iOS-later**, but keep the data model per-child from day one (Section 0 does this automatically).
- Account management (email, subscription, delete account): only when accounts exist — iOS-later, or when D1(b) is chosen.

---

## 5. Trust & legal surface

Currently **nothing exists**: `grep -rni 'privacy|terms of|contact'` across `app/`, `components/`, `lib/` returns zero hits. No privacy page, no terms, no contact, no about, no imprint. For an app aimed at children this is not just polish — it's the first thing a cautious parent looks for and a hard requirement for the later iOS submission (App Store requires a privacy policy URL for the Kids category and privacy nutrition labels).

Must add before public launch:
- **`/privacy`** — what is stored (answer events, progress, hearts/streak keyed to an anonymous ID; child's name kept on-device only if D3 goes that way), no ads, no third-party trackers (verify: currently no analytics in the codebase — true today), COPPA stance: no personal information collected from children.
- **`/terms`** — short, standard, free-service disclaimer.
- **Contact** — a mailto or simple form in the footer; required for trust and for App Store later.
- **Footer** on landing + parent pages linking all three (keep it off the kid screens).

> **DECISION POINT (D4): COPPA posture.** Easiest defensible position for the free web app: collect no child PII at all (anonymous UUID server-side, name on-device). If D1(b)/accounts happen, the *parent* is the account holder and consent-giver — design the copy that way from the start. Consider a one-line "built by a parent, no ads ever" note; it's the strongest trust signal an indie kids app has.

---

## 6. Content readiness

### Inventory (from `data/packs/*.json` + seeds)

| Pack | Items | | Pack | Items |
|---|---|---|---|---|
| Actions | 25 | | Greetings | **8** |
| At Home | 20 | | Me & Others (pronouns) | 12 |
| Simple Sentences | 20 | | Feelings | 12 |
| Nature | 16 | | Animals | 10 |
| My Body | 14 | | Colors | 10 |
| Family | 14 | | Numbers | 10 |
| Describing (words) | 14 | | Food | **8** |

Total ≈ 183 words + 20 sentences + programmatic math (addition 1–100). 

**Verdict: enough for a free web launch.** 13 packs × 8-question sessions with SM-2 recycling is weeks of daily use for the target age. No pack is placeholder-empty; **Food (8)** and **Greetings (8)** are the thin ones — a session pulls 8 items, so first sessions in those packs are "the whole pack every time," which blunts spaced repetition. Topping both to 12–15 is a content-only task. Food at 8 is the oddest gap for the age group (food is a top-3 kid vocabulary domain) — easy win.

Math is a single topic (addition 1–100). Fine as a bonus subject; don't market "Math" as a peer of Chinese until there's subtraction/counting variety (iOS-later).

### Embarrassing / broken-looking things a stranger would hit

1. **API failure = crash, not message.** `app/math/topics/page.tsx` does `fetch('/api/packs?subject=math').then(r => r.json()).then(data => setTopics(data))` — when the API returns `{ error: 'DB error' }` (HTTP 500), a non-array lands in state and `.map` throws a client-side exception. This is not hypothetical: CLAUDE.md records that when the Supabase project auto-paused in July, `/api/packs` returned exactly this 500 while the site stayed up. `app/packs/page.tsx` has the same shape. **Spec: check `res.ok`, and render a kid-friendly error state ("The panda is napping 🐼 — try again in a minute") with a retry button.**
2. **Silent dead-end on practice load failure.** Both practice pages (`app/practice/[packId]/page.tsx`, `app/math/practice/[topicId]/page.tsx`) catch fetch errors and just `setLoading(false)` — the user is left on a screen with zero questions. The sentences page (`app/practice/sentences/page.tsx`) is the only one with an explicit empty state ("No sentences available." + Go Back); replicate that pattern (with friendlier copy) in the other two.
3. **Infrastructure fragility is a product bug now.** The Supabase free-tier pause is currently held off by an n8n keepalive on a personal Oracle box. For a public launch, DB availability can't depend on a hobby cron. Decide: paid Supabase tier, or move keepalive somewhere durable (Vercel cron), and keep the error states from (1) as the safety net.
4. **Emoji-only "pictures."** `PictureChoice.tsx` uses a hardcoded emoji fallback map instead of images. Honestly: this reads as a deliberate, charming style — not embarrassing. Keep for launch; real illustrations are an iOS-later polish/differentiator.
5. **No favicon/OG check.** Title is "Julian's Chinese"; when the link is shared in a group chat the preview *is* the marketing. New name + OG image + description ship with the landing page.
6. **Shared streak/hearts** (Section 0) would look actively broken to a stranger — "why does my kid have a 47-day streak on day one?"

---

## 7. Ordered task list

Effort: **S** ≤ half a day, **M** ~1–2 days, **L** ~3+ days.

### Must-have for free web launch (in order)

| # | Task | Effort |
|---|---|---|
| 1 | **Per-visitor child identity** — anonymous UUID replacing `CHILD='julian'` across all 6 API routes; localStorage key rename; migration note for Julian's own data (D1) | **M** |
| 2 | **De-Julianize all UI strings** — greeting, layout metadata, 4 encouragement strings, spotlight template, parent page (name + pronouns) → `{name}` template with name-free fallback (D3) | **S** |
| 3 | **Error/empty states** — `res.ok` checks + friendly error UI on packs, math topics, both practice pages; retry buttons | **S–M** |
| 4 | **Landing page at `/`** + kid home moved to `/home` with returning-visitor redirect; new name, OG/meta, favicon (D2) | **M** |
| 5 | **Onboarding** — name + audio-check screens between landing and kid home | **S–M** |
| 6 | **Parent dashboard rewrite** — read from DB (new aggregate endpoint), remove/wire dead Lock/Unlock, DB-backed reset, adult gate | **M** |
| 7 | **Privacy policy, terms, contact** pages + footer (D4) | **S** |
| 8 | **DB reliability** — paid tier or durable keepalive (Vercel cron) so the launch doesn't 500 (decision, then S) | **S** |
| 9 | Top up **Food** and **Greetings** packs to 12–15 words | **S** |
| 10 | Real-device smoke test of the June audio fix (open item in CLAUDE.md) before sharing any public link | **S** |

### Nice-to-have for web (post-launch fast follows)

- Family-neutral mission copy ("a grown-up" instead of mom/dad) — **S**
- "Built by a parent" about blurb on landing — **S**
- Basic privacy-safe analytics (page views + sessions completed; nothing per-child) — **S**
- Streak-repair grace ("practice tomorrow to keep your streak") — **S**
- PWA manifest / add-to-home-screen prompt (bridges the gap until iOS) — **S–M**
- 2–3 new packs (weather, clothes, school) + a second math topic (subtraction) — **M**
- Sound on/off toggle for classrooms/quiet use — **S**

### iOS-later

- Parent accounts (email) + cross-device sync; child profiles under one account (D1b) — **L**
- Payments/subscription + free-vs-paid content line (which packs are premium?) — **L**
- Multi-child switcher in parent dashboard — **M**
- Native TTS (replaces flaky Web Speech API — this alone justifies the paid app) — **M**
- Illustrated word images replacing emoji — **L** (content)
- App Store assets: Kids-category compliance, privacy labels, screenshots — **M**

---

## Decision points summary (owner input needed)

- **D1** Identity model for web: anonymous device ID (recommended) vs parent accounts now.
- **D2** App name + whether Math is in the positioning or a bonus.
- **D3** Ask for child's name (kept on-device, recommended) vs fully name-free copy.
- **D4** COPPA posture: zero child PII (recommended) — constrains D1/D3 implementation.
- **(implicit)** Supabase paid tier vs durable keepalive; and what happens to Julian's existing progress rows during the identity migration.
