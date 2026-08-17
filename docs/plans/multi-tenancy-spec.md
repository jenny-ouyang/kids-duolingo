# Multi-Tenancy Design Spec

Status: DRAFT — awaiting owner decisions (see DECISION POINT markers)
Date: 2026-08-17
Scope: Take kids-duolingo from single-family ("julian" hardcoded everywhere, zero auth) to a public free web app with parent accounts and multiple children per account, ready to later wrap for iOS (one-time purchase).

Ground truth this spec was written against:

- `prisma/schema.prisma` — every progress model carries `childName String @default("julian")`; `ChildProfile` is keyed by `name`; `ChineseProgress` is `@@map`-ed to the physical table `WordProgress`; `AnswerEvent.itemId` is `@map`-ed to column `wordId`.
- `lib/db.ts` — Prisma 7 + `@prisma/adapter-pg` over a `pg` Pool on `DATABASE_URL` (Supabase transaction pooler). This is the **Node** runtime (the `pg` driver is not edge-compatible), despite CLAUDE.md saying "edge runtime". Auth design below assumes Node route handlers.
- `lib/progress.ts` — a legacy localStorage progress store (`julian-progress` key). Current pages use the API routes, not this file. It gets deleted, not migrated.
- 10 routes under `app/api/` (enumerated in §3). Every child-scoped one has `const CHILD = 'julian'` at the top.
- No auth packages installed. `package.json` has no `@supabase/*` deps.

---

## 1. Auth approach

### Recommendation: Supabase Auth, guest-first (anonymous sign-in), upsell to a parent account

Use **Supabase Auth anonymous sign-ins** as the entry point. First visit → `supabase.auth.signInAnonymously()` runs silently → the visitor immediately has a real `auth.users` row and a verifiable JWT → an `Account` row (flagged `isGuest`) and a first `Child` are created on first write. The kid plays within seconds; nothing is stored only in localStorage. When the parent wants to keep progress across devices (or later, buy the iOS unlock), they "claim" the account: `supabase.auth.updateUser({ email })` (magic link) or `linkIdentity()` (OAuth) converts the anonymous user to a permanent one **with the same user id**, so no data migration is ever needed.

Why this beats the alternatives for this app:

- **It matches the product.** A kids app lives or dies on time-to-first-question. A parent handing a phone to a 5-year-old will not complete a magic-link flow first.
- **Server-verifiable from day one.** Unlike "save to localStorage, sync later," every progress write goes through the same authenticated API path from the first session. No dual code path, no lossy local→server migration, no merge conflicts.
- **Free upgrade path.** Anonymous → permanent keeps the `auth.users.id`, so `Account.id` and every `childId` FK are untouched by account claiming.
- Costs: anonymous users accumulate in `auth.users` (cleanup job needed, §1.3), and anonymous sign-in should be protected with Supabase's built-in CAPTCHA (Turnstile) to prevent bot row-spam.

### Documented alternative: account-first (magic link / OAuth before play)

Parent lands on marketing page → "Get started" → email magic link or Google/Apple OAuth → create child profile → play.

- Pros: no guest cleanup, cleaner analytics, every account has a reachable parent email from day one (useful for COPPA-style parental contact and for the future purchase).
- Cons: brutal drop-off for a free app with no brand; magic link is a genuinely bad first-run flow on a kid-shared device (switch to email app, tap link, maybe opens wrong browser); blocks the "try it in 10 seconds" loop that makes free kids apps spread.
- When it would win: if Jenny plans to launch paid-from-day-one, or wants a hard parental gate before any data is written.

### Rejected: local-only guest (no server identity) with later import

Simplest-looking, but it forks every read/write path into local vs server variants, the SM-2 session picker would need a client-side reimplementation, and the eventual localStorage→DB import is exactly the kind of merge bug factory the current architecture (server-picked sessions, fire-and-forget writes) avoids. Not worth it when Supabase anonymous auth gives a server identity for free.

### Auth methods for the claimed (permanent) account

- **Email magic link** (Supabase OTP): baseline, no password to forget. Parent-facing only.
- **Google OAuth**: recommended for web — lowest-friction claim flow.
- **Apple OAuth**: required later — App Store rules mandate Sign in with Apple **if** any other third-party login (Google) is offered in the iOS app. Enable it when the iOS wrap ships; the web app can launch with magic link + Google only.
- No passwords. Nothing kid-facing ever asks for credentials; the child never sees an auth screen after first setup.

### Kids-app data posture (COPPA-adjacent)

The account holder is the parent. Children are represented by **nickname + avatar emoji only** — no birthdate, no photo, no email, no last name. This keeps the app out of "collecting personal information from children" territory for the web launch and simplifies the later App Store privacy questionnaire (Kids Category rules are stricter; revisit at wrap time).

> **DECISION POINT (Jenny): guest-first vs account-first.** This spec recommends and details guest-first; everything in §2–§6 works unchanged for account-first (just delete the anonymous branch and guest cleanup).

> **DECISION POINT (Jenny): OAuth providers at web launch.** Magic link only vs magic link + Google. (Apple is deferred to the iOS wrap either way.)

> **DECISION POINT (Jenny): guest retention.** How long do unclaimed anonymous accounts and their data live before deletion? Recommendation: 90 days since `lastPracticed` across all the account's children.

---

## 2. Schema migration

### 2.1 Target Prisma schema (new + changed models)

Content models (`Pack`, `Word`, `Sentence`, `MathProblem`, `GeneratedQuestion`) are shared across all tenants and **do not change**. The changed/new models:

```prisma
/// One row per Supabase auth user. id == auth.users.id (uuid string).
model Account {
  id        String   @id                      // Supabase auth.users.id
  email     String?  @unique                  // null while anonymous (guest)
  isGuest   Boolean  @default(true)           // flipped false when claimed
  plan      String   @default("free")         // future: "lifetime" after iOS one-time purchase
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  children  Child[]
}

/// Replaces ChildProfile. One account, many children.
model Child {
  id               String             @id @default(cuid())
  accountId        String
  account          Account            @relation(fields: [accountId], references: [id], onDelete: Cascade)
  name             String                                  // nickname only — no PII
  avatar           String             @default("🦁")
  totalHearts      Int                @default(0)
  streak           Int                @default(0)
  lastPracticed    DateTime?
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt
  chineseProgress  ChineseProgress[]
  sentenceProgress SentenceProgress[]
  mathProgress     MathProgress[]
  answerEvents     AnswerEvent[]

  @@index([accountId])
}

model ChineseProgress {
  id          String   @id @default(cuid())
  childId     String
  child       Child    @relation(fields: [childId], references: [id], onDelete: Cascade)
  packId      String
  pack        Pack     @relation(fields: [packId], references: [id])
  wordId      String
  word        Word     @relation(fields: [wordId], references: [id])
  easiness    Float    @default(2.5)
  interval    Int      @default(1)
  repetitions Int      @default(0)
  nextReview  DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([childId, packId, wordId])
  @@index([childId, packId])
  @@map("WordProgress")                 // keep existing physical table name
}
```

`SentenceProgress` and `MathProgress` change identically: `childName` → `childId` + `child` relation with `onDelete: Cascade`, `@@unique([childId, packId, sentenceId|problemId])`, `@@index([childId, packId])`. `AnswerEvent` likewise: `childId` FK, `@@index([childId, packId, itemId])`, keep `@@index([answeredAt])` and the `itemId @map("wordId")` quirk. `ChildProfile` is dropped (data folded into `Child`).

Note: `SentenceProgress` currently has **zero rows in practice** — the sentence routes serve static JSON and `/api/progress` POST only writes chinese/math. Migrate the table anyway (cheap), but don't build sentence-progress plumbing as part of this project.

### 2.2 Migration path (expand → backfill → contract)

Three steps so production never breaks mid-deploy, and "julian" data survives intact.

**Step 1 — expand (additive Prisma migration, safe to deploy before any code change):**
- Create `Account` and `Child` tables.
- Add **nullable** `childId TEXT` columns to `WordProgress` (=ChineseProgress), `SentenceProgress`, `MathProgress`, `AnswerEvent`, plus the new indexes. No constraints dropped yet; old code keeps writing `childName = 'julian'`.

**Step 2 — backfill (one-off script `scripts/backfill-julian.ts`, run with the session-mode pooler URL like the seeds):**
1. Jenny signs up once in production with her real email (or the script creates the auth user via the Supabase Admin API using `SUPABASE_SERVICE_ROLE_KEY`). Her `auth.users.id` is passed as `JENNY_USER_ID`.
2. `INSERT Account (id = JENNY_USER_ID, email = jenny's email, isGuest = false)`.
3. Create `Child` "Julian" under that account, copying `totalHearts`, `streak`, `lastPracticed` from the existing `ChildProfile` row where `name = 'julian'`.
4. `UPDATE` each of the four progress tables: `SET childId = <julianChildId> WHERE childName = 'julian'` (which is every row today).
5. Verify: zero rows with `childId IS NULL` in any of the four tables.

**Step 3 — contract (second Prisma migration, deployed together with the new route code):**
- `childId` → `NOT NULL`, add the FKs with `ON DELETE CASCADE`.
- Add the new `@@unique([childId, ...])` constraints; drop the old `childName_*` uniques and indexes; drop the `childName` columns.
- Drop `ChildProfile`.

Because the app is effectively single-user today, the deploy window risk is near zero — but the 3-step shape means even a mid-window practice session only produces rows that Step 2 can re-run over (the backfill is idempotent: keyed on `childName = 'julian' AND childId IS NULL`).

> **DECISION POINT (Jenny): email for the migrated account.** The spec assumes `bingjie.j.ouyang@gmail.com`; confirm which email should own the Julian data.

---

## 3. API route changes

Shared plumbing first, then route-by-route.

**New helper `lib/auth.ts`:**

```ts
// getAuthContext(req): reads Supabase auth cookies via @supabase/ssr,
//   validates the JWT (supabase.auth.getUser() — never trust getSession() server-side),
//   returns { userId } or throws 401.
// requireChild(req): getAuthContext + read `kd_child` cookie +
//   ONE prisma query: child = findFirst({ id: cookieChildId, accountId: userId }).
//   Falls back to the account's first child if the cookie is missing/stale.
//   Returns { userId, child } or throws 401/403.
// ensureAccount(userId): upsert Account row on first authenticated request
//   (creates the guest Account + default Child on first play).
```

The **fire-and-forget pattern is preserved exactly**: clients still call `fetch('/api/progress', …)` / `/api/answers` / `/api/profile` without awaiting or blocking the UI. Auth adds one ownership check inside the handler before the write; failures still return errors that the client ignores. Nothing about the write path becomes synchronous for the UI.

| Route | Methods | Today | Change |
|---|---|---|---|
| `/api/packs` | GET | Hardcoded `CHILD` for mastery rings | **Auth + child scope.** Content query unchanged; mastery aggregation filtered by `childId`. Guest users are authed (anonymous JWT), so no unauthenticated branch needed. |
| `/api/packs/[packId]` | GET | Content only, no child data | **Auth check only** (no child scoping — shared content). Could stay public; require auth anyway so every API surface is uniform and rate-limitable per user. |
| `/api/questions/[packId]` | GET | `CHILD` for progress + recent-wrong | **Auth + child scope** on the `chineseProgress` and `answerEvent` lookups feeding `pickWordsForSession`. |
| `/api/math/questions/[topicId]` | GET | `CHILD` for progress + recent-wrong | **Auth + child scope**, same as above on `mathProgress` + `answerEvent`. |
| `/api/sentences/[packId]` | GET | Static JSON, no DB | **Auth check only.** No scoping (no per-child data). |
| `/api/sentences/all` | GET | Static JSON, no DB | Same. |
| `/api/progress` | GET, POST | `CHILD` in every query; upserts keyed `childName_packId_wordId` | **Auth + child scope.** Upsert keys become `childId_packId_wordId` / `childId_packId_problemId`. Fire-and-forget POST preserved. |
| `/api/answers` | GET, POST | `CHILD` const | **Auth + child scope.** POST stays fire-and-forget. |
| `/api/profile` | GET, POST | Upserts `ChildProfile` by `name: 'julian'` | **Auth + child scope; now reads/writes the active `Child` row** (hearts, streak, lastPracticed — streak logic unchanged, just re-keyed). POST stays fire-and-forget. |
| `/api/generate-options` | POST | 410 stub | No change. |
| `/api/children` **(new)** | GET, POST, PATCH, DELETE | — | List children for the account; create (name + avatar, cap at e.g. 6); rename/re-avatar; delete (cascades progress). Auth required; all rows scoped `accountId = userId`. |
| `/api/account` **(new, optional at launch)** | GET | — | Returns `{ email, isGuest, plan, childCount }` for the parent screen; the "claim account" flow itself is client-side Supabase (`updateUser`/`linkIdentity`), no custom route needed. |

Also: `middleware.ts` (new) runs `@supabase/ssr` token refresh on every request so route handlers always see a fresh session, and performs the silent `signInAnonymously()` bootstrap redirect-free on first visit (or the root layout does the bootstrap client-side — either is fine; pick client-side to keep middleware thin).

Pages touched: `app/page.tsx` ("Hi, Julian!" → active child's name + avatar, plus child-switcher entry), `app/parent/page.tsx` (becomes the parent zone: children management, claim-account upsell, sign out), `app/celebrate/page.tsx` and both practice pages (no query changes — they already talk to the APIs; they just stop assuming Julian in copy). Delete `lib/progress.ts` (legacy localStorage store, unused by current pages).

---

## 4. Session & child-switching UX

- **Active child = one cookie: `kd_child=<childId>`**, plain (not httpOnly), `SameSite=Lax`, 1-year max-age, set by the client when a child is picked. A cookie, not localStorage, because **server route handlers need it** (every scoped query reads it) and cookies flow automatically with `fetch`; localStorage would force every call site to append a header/param. It survives the future iOS WKWebView wrap the same way the Supabase auth cookies do.
- The cookie is a *hint, never an authority*: `requireChild` validates on every request that the cookie's child belongs to the authenticated account, and silently falls back to the account's first child otherwise. So a tampered cookie can never touch another family's data.
- **Flow:** first visit → anonymous sign-in → "Who's learning?" screen creates the first child (name + avatar picker) → cookie set → straight to the subject picker. Accounts with one child never see a picker again. Accounts with 2+ children get a tappable avatar in the home header that opens a full-screen, kid-friendly switcher (big avatar tiles). Switching sets the cookie and re-fetches `/api/profile` + pack mastery.
- Adding/renaming/removing children lives behind the parent zone (`/parent`), which should get a trivial adult gate (e.g. "type the answer: 7 × 8") — standard kids-app pattern, not a security boundary.

---

## 5. Security model

### Server-side auth validation

- Add `@supabase/supabase-js` + `@supabase/ssr`. Create `lib/supabase-server.ts` exporting `createServerClient` wired to Next 14 `cookies()` per the official SSR pattern, and `middleware.ts` for session refresh.
- In every route handler: `const { data: { user } } = await supabase.auth.getUser()` — this **verifies the JWT against Supabase Auth** rather than trusting the cookie payload (`getSession()` alone is spoofable server-side and must not be used for authorization). 401 on null user. Routes stay on the Node runtime (they must — `pg` driver), which `@supabase/ssr` fully supports.
- Env additions (Vercel + `.env`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`; `SUPABASE_SERVICE_ROLE_KEY` only if the backfill/cleanup scripts use the Admin API. `DATABASE_URL` unchanged.

### RLS vs app-layer scoping — recommendation: **app-layer scoping for Prisma, plus RLS enabled as a lockdown (no policies) on all app tables**

- Prisma connects through the pooler as the `postgres` (table-owner) role. Table owners and `service_role` **bypass RLS entirely**, and making Prisma genuinely RLS-enforced would require a dedicated non-owner role plus per-transaction `set_config('request.jwt.claims', …)` — which fights the transaction-mode pooler and Prisma's connection reuse. Not worth it for this app's threat model. **All tenant isolation therefore lives in the app layer**, concentrated in one place: `requireChild()` is the only way handlers obtain a `childId`, and no handler ever accepts a `childId`/`accountId` from the request body. That single-funnel design is what makes app-layer scoping auditable.
- **However, RLS must still be turned ON** (with zero policies, i.e. deny-all) for every table in the `public` schema — `Account`, `Child`, `WordProgress`, `SentenceProgress`, `MathProgress`, `AnswerEvent`, `Pack`, `Word`, `Sentence`, `MathProblem`, `GeneratedQuestion`. Reason: Supabase auto-exposes `public` tables through the PostgREST Data API, and once real users hold anon/authenticated JWTs (which guest-first hands to every visitor), an un-RLS'd table is readable and writable by anyone with the public anon key. Enabling RLS with no policies closes that entire surface while leaving Prisma (owner role) unaffected. Alternative: disable the Data API for the project entirely in Supabase settings — do that too if nothing else uses it (the n8n keepalive hits `/api/packs` over HTTP and a direct Postgres `SELECT 1`, so nothing depends on PostgREST).
- Content tables could later get a read-only `SELECT` policy if a future client wants to read packs directly from Supabase; not needed now — everything goes through the Next API.

---

## 6. Implementation task list (ordered)

| # | Task | Effort |
|---|---|---|
| 1 | Supabase dashboard prep: enable anonymous sign-ins (+ Turnstile CAPTCHA), enable email OTP (magic link), configure site URL/redirects; decide Google OAuth per DECISION POINT | 1–2 h |
| 2 | Install `@supabase/supabase-js` + `@supabase/ssr`; add `lib/supabase-server.ts`, `lib/supabase-browser.ts`, `middleware.ts` (session refresh); env vars in Vercel + `.env` | 2 h |
| 3 | **Migration step 1 (expand):** new schema models + nullable `childId` columns; `prisma migrate dev` against a branch/staging DB, then deploy migration to prod (old code unaffected) | 2–3 h |
| 4 | **Backfill:** write + run `scripts/backfill-julian.ts` (idempotent), create Jenny's account, map all `childName='julian'` rows; verify zero NULL `childId` | 2 h |
| 5 | `lib/auth.ts`: `getAuthContext`, `requireChild`, `ensureAccount` (guest Account+Child bootstrap) with unit-testable pure core | 3 h |
| 6 | Convert the 8 DB-touching routes to auth + child scoping (mechanical once #5 exists); add `/api/children` CRUD; keep fire-and-forget semantics | 4–6 h |
| 7 | **Migration step 2 (contract):** NOT NULL + FKs + new uniques, drop `childName`, drop `ChildProfile`; deploy simultaneously with #6's code | 2 h |
| 8 | Client: anonymous-auth bootstrap on first visit; "Who's learning?" child creation screen; child switcher + `kd_child` cookie; de-Julianize `app/page.tsx` and practice/celebrate copy; delete `lib/progress.ts` | 6–8 h |
| 9 | Parent zone (`/parent`): children management, claim-account flow (magic link / Google via `updateUser`/`linkIdentity`), sign out, adult gate | 4–6 h |
| 10 | Security lockdown: enable RLS (deny-all) on all public tables; disable/verify PostgREST Data API exposure; confirm n8n keepalive still green | 1 h |
| 11 | QA pass on real devices (guest flow, claim flow, two-children switching, iOS Safari audio still primed post-auth-redirects); update CLAUDE.md architecture notes | 3–4 h |
| 12 | (Deferred, pre-iOS-wrap) Apple OAuth, `plan` gating for one-time purchase, guest-cleanup cron per retention DECISION POINT | — |

Total: roughly **30–37 focused hours** to public-launch-ready (tasks 1–11).

---

## Decision points (summary for Jenny)

1. **Guest-first (recommended) vs account-first** onboarding.
2. **OAuth at web launch:** magic link only, or magic link + Google. (Apple deferred to iOS wrap regardless.)
3. **Guest data retention:** how long unclaimed anonymous accounts live (recommendation: 90 days after last practice).
4. **Owner email** for the migrated Julian data (assumed `bingjie.j.ouyang@gmail.com`).
5. **Future monetization boundary** (not built now, but shapes `Account.plan`): what stays free on web when the iOS one-time purchase exists — everything on web free forever, or feature-gate both platforms?
