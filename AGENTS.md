# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status (updated: 2026-08-28)

**Mandarineer** — a kid-friendly Mandarin + Math learning app. Free web app live at
**https://mandarineer.com** (also `kids-duolingo.vercel.app`); iOS wrap via Capacitor is at
**build 5**, App Store listing copy + screenshots staged in `store/`.

App name is settled (decision D4, LOCKED 2026-08-20): **Mandarineer**, subtitle pattern
"Mandarineer: Mandarin for Kids". The repo/npm package is still `kids-duolingo` — that's
the old working name, not a rename target.

Master plan + decision register: `docs/plans/launch-plan.md`. Design specs (multi-tenancy,
launch readiness, audio pipeline, App Store path, curriculum, naming) live alongside it.
`PLAN.md` at the root is the original v1 design (Ollama + localStorage) — historical only,
none of it is the current architecture.

Phases 1–3 (multi-tenancy, public polish, pre-generated audio) are on `main` and deployed.
Phase 5 (iOS) is in progress. Next planned expansion: **Custom Family Packs** (parent-authored
packs; pricing fork still open — see launch-plan).

## Commands

```bash
npm run dev              # Dev server (localhost:3000)
npm run build            # Production build (Vercel/server build)
npm run lint             # ESLint

# Database
npm run db:migrate               # prisma migrate dev — see the multitenancy warning below
npm run db:generate              # Prisma client → lib/generated/prisma
npm run db:seed                  # Seed packs: words AND sentences from data/packs/*.json
npm run db:seed-math             # Seed math problems
npm run db:migrate-multitenancy  # One-shot guarded expand→backfill→contract (docs/plans/deploy-runbook.md)
npm run db:generate-questions    # RETIRED — do not use (see "Question generation" below)

# Content pipelines (run from repo root)
uv run --with edge-tts scripts/generate-audio.py   # Mandarin clips → public/audio/zh + lib/audio-manifest.json
./scripts/generate-images.sh [packId ...]          # Word illustrations → public/images/words/<id>.jpg
python3 scripts/audit-visuals.py                   # MUST pass after any content batch

# iOS
./scripts/build-ios.sh   # static export + cap sync ios, then: npx cap open ios
```

⚠️ The two `20260817*_multitenancy_*` migrations must NOT be applied via `npm run db:migrate` /
`prisma migrate deploy` — the backfill has to run between them. Use `db:migrate-multitenancy`.
They are already applied in production; this matters only for a fresh database.

No test suite exists. TypeScript + `npm run lint` are the primary quality checks.
Ask Jenny before running Xcode builds, simulators, or batch content jobs — they're expensive.

## Architecture

### Session flow

```
Landing / Home → Chinese or Math → Pack or Topic grid → 8-question session → Celebration
```

Sessions load questions from the DB (no AI at runtime). SM-2 spaced repetition picks which
items are due. Answers are **stay-until-right**: a wrong answer shows the correct one, keeps the
question up, and re-queues first-try misses later in the same session. Progress writes are
fire-and-forget and must never block the UI.

### Routes are query-param, not dynamic segments

```
/practice/session?pack=<packId>
/math/practice/session?topic=<topicId>
/practice/sentences
```

This is deliberate: the Capacitor iOS shell is a Next.js **static export**, which cannot
render dynamic route segments. Any new kid-facing page must follow the same pattern — a static
path plus `useSearchParams()` inside a `<Suspense>` boundary. (API routes under `app/api/`
keep dynamic segments; they're server-only and are excluded from the iOS bundle.)

### Two platforms, two auth transports

This is the single most important thing to understand before touching any API call.

| | Web | Native (Capacitor) |
|---|---|---|
| Origin | same-origin | `capacitor://localhost` → `NEXT_PUBLIC_API_BASE` |
| Supabase session | httpOnly cookies | `Authorization: Bearer <token>` |
| Active child | `kd_child` cookie | `x-child-id` header (id in localStorage) |

- **All client→API calls go through `lib/api-fetch.ts`** (`apiFetch`, `fetchJsonWithAuthRetry`,
  `fetchJsonCached`). A bare `fetch('/api/...')` works on web and silently breaks on device.
  `fetchJsonWithAuthRetry` absorbs the anonymous-sign-in bootstrap race (retries 401s);
  `fetchJsonCached` adds a per-child localStorage fallback so played packs work offline.
- `middleware.ts` refreshes the Supabase session on every request and adds CORS for the three
  native origins. Auth *decisions* never live there — they live in `lib/auth.ts`.
- The web `kd_child` cookie is set **server-side** by `POST /api/children/active`; Safari ITP
  evicts JS-written cookies after 7 days. `lib/child-cookie.ts` handles both platforms — use it.

### Auth funnel

Supabase Auth, guest-first: `lib/guest-session.ts` `ensureGuestSession()` calls
`signInAnonymously()` only when a family creates its first child (`/welcome`, or "Add a child"
in the Parent Zone). Never sign in on page load: every visitor and crawler would become an
auth user. Parents later claim the account via magic link (`updateUser({ email })` keeps
the same user id, so no data migration).

`lib/auth.ts` is the only funnel. `requireChild()` validates the JWT (`getUser()`, **never**
`getSession()` server-side), verifies the hinted child belongs to the account, and is the ONLY
way a handler obtains a `childId`. **Handlers must never accept a childId from a request body
or query string.** Two subtleties encoded there: anonymous users report `email` as `""` not
`null` (must normalize, `Account.email` is unique), and account provisioning is create-then-
recover-on-P2002 because Prisma's upsert isn't atomic with a second unique column.

Tenant isolation is app-layer — Prisma connects as the table owner and bypasses RLS. RLS is
enabled deny-all on public tables purely to close the PostgREST surface (`scripts/enable-rls.sql`).

### Data model

- **Account** — one row per Supabase auth user (`id == auth.users.id`); `isGuest` until claimed;
  `plan` (`free` | `lifetime`)
- **Child** — nickname + avatar emoji only, no PII; holds hearts/streak
- **Pack** — vocabulary pack, sentence track, or math topic (`subject`, emoji, color, sortOrder)
- **Word / Sentence / MathProblem** — the three content types
- **ChineseProgress / SentenceProgress / MathProgress** — SM-2 state per child × item
- **AnswerEvent** — answer history for parent reports
- **GeneratedQuestion** — legacy pre-cached questions; no longer written to

Gotchas: `ChineseProgress` is `@@map("WordProgress")` and `AnswerEvent.itemId` is
`@map("wordId")` — the table/column names lag the model names. Prisma client is generated to
`lib/generated/prisma`, not `node_modules`.

**Prisma runtime:** `@prisma/adapter-pg` (PrismaPg) over a `pg` Pool, singleton in `lib/db.ts`.
Routes run on the **Node runtime** — `pg` is not edge-compatible. Migrations use the
session-mode pooler; app runtime uses the transaction-mode pooler.

### Audio

Pre-generated MP3 clips are the **primary** path; Web Speech (`zh-CN`) is the fallback for text
with no clip yet. `lib/tts.ts` looks up `lib/audio-manifest.json` (text → sha1 filename) and
plays from `public/audio/zh/`.

- Voices: `zh-CN-XiaoyiNeural` teaches, `zh-CN-YunxiaNeural` cheers (bake-off winners).
- **Native playback uses `HTMLAudioElement`, never WebAudio.** WKWebView's WebAudio output was
  silent in iOS builds 2–3; the media channel plays regardless of the ring/silent switch and
  needs no `AVAudioSession` override. Don't "fix" this back to the shared AudioContext.
- Web playback goes through the shared AudioContext in `lib/sounds.ts` (first-gesture unlock —
  the fix for the June 2026 total-silence bug, `docs/2026-06-20-no-sound-total-silence.md`).
- `scripts/generate-audio.py` is idempotent and mirrors the praise list in `lib/encouragement.ts` —
  update `PRAISE` there when that list changes. It uses edge-tts (free Edge endpoint), which is
  **dev-only**; swap to a licensed Azure key (same voice names) before wide promotion.

### Question generation

Questions are assembled **server-side**, in `app/api/questions/[packId]/route.ts`. That one
route does SM-2 selection (recently-wrong → due → never-seen → not-due, capped at 8), then per
word: use a `GeneratedQuestion` row if one exists, otherwise fall back to three random
same-pack distractors with type `audio_to_picture`. Clients just render what they receive.

Ollama-based pre-generation was retired (commit `f479a43`) — the runtime same-pack fallback is
the official path, so don't re-run `db:generate-questions`. `lib/exercise-generator.ts` is
**dead code** (no callers; still references `/api/generate-options`) — don't build on it or
mistake it for the live path.

`components/exercise/PictureChoice.tsx` renders three Chinese exercise types (`audio_to_picture`,
`picture_to_chinese`, `english_to_chinese`) with an illustration → emoji → text fallback chain.

### iOS build

`scripts/build-ios.sh` temporarily moves `app/api` and `middleware.ts` aside (static export
refuses to build with them present), runs `CAP_BUILD=1 next build`, then `cap sync ios`. The
`trap` restores them even on failure — if a build dies weirdly, check for a stray `.cap-hidden/`.
`CAP_BUILD=1` also injects `NEXT_PUBLIC_API_BASE` (defaults to `https://mandarineer.com`), which
is how the bundled app reaches the live backend.

### Payments (dormant until go-live)

`lib/plan.ts` is the single switch point. The switch is **server-side only**: `PAYMENTS_ENABLED=true` in the
server env (never `NEXT_PUBLIC_` — the iOS bundle would freeze it at build time). While off, every pack is
open, `/api/packs` reports `locked: false` everywhere, and the Parent Zone shows no unlock card.

Free forever: `animals`, `colors`, `numbers`, `math_add_singles`, plus the `sentences` practice mode (content
filtered per source pack). Everything else is paid once `PAYMENTS_ENABLED` is on. The rule is
`canAccessPack()`; routes enforce it through `lib/pack-gate.ts` (`402 { error: 'locked', packId }`) on
questions, math questions, sentences, progress writes and answer writes. `GET /api/account` feeds the
Parent Zone unlock card. The cleanup cron never deletes an account whose plan is not `free`.

Design: `docs/superpowers/specs/2026-10-13-payments-design.md`. Phase A (gate + UI) is built; Phase B (Stripe
promo/refunds) and Phase C (Apple StoreKit) have their own plans. `npm test` (vitest) covers the money paths;
`node scripts/e2e-gate.mjs` checks the gate against a dev server started with `PAYMENTS_ENABLED=true`.

## Where things go

Added 2026-10-09. Maintained by `mng-apps`; see sbrain `20_SKILLS/_shared/manager-contract.md`, job 4. **Follow these rather than inventing a location.** Every path below exists today.

**New code.** Routes and API handlers in `app/`. React components in `components/`, inside the domain folder that already fits — `auth`, `celebration`, `design`, `exercise`, `home` — and a new domain folder only when none of those do. Shared helpers in `lib/`. Database schema in `prisma/`. One-off tooling in `scripts/`.

**Learning content.** `data/packs` and `data/sentences`. Content is data, never hard-coded into a component.

**Documents.** `docs/`. Design in `docs/design/`, plans in `docs/plans/`. **An investigation gets a dated file at `docs/` root**, named `YYYY-MM-DD-what-broke.md`, the way `2026-06-20-no-sound-total-silence.md` records the silence bug. That convention is worth keeping: it is the only place a debugging trail survives.

**App Store assets.** `store/`, which is tracked: `listing.md` for copy, `store/screenshots/` for composed images. Staged assets here are not a submission.

**The iOS wrap.** `ios/`, via Capacitor. `ios/App` is tracked.

**Static assets.** `public/`. Audio under `public/audio`, images under `public/images`.

**Outputs, all ignored, none ever committed.** `build/`, `out/`, `node_modules/`, `.image-work/`.

### Never create

- **A backup beside a live file.** No `.new`, `.old`, `.bak`, `.before-rewrite`, no `-2` or `-copy` suffix. Git holds history; a sibling file is a second source of truth that someone will later read as current.
- **A second home for something that has one.** If a document fits `docs/design` or `docs/plans`, it goes there rather than into a new folder.
- **A status block outside `STATE.md`.** Current state belongs in one file. The block at the top of this one is the exception that proves it, and it is dated.
- **A plan file at the repository root.** `PLAN.md` is there and was last touched 2026-02-22; treat it as history, do not add siblings to it.

## Content rules

Vocabulary lives as JSON in `data/packs/` (33 packs, ~360 words, plus sentence tracks) and
`data/sentences/`. `prisma/seed.ts` upserts words and sentences; math is generated in
`prisma/seed-math.ts`.

**Never mutate an existing pack's content.** Mastery is `practiced / total items in pack`, so
adding items to a shipped pack drops a child from 100% to 60% and steals earned progress.
New content always gets a **new pack id**. (Full rule, including the FK-safe delete order
MathProgress/ChineseProgress → AnswerEvent → MathProblem/Word → Pack, is in
`.cursor/rules/content-packs.mdc`.)

**Every word must have a visual** — an illustration in `lib/word-images.json`, an emoji in its
data `image` field, or an `EMOJI_FALLBACKS` entry in `PictureChoice.tsx`. Run
`python3 scripts/audit-visuals.py` after any content batch and before any iOS build; 14 body-pack
words shipped text-only on 2026-08-21 and Jenny caught it in TestFlight.

Image pipeline: nanobanana (Gemini) is the default generator; when its quota is exhausted, fall
back to OpenAI `gpt-image-1` (~4¢/image, key in shell env) with the same `STYLE` prompt from
`scripts/generate-images.sh` plus white-point correction for its cream backgrounds.

## Environment & infrastructure

- Supabase project **`odwoxbxkvmjjqvjyynko`** is this app's production DB. `.env` also
  references `fhdjzktrpcsjleargmrb`, which belongs to an unrelated ai-memory-agent — do not
  confuse the two.
- Deployed on Vercel; domain `mandarineer.com` (Cloudflare, registered 2026-08-20).
- **Keepalive** (prevents Supabase free-tier idle pause): n8n workflow `yDEoYhLvu7gU1kzD` on
  Oracle (`141.148.2.254:5678`), daily at 9:17 — a direct Postgres `SELECT 1` via the session
  pooler is the primary check; a secondary HTTP ping to `/api/packs` cannot fail the run and now
  returns 401 by design (content routes require auth).
- `build/` holds local Xcode archives and `out/` the static export — both gitignored.

## Recent history

- 2026-08-21 → 08-27: iOS Capacitor shell shipped through build 5 — static export, header auth
  transport + CORS, offline cache, haptics; native audio fixed twice (clip loader read
  Capacitor's status-0 local responses as failure; then WebAudio → HTMLAudioElement); App Store
  listing copy and composed screenshots; content-visual invariant + audit script.
- 2026-08-20: Batch C content complete (33 packs, all 360 words illustrated); parent progress
  reports (`/parent/report` + ownership-checked report API); name locked to Mandarineer.
- 2026-08-19/20: Phase 3 audio (355 clips, clip-first playback); PWA install, OG image,
  robots/sitemap, guest-cleanup cron, trust pages.
- 2026-08-17: Phase 1 multi-tenancy — Supabase guest-first auth, Account/Child schema with the
  guarded expand/backfill/contract migration (preserved Julian's 501 hearts), `requireChild()`
  funnel, `/welcome`, `/switch`, rebuilt `/parent`.
- 2026-06-20: Audio hardening (shared AudioContext, first-gesture unlock) + sentence practice.
  Investigation trail: `docs/2026-06-20-no-sound-total-silence.md`.

## Rules for Claude running in GitHub Actions

These apply when Claude is started by the `claude` label on an issue or by `@claude` in a comment (`.github/workflows/claude.yml`). They are stricter than the local rules above.

1. **Work on a branch, never on `main`.** The action creates a `claude/...` branch. Push only to that branch. Never push to `main`, never force-push, never merge.
2. **Before you finish, run `npm run lint` and `npx tsc --noEmit`.** Both must pass. Put their result in the pull request description.
3. **Open a pull request** against `main` with `gh pr create`. Reference the issue (`Closes #N`). Do not merge it; a human merges.
4. **No iOS or Xcode steps.** Do not run `scripts/build-ios.sh`, `xcodebuild`, `cap sync`, simulators, or edit anything under `ios/`. The runner is Linux and these steps are Jenny's.
5. **Never change the content of a shipped pack.** Do not edit any file under `data/packs/` or `data/sentences/` that is already on `main`, and do not edit `lib/audio-manifest.json`, `lib/word-images.json`, `public/audio/`, or `public/images/`. Mastery is `practiced / total items`, so changing a shipped pack steals earned progress. New content always goes in a new pack id, and only when the issue asks for it.
6. **No database commands.** Do not run `prisma migrate`, `db:seed`, or anything that needs `DATABASE_URL`. The runner has no production credentials, and it must stay that way.
7. **No secrets in output.** Do not print environment variables or tokens in logs, commits, or comments.
8. If the issue asks for something these rules forbid, say so in a comment and stop.
