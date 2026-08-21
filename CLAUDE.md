# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status (updated: 2026-08-17)

**ACTIVE — public relaunch in progress.** Goal: free public web app, then iOS App Store (Capacitor, $9.99 one-time). Master plan + decision register: `docs/plans/launch-plan.md`; design specs in `docs/plans/` (multi-tenancy, launch readiness, audio pipeline, App Store path, naming).

**Current phase:** Phase 1 (multi-tenancy) code-complete on branch `launch/multi-tenancy`. The app now uses parent accounts (Supabase Auth, guest-first anonymous sign-in) with multiple children per account. NOT yet deployed — blocked on the Supabase dashboard checklist in `docs/plans/deploy-runbook.md` (enable anonymous sign-ins, anon key into env, owner account, run `npm run db:migrate-multitenancy`, RLS lockdown).

### Active work
- [x] Phase 1 code: Account/Child schema + guarded 3-step migration, requireChild() auth funnel in all API routes, /api/children CRUD, anonymous bootstrap + /welcome onboarding + /switch child switcher, rebuilt /parent zone (adult gate, claim-account flow)
- [ ] Deploy runbook steps A–F (needs Jenny: Supabase dashboard + env keys)
- [ ] Phase 2: landing page, trust pages (privacy/terms), remaining branding (blocked on app-name decision — see docs/plans/naming.md)
- [ ] Phase 3: pre-generated Mandarin audio (docs/plans/audio-pipeline.md)
- [ ] Phase 5: iOS wrap (docs/plans/app-store-path.md)

## What This Is

A kid-friendly Chinese + Math learning app (Duolingo-style) built with Next.js 14, Prisma, and Supabase. Core philosophy: **no punishment**—wrong answers show the correct answer and encourage retries. Sessions are 8 questions, end with a celebration screen.

## Commands

```bash
npm run dev              # Start dev server (localhost:3000)
npm run build            # Production build
npm run lint             # ESLint

# Database
npm run db:migrate               # Create and apply Prisma migrations
npm run db:generate              # Generate Prisma client types
npm run db:seed                  # Seed Chinese vocabulary packs
npm run db:seed-math             # Seed math problems (addition 1–100)
npm run db:generate-questions    # DEPRECATED — runtime same-pack fallback is the official path (see script header)
npm run db:migrate-multitenancy  # One-shot guarded expand→backfill→contract migration (see docs/plans/deploy-runbook.md)
```

⚠️ The two `20260817*_multitenancy_*` migrations must NOT be applied via `npm run db:migrate` /
`prisma migrate deploy` — the backfill has to run between them. Use `db:migrate-multitenancy` only.

No test suite exists. TypeScript + `npm run lint` are the primary quality checks.

## Architecture

### Session Flow

```
Home → Subject (Chinese/Math) → Pack/Topic selection → 8-question practice → Celebration
```

Practice sessions load **pre-generated questions** from the DB (no AI calls at runtime). SM-2 spaced repetition picks which words/problems are due. Progress updates are fire-and-forget (never block the UI).

### Key Directories

```
app/
├── page.tsx                          # Home: Chinese vs Math subject picker
├── packs/page.tsx                    # Chinese pack grid with mastery rings
├── practice/[packId]/page.tsx        # Chinese practice session
├── math/topics/page.tsx              # Math topic selection
├── math/practice/[topicId]/page.tsx  # Math practice session
└── celebrate/page.tsx                # End-of-session celebration screen

app/api/
├── packs/                  # List packs by subject
├── questions/[packId]/     # Load 8 questions + current word progress
├── math/questions/[topicId]/
├── progress/               # POST: save SM-2 updates
├── answers/                # POST: log answer events
└── profile/                # GET/POST: hearts & streak

components/
├── PictureChoice.tsx        # Main Chinese exercise (3 question types)
├── CountAndChoose.tsx       # Math exercise
├── ExerciseShell.tsx        # Progress bar wrapper
└── KidLayout.tsx            # Full-screen kid-friendly layout

lib/
├── db.ts                    # Prisma singleton with PrismaPg adapter (edge runtime)
├── spaced-repetition.ts     # SM-2 algorithm: updateSM2(), pickWordsForSession()
├── tts.ts                   # speakChinese() via Web Speech API (zh-CN)
├── encouragement.ts         # Varied praise with emoji, Chinese phrases, missions
├── sounds.ts                # Celebration/correct/wrong sound effects
└── types.ts                 # Shared TypeScript interfaces
```

### Database Models

- **Account** – One row per Supabase auth user (id == auth.users.id); isGuest until claimed; plan for future paid unlock
- **Child** – Per-account child profile (nickname + avatar emoji only, no PII); holds hearts/streak; replaces ChildProfile
- **Pack** – Vocabulary pack or math topic (subject, name, emoji, color, sortOrder)
- **Word** – Chinese vocab (english, chinese, pinyin, image, packId)
- **MathProblem** – Arithmetic fact (operand1, operator, operand2, answer, emoji)
- **GeneratedQuestion** – Pre-cached exercise questions with distractor options (JSON)
- **ChineseProgress / MathProgress** – SM-2 state per child × item, keyed by childId FK (easeFactor, interval, nextReview)
- **AnswerEvent** – Full answer history for analytics, keyed by childId

### Critical Patterns

**Prisma + Node runtime:** Uses `@prisma/adapter-pg` (PrismaPg) over a `pg` Pool. Routes run on the **Node runtime** (the `pg` driver is not edge-compatible — an earlier version of this doc claimed edge; that was wrong). `lib/db.ts` exports a singleton client. Migrations use session-mode pooler; app runtime uses transaction-mode pooler.

**Auth (added 2026-08-17):** Supabase Auth, guest-first. `components/auth/AuthBootstrap.tsx` silently runs `signInAnonymously()` on first visit; parents later "claim" the account (`updateUser({ email })` keeps the same user id, so no data migration). `lib/auth.ts` is the single funnel: `requireChild()` validates the JWT (`getUser()`, never `getSession()`), verifies the `kd_child` cookie's child belongs to the account, and is the ONLY way handlers obtain a childId — handlers must never accept childId from a request body. Tenant isolation is app-layer (Prisma connects as table owner and bypasses RLS); RLS is enabled deny-all on all public tables purely to close the PostgREST surface (`scripts/enable-rls.sql`).

**Question Types:** `PictureChoice.tsx` handles three exercise types:
- `audio_to_picture` – Hear Chinese → pick picture
- `picture_to_chinese` – See picture → pick Chinese character
- `english_to_chinese` – See English → pick Chinese character

**Emoji Fallbacks:** When no image is available, a hardcoded emoji map in `PictureChoice.tsx` provides 50+ vocabulary emoji fallbacks.

**Chinese TTS:** `lib/tts.ts` uses the Web Speech API (`utterance.lang = 'zh-CN'`). `VoicePreloader.tsx` warms up voices on mount to avoid first-utterance silence on iOS/Safari.

**SM-2 Algorithm:** `pickWordsForSession()` in `lib/spaced-repetition.ts` selects 8 items: prioritizes overdue items, then new items, then random. `updateSM2()` applies the SM-2 formula after each answer.

## Data

Chinese vocabulary packs live as JSON in `data/packs/` (13 packs: animals, colors, numbers, food, family, body, feelings, home, actions, nature, greetings, pronouns, words). `prisma/seed.ts` reads these and upserts into the DB.

Math problems are generated programmatically in `prisma/seed-math.ts` covering addition 1–100.

## Environment

Supabase project: `odwoxbxkvmjjqvjyynko` (this app's production DB).
Note: `.env` also references a different Supabase project (`fhdjzktrpcsjleargmrb`) used for an unrelated ai-memory-agent — don't confuse the two.

Deployed on Vercel (`.vercel/` config present).

## Content invariant

**Every word must have a visual** (illustration in `lib/word-images.json`, emoji in its data `image` field, or an EMOJI_FALLBACKS entry). Verify with `python3 scripts/audit-visuals.py` after any content batch and before any iOS build — 14 body-pack words shipped text-only on 2026-08-21 and Jenny caught it in TestFlight.

## Recent changes

- 2026-08-20: Batch C complete — all 360 words across 33 packs now have custom illustrations (216 in lib/word-images.json; some abstract words intentionally stay emoji). Parent progress reports live (`/parent/report/[childId]` + ownership-checked `/api/children/[childId]/report`). Image pipeline note: nanobanana (Gemini) hit its monthly spend cap mid-batch; final 30 images were generated with OpenAI `gpt-image-1` (key in shell env, ~4¢/image, same STYLE prompt from `scripts/generate-images.sh`, style-matches nanobanana closely) + white-point correction for its cream backgrounds — use it as the fallback generator whenever Gemini quota is exhausted.
- 2026-08-17: Public-relaunch Phase 1 (multi-tenancy) code-complete on `launch/multi-tenancy`: Supabase guest-first auth, Account/Child schema with guarded expand/backfill/contract migration (preserves Julian's 501 hearts + all progress), requireChild() funnel across all API routes, /welcome onboarding, /switch child switcher, rebuilt /parent zone. Four design specs + launch plan + deploy runbook in `docs/plans/`. Note: content-only API routes now require auth too, so the n8n keepalive's HTTP ping gets 401 (harmless — the primary keepalive is direct Postgres).
- 2026-07-13: Keepalive added — n8n workflow `yDEoYhLvu7gU1kzD` on Oracle (141.148.2.254:5678) runs daily at 9:17: a direct Postgres `SELECT 1` against the Supabase session pooler (n8n credential `PxIdhVm26YrEKjVW`) as the primary keepalive, plus a secondary HTTP ping to `https://kids-duolingo.vercel.app/api/packs?subject=chinese` that can't fail the run. Found the Supabase project (`odwoxbxkvmjjqvjyynko`) already PAUSED from the June idle stretch: the Vercel site loads (HTTP 200) but `/api/packs` returns 500 "DB error" until the project is restored via the Supabase dashboard.
- 2026-06-20: Audio hardening (shared AudioContext, first-gesture unlock, iOS speech priming) + Sentence practice feature (tap-to-build, dedicated pack + route). Investigation trail for the audio work is in `docs/2026-06-20-no-sound-total-silence.md`.

## Open questions

- ~~Has Jenny restored the paused Supabase project?~~ Resolved 2026-07-14: restored via dashboard, `/api/packs` returns 200, and a live n8n keepalive run (execution 24175) completed successfully. The daily keepalive prevents future pauses.
- Is the audio fix actually live in production? The Vercel site is confirmed live (verified 2026-07-13), but audio behavior hasn't been re-tested on a device. (Will be superseded by Phase 3 pre-generated audio anyway.)
- ~~Is active development resuming, or is this parked?~~ Resumed 2026-08-17: public relaunch underway (see Status).
- App name: "Julian's Chinese" must be replaced before Phase 2 branding. Candidates + availability checks in `docs/plans/naming.md` (recommended: Tangram Tots). Awaiting Jenny's pick.
