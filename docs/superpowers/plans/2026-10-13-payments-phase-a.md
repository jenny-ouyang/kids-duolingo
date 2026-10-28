# Payments Phase A — Gate, Kid UI, Parent Unlock Card (dormant) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship everything in the payments spec that can land before Stripe keys and Apple paperwork exist: the server-side pack gate, the new account fields, the paid-guest cleanup guard, the kid-facing lock UI, and the Parent Zone unlock card (web path), all inert until `PAYMENTS_ENABLED=true` is set on the server.

**Architecture:** One helper module (`lib/plan.ts`, client-safe) owns the free list and the access rule; one server module (`lib/pack-gate.ts`) turns that rule into a thrown error and a 402 response that five API routes share. `getAuthContext()` returns the `Account` row so routes never re-query the plan. `/api/packs` keeps its array shape (build 6 clients depend on it) and gains `locked` per pack; a new `GET /api/account` feeds the Parent Zone card. Nothing reads `NEXT_PUBLIC_PAYMENTS_ENABLED` any more; the switch is `process.env.PAYMENTS_ENABLED` on the server only.

**Tech Stack:** Next.js 14 App Router (Node runtime routes), Prisma 7 with `@prisma/adapter-pg`, Supabase Auth, Tailwind + framer-motion kid UI, vitest (new) for unit tests, node + `pg` scripts for end-to-end checks against the dev server.

**Spec:** `docs/superpowers/specs/2026-10-13-payments-design.md` (sections 2, 3, 4, 7, 9, 10 Phase A). Phases B (Stripe) and C (Apple) get their own plans after this one merges.

## Global Constraints

- Free forever: `animals`, `colors`, `numbers`, `math_add_singles`. The `sentences` pseudo-pack (the "practice sentences from everywhere" mode, DB pack id `sentences`) is treated as free; its content is filtered to sentences whose source pack the account can access.
- Server-side switch only: `process.env.PAYMENTS_ENABLED === 'true'`. Delete every use of `NEXT_PUBLIC_PAYMENTS_ENABLED`. While the switch is off, every pack is accessible and no lock UI shows.
- Locked responses are `402` with body `{ "error": "locked", "packId": "<id>" }` on `GET /api/questions/[packId]`, `GET /api/math/questions/[topicId]`, `GET /api/sentences/[packId]`, `POST /api/progress`, `POST /api/answers`.
- `GET /api/packs` stays an **array** (build 6 in the field parses it as one). Each element gains `locked: boolean`. Do not add top-level fields.
- A child screen never shows a price, a buy button, or an external link. The only path from a lock to a purchase is the "Grown-ups" button → `/parent`, which sits behind the existing multiplication gate.
- `app/api/cron/cleanup-guests/route.ts` must never delete an account whose `plan !== 'free'`.
- All client → API calls go through `lib/api-fetch.ts` (`apiFetch`, `fetchJsonWithAuthRetry`, `fetchJsonCached`). Never a bare `fetch('/api/...')`.
- Handlers obtain the account only from `getAuthContext()` / `requireChild()`; never from a body or query string.
- Copy for kids is short and warm (Sunrise Playground voice). Copy for the Parent Zone is calm and plain.
- Work on branch `payments-phase-a`; commit after every task; open a PR against `main` at the end (`main` requires a PR; Jenny's account can bypass but this plan does not).
- Quality gates on every task: `npx tsc --noEmit` clean and `npm run lint` with no new warnings; `npm test` green from Task 1 on.
- Prisma migrations: write the SQL by hand under `prisma/migrations/<timestamp>_<name>/migration.sql` and apply with `npx prisma migrate deploy` (never `prisma migrate dev` against this database — it is production).

---

## File map

| File | Responsibility | Task |
|---|---|---|
| `package.json`, `vitest.config.ts` | test runner, `npm test` | 1 |
| `lib/plan.ts` | free list, `isPackFree`, `canAccessPack`, `paymentsEnabled`, `hasLifetime`, price display | 1 |
| `lib/plan.test.ts` | unit tests for the rule | 1 |
| `prisma/schema.prisma`, `prisma/migrations/20261013120000_payments_fields/migration.sql` | new `Account` fields | 2 |
| `lib/auth.ts` | `getAuthContext` returns `account`; `requireChild` passes it through | 3 |
| `app/api/cron/cleanup-guests/route.ts`, `app/api/cron/cleanup-guests/route.test.ts` | paid-guest guard | 4 |
| `lib/pack-gate.ts`, `lib/pack-gate.test.ts` | `assertPackAccess`, `PackLockedError`, `packLockedResponse` | 5 |
| `app/api/questions/[packId]/route.ts`, `app/api/math/questions/[topicId]/route.ts`, `app/api/sentences/[packId]/route.ts`, `app/api/sentences/all/route.ts`, `app/api/progress/route.ts`, `app/api/answers/route.ts` | apply the gate | 5 |
| `app/api/packs/route.ts` | `locked` per pack | 6 |
| `app/api/account/route.ts` | plan, founder, guest, paymentsEnabled, pack counts for the Parent Zone | 6 |
| `components/kid/AskGrownUp.tsx` | the kid lock card | 7 |
| `app/packs/page.tsx`, `app/math/topics/page.tsx` | lock badge + card on tap | 7 |
| `app/practice/session/page.tsx`, `app/math/practice/session/page.tsx` | 402 → AskGrownUp | 7 |
| `app/parent/page.tsx` (new `UnlockSection`), `app/unlock/page.tsx`, `app/api/stripe/checkout/route.ts` | Parent Zone unlock card (web path), `/unlock` redirect, server switch + guest refusal | 8 |
| `scripts/e2e-gate.mjs` | end-to-end check against the dev server | 9 |
| `AGENTS.md`, spec amendments, PR | docs | 10 |

---

### Task 1: vitest + the access rule in `lib/plan.ts`

**Files:**
- Modify: `package.json` (devDependencies, scripts)
- Create: `vitest.config.ts`
- Modify: `lib/plan.ts`
- Create: `lib/plan.test.ts`

**Interfaces:**
- Produces:
  - `FREE_PACK_IDS: readonly ['animals', 'colors', 'numbers', 'math_add_singles', 'sentences']`
  - `isPackFree(packId: string): boolean`
  - `hasLifetime(account: { plan: string }): boolean` (unchanged)
  - `paymentsEnabled(): boolean` — `process.env.PAYMENTS_ENABLED === 'true'`
  - `canAccessPack(account: { plan: string }, packId: string): boolean` — true when payments are off, the pack is free, or the account is lifetime
  - `LIFETIME_PRICE_DISPLAY = '$9.99'` (unchanged)
  - `PAYMENTS_ENABLED` constant is **removed**.

- [x] **Step 1: Install vitest and add the test script**

```bash
cd /Users/jennyouyang/Documents/apps/kids-duolingo
git checkout -b payments-phase-a
npm install --save-dev vitest@^3
```

Edit `package.json` scripts: add `"test": "vitest run"` after the `"lint"` line.

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [x] **Step 2: Write the failing tests**

Create `lib/plan.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { FREE_PACK_IDS, canAccessPack, hasLifetime, isPackFree, paymentsEnabled } from '@/lib/plan'

const free = { plan: 'free' }
const lifetime = { plan: 'lifetime' }

afterEach(() => {
  delete process.env.PAYMENTS_ENABLED
})

describe('free list', () => {
  it('contains exactly the four free packs plus the sentences practice mode', () => {
    expect([...FREE_PACK_IDS].sort()).toEqual(
      ['animals', 'colors', 'math_add_singles', 'numbers', 'sentences'].sort()
    )
  })
  it('isPackFree is true only for listed ids', () => {
    expect(isPackFree('animals')).toBe(true)
    expect(isPackFree('math_add_singles')).toBe(true)
    expect(isPackFree('food')).toBe(false)
    expect(isPackFree('s1-this-is')).toBe(false)
    expect(isPackFree('')).toBe(false)
  })
})

describe('paymentsEnabled', () => {
  it('is false unless PAYMENTS_ENABLED is exactly "true"', () => {
    expect(paymentsEnabled()).toBe(false)
    process.env.PAYMENTS_ENABLED = 'TRUE'
    expect(paymentsEnabled()).toBe(false)
    process.env.PAYMENTS_ENABLED = '1'
    expect(paymentsEnabled()).toBe(false)
    process.env.PAYMENTS_ENABLED = 'true'
    expect(paymentsEnabled()).toBe(true)
  })
})

describe('canAccessPack', () => {
  it('allows everything while payments are off', () => {
    expect(canAccessPack(free, 'food')).toBe(true)
    expect(canAccessPack(free, 's3-where-have')).toBe(true)
  })
  it('allows free packs for free accounts when payments are on', () => {
    process.env.PAYMENTS_ENABLED = 'true'
    expect(canAccessPack(free, 'animals')).toBe(true)
    expect(canAccessPack(free, 'math_add_singles')).toBe(true)
    expect(canAccessPack(free, 'sentences')).toBe(true)
  })
  it('locks paid packs for free accounts when payments are on', () => {
    process.env.PAYMENTS_ENABLED = 'true'
    expect(canAccessPack(free, 'food')).toBe(false)
    expect(canAccessPack(free, 'math_add_tens')).toBe(false)
    expect(canAccessPack(free, 's1-this-is')).toBe(false)
  })
  it('allows everything for lifetime accounts when payments are on', () => {
    process.env.PAYMENTS_ENABLED = 'true'
    expect(canAccessPack(lifetime, 'food')).toBe(true)
    expect(canAccessPack(lifetime, 's1-this-is')).toBe(true)
  })
  it('hasLifetime matches only the lifetime plan string', () => {
    expect(hasLifetime(lifetime)).toBe(true)
    expect(hasLifetime(free)).toBe(false)
    expect(hasLifetime({ plan: 'Lifetime' })).toBe(false)
  })
})
```

- [x] **Step 3: Run the tests to see them fail**

Run: `npm test`
Expected: FAIL — `isPackFree`, `paymentsEnabled`, `canAccessPack` are not exported; the free-list test fails on the missing `math_add_singles` and `sentences`.

- [x] **Step 4: Rewrite `lib/plan.ts`**

Replace the whole file with:

```ts
/**
 * Plan / payments — the single switch point for the payment layer.
 *
 * The switch is SERVER-SIDE ONLY: process.env.PAYMENTS_ENABLED === 'true'.
 * Never read it on the client — the iOS bundle is a static export and would
 * freeze the value at build time. Clients learn the state from the API
 * (`locked` on each pack in GET /api/packs, `paymentsEnabled` in GET /api/account).
 *
 * This module must stay safe to import from client components: no Prisma,
 * no next/server.
 */

/** One-time purchase price shown in the Parent Zone (Stripe is the source of truth via STRIPE_PRICE_ID). */
export const LIFETIME_PRICE_DISPLAY = '$9.99'

/**
 * The free tier (spec 2026-10-13 §1): three Chinese packs, one math topic, and
 * the `sentences` practice mode (its CONTENT is filtered per source pack in
 * /api/sentences/all; the mode itself is always reachable).
 */
export const FREE_PACK_IDS = ['animals', 'colors', 'numbers', 'math_add_singles', 'sentences'] as const

const FREE_SET: ReadonlySet<string> = new Set(FREE_PACK_IDS)

export function isPackFree(packId: string): boolean {
  return FREE_SET.has(packId)
}

/** True when the account has purchased the one-time lifetime unlock. */
export function hasLifetime(account: { plan: string }): boolean {
  return account.plan === 'lifetime'
}

/** Server-side switch. Read at call time so tests and Vercel env changes take effect without a rebuild. */
export function paymentsEnabled(): boolean {
  return process.env.PAYMENTS_ENABLED === 'true'
}

/**
 * THE access rule. Every gated route and the pack list go through here.
 * Payments off → everything is open (today's behaviour).
 */
export function canAccessPack(account: { plan: string }, packId: string): boolean {
  if (!paymentsEnabled()) return true
  if (isPackFree(packId)) return true
  return hasLifetime(account)
}
```

- [x] **Step 5: Run the tests and the type check**

Run: `npm test`
Expected: PASS (6 tests).

Run: `npx tsc --noEmit`
Expected: errors in `app/unlock/page.tsx` and `app/api/stripe/checkout/route.ts` (they import the removed `PAYMENTS_ENABLED`). That is expected until Task 8. To keep the branch green per task, make the two minimal edits now:

In `app/api/stripe/checkout/route.ts` change the import line to
```ts
import { paymentsEnabled, hasLifetime } from '@/lib/plan'
```
and the guard to
```ts
  if (!paymentsEnabled() || !secretKey || !priceId) {
```

In `app/unlock/page.tsx` change the import line to
```ts
import { LIFETIME_PRICE_DISPLAY } from '@/lib/plan'
```
and the line `if (!PAYMENTS_ENABLED) return <FreeEarlyAccess />` to
```ts
  if (true) return <FreeEarlyAccess /> // Task 8 replaces this page with a redirect
```

Run: `npx tsc --noEmit && npm run lint`
Expected: clean (the `if (true)` line may produce a lint warning `no-constant-condition`; if it does, use `const EARLY_ACCESS = true` above the component and `if (EARLY_ACCESS)` instead).

- [x] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/plan.ts lib/plan.test.ts app/unlock/page.tsx app/api/stripe/checkout/route.ts
git commit -m "feat(plan): server-side payments switch, free list incl. math_add_singles, canAccessPack rule + vitest"
```

---

### Task 2: Account fields for entitlements

**Files:**
- Modify: `prisma/schema.prisma` (model `Account`, lines 12–20)
- Create: `prisma/migrations/20261013120000_payments_fields/migration.sql`

**Interfaces:**
- Produces on `Account`: `planSource: String?`, `planGrantedAt: DateTime?`, `isFounder: Boolean @default(false)`, `stripeCheckoutSessionId: String? @unique`, `stripePaymentIntentId: String?`, `appleOriginalTransactionId: String? @unique`.

- [x] **Step 1: Edit the Prisma model**

Replace the `Account` model with:

```prisma
model Account {
  id                         String    @id
  email                      String?   @unique
  isGuest                    Boolean   @default(true)
  plan                       String    @default("free")
  /// 'stripe' | 'apple' | 'manual' — which system granted `plan`. Refunds downgrade only when the source matches.
  planSource                 String?
  planGrantedAt              DateTime?
  /// Founder promise (spec 2026-10-13 §1): every future pack and upgrade free, forever. Never cleared by a refund of another source.
  isFounder                  Boolean   @default(false)
  stripeCheckoutSessionId    String?   @unique
  stripePaymentIntentId      String?
  /// One Apple purchase binds to at most one account at a time (restore moves it).
  appleOriginalTransactionId String?   @unique
  createdAt                  DateTime  @default(now())
  updatedAt                  DateTime  @updatedAt
  children                   Child[]
}
```

- [x] **Step 2: Write the migration SQL by hand**

Create `prisma/migrations/20261013120000_payments_fields/migration.sql`:

```sql
-- Payments Phase A: entitlement bookkeeping on Account (spec 2026-10-13 §2).
ALTER TABLE "Account"
  ADD COLUMN "planSource" TEXT,
  ADD COLUMN "planGrantedAt" TIMESTAMP(3),
  ADD COLUMN "isFounder" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "stripeCheckoutSessionId" TEXT,
  ADD COLUMN "stripePaymentIntentId" TEXT,
  ADD COLUMN "appleOriginalTransactionId" TEXT;

CREATE UNIQUE INDEX "Account_stripeCheckoutSessionId_key" ON "Account"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "Account_appleOriginalTransactionId_key" ON "Account"("appleOriginalTransactionId");
```

- [x] **Step 3: Apply and regenerate**

Run: `npx prisma migrate deploy`
Expected: `1 migration found … Applying migration 20261013120000_payments_fields … All migrations have been successfully applied.`

Run: `npx prisma generate`
Expected: `Generated Prisma Client … to ./lib/generated/prisma`

Run: `npx prisma migrate status`
Expected: `Database schema is up to date!`

- [x] **Step 4: Verify the columns exist**

Run:
```bash
node --input-type=module -e "
import pg from 'pg'; import fs from 'fs';
const env = fs.readFileSync('.env','utf8'); const url = (env.match(/^DIRECT_URL=\"?([^\"\n]+)\"?/m) || env.match(/^DATABASE_URL=\"?([^\"\n]+)\"?/m))[1];
const c = new pg.Client({ connectionString: url }); await c.connect();
const r = await c.query(\"select column_name from information_schema.columns where table_name='Account' order by ordinal_position\");
console.log(r.rows.map(x=>x.column_name).join(', ')); await c.end();"
```
Expected output includes: `planSource, planGrantedAt, isFounder, stripeCheckoutSessionId, stripePaymentIntentId, appleOriginalTransactionId`.

- [x] **Step 5: Type check and commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add prisma/schema.prisma prisma/migrations/20261013120000_payments_fields/migration.sql
git commit -m "feat(db): Account entitlement fields — planSource, planGrantedAt, isFounder, Stripe + Apple ids"
```

---

### Task 3: `getAuthContext()` returns the account

**Files:**
- Modify: `lib/auth.ts` (function `getAuthContext`, lines 29–83; `requireChild`, lines 91–113)

**Interfaces:**
- Produces: `getAuthContext(): Promise<{ userId: string; account: Account }>` and `requireChild(): Promise<{ userId: string; account: Account; child: Child }>` where `Account` is the Prisma model type from `@/lib/generated/prisma`. Existing callers that destructure `{ userId }` or `{ child }` keep working.

- [x] **Step 1: Return the row the function already has**

In `lib/auth.ts`:

Change the import line
```ts
import type { Child } from '@/lib/generated/prisma'
```
to
```ts
import type { Account, Child } from '@/lib/generated/prisma'
```

Change the signature
```ts
export async function getAuthContext(): Promise<{ userId: string }> {
```
to
```ts
export async function getAuthContext(): Promise<{ userId: string; account: Account }> {
```

In the guest-claim branch, capture the updated row. Replace:
```ts
  if (existing.isGuest && !isGuest) {
    // Guest just claimed the account (magic link / OAuth) — record it.
    try {
      await prisma.account.update({
        where: { id: user.id },
        data: { email: userEmail ?? existing.email, isGuest: false },
      })
    } catch (err) {
      if (!isUniqueViolation(err)) throw err
      // Email already on another Account row — still flip isGuest so this
      // branch doesn't re-fire (and fail) on every subsequent request.
      await prisma.account.update({
        where: { id: user.id },
        data: { isGuest: false },
      })
    }
  }

  return { userId: user.id }
```
with:
```ts
  if (existing.isGuest && !isGuest) {
    // Guest just claimed the account (magic link / OAuth) — record it.
    try {
      existing = await prisma.account.update({
        where: { id: user.id },
        data: { email: userEmail ?? existing.email, isGuest: false },
      })
    } catch (err) {
      if (!isUniqueViolation(err)) throw err
      // Email already on another Account row — still flip isGuest so this
      // branch doesn't re-fire (and fail) on every subsequent request.
      existing = await prisma.account.update({
        where: { id: user.id },
        data: { isGuest: false },
      })
    }
  }

  return { userId: user.id, account: existing }
```

Change `requireChild`:
```ts
export async function requireChild(): Promise<{ userId: string; child: Child }> {
  const { userId } = await getAuthContext()
```
to
```ts
export async function requireChild(): Promise<{ userId: string; account: Account; child: Child }> {
  const { userId, account } = await getAuthContext()
```
and its last line `return { userId, child }` to `return { userId, account, child }`.

- [x] **Step 2: Type check, lint, tests**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all clean. (No caller breaks: every existing destructure is a subset.)

- [x] **Step 3: Commit**

```bash
git add lib/auth.ts
git commit -m "feat(auth): getAuthContext/requireChild return the Account row for plan checks"
```

---

### Task 4: The cleanup job never deletes a paid account

**Files:**
- Modify: `app/api/cron/cleanup-guests/route.ts` (the `findMany` where clause, lines 21–27)
- Create: `app/api/cron/cleanup-guests/route.test.ts`

**Interfaces:**
- Consumes: nothing new. The route stays `GET` with the bearer check.

- [x] **Step 1: Write the failing test**

Create `app/api/cron/cleanup-guests/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const findMany = vi.fn()
const del = vi.fn()
const executeRawUnsafe = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    account: { findMany, delete: del },
    $executeRawUnsafe: executeRawUnsafe,
  },
}))

import { GET } from './route'

function req(auth?: string) {
  return new Request('http://localhost/api/cron/cleanup-guests', {
    headers: auth ? { authorization: auth } : {},
  }) as unknown as import('next/server').NextRequest
}

describe('cleanup-guests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
    findMany.mockResolvedValue([{ id: '11111111-1111-1111-1111-111111111111' }])
    del.mockResolvedValue({})
    executeRawUnsafe.mockResolvedValue(1)
  })

  it('rejects a missing or wrong secret', async () => {
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(findMany).not.toHaveBeenCalled()
  })

  it('only selects guest accounts on the free plan', async () => {
    const res = await GET(req('Bearer test-secret'))
    expect(res.status).toBe(200)
    const where = findMany.mock.calls[0][0].where
    expect(where.isGuest).toBe(true)
    expect(where.plan).toBe('free')
    expect(where.createdAt.lt).toBeInstanceOf(Date)
  })

  it('deletes each selected account and its anonymous auth user', async () => {
    await GET(req('Bearer test-secret'))
    expect(del).toHaveBeenCalledWith({ where: { id: '11111111-1111-1111-1111-111111111111' } })
    expect(executeRawUnsafe).toHaveBeenCalledTimes(1)
  })
})
```

- [x] **Step 2: Run it to see it fail**

Run: `npm test`
Expected: FAIL on `expect(where.plan).toBe('free')` — received `undefined`.

- [x] **Step 3: Add the guard**

In `app/api/cron/cleanup-guests/route.ts`, change the where clause to:

```ts
    where: {
      isGuest: true,
      // Never delete a paid account (spec 2026-10-13 §7 rule 2). A guest who
      // bought the unlock keeps it even if they never add an email.
      plan: 'free',
      createdAt: { lt: cutoff },
      children: { none: { lastPracticed: { gte: cutoff } } },
    },
```

Also update the doc comment line `Claimed accounts are never touched.` to `Claimed accounts and paid accounts are never touched.`

- [x] **Step 4: Run tests, type check, lint**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: PASS (9 tests), clean.

- [x] **Step 5: Commit**

```bash
git add app/api/cron/cleanup-guests/route.ts app/api/cron/cleanup-guests/route.test.ts
git commit -m "fix(cron): never delete a paid guest account"
```

---

### Task 5: The gate on the five routes

**Files:**
- Create: `lib/pack-gate.ts`, `lib/pack-gate.test.ts`
- Modify: `app/api/questions/[packId]/route.ts` (after `requireChild()`), `app/api/math/questions/[topicId]/route.ts` (same), `app/api/sentences/[packId]/route.ts` (after `getAuthContext()`), `app/api/sentences/all/route.ts` (filter), `app/api/progress/route.ts` (POST, after `requireChild()`), `app/api/answers/route.ts` (POST, after `requireChild()`)

**Interfaces:**
- Consumes: `canAccessPack` from Task 1; `account` from Task 3.
- Produces:
  - `class PackLockedError extends Error { packId: string }`
  - `assertPackAccess(account: { plan: string }, packId: string): void` — throws `PackLockedError`
  - `packLockedResponse(err: unknown): NextResponse | null` — `402 { error: 'locked', packId }` for a `PackLockedError`, else `null` (same shape as `authErrorResponse`)
  - `accessibleSentencePackIds(account, allPackIds: string[]): string[]`

- [x] **Step 1: Write the failing tests**

Create `lib/pack-gate.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { PackLockedError, accessibleSentencePackIds, assertPackAccess, packLockedResponse } from '@/lib/pack-gate'

afterEach(() => {
  delete process.env.PAYMENTS_ENABLED
})

describe('assertPackAccess', () => {
  it('does nothing while payments are off', () => {
    expect(() => assertPackAccess({ plan: 'free' }, 'food')).not.toThrow()
  })
  it('throws PackLockedError for a paid pack on a free account', () => {
    process.env.PAYMENTS_ENABLED = 'true'
    expect(() => assertPackAccess({ plan: 'free' }, 'food')).toThrow(PackLockedError)
    try {
      assertPackAccess({ plan: 'free' }, 'food')
    } catch (e) {
      expect((e as PackLockedError).packId).toBe('food')
    }
  })
  it('lets free packs and lifetime accounts through', () => {
    process.env.PAYMENTS_ENABLED = 'true'
    expect(() => assertPackAccess({ plan: 'free' }, 'animals')).not.toThrow()
    expect(() => assertPackAccess({ plan: 'lifetime' }, 'food')).not.toThrow()
  })
})

describe('packLockedResponse', () => {
  it('maps PackLockedError to 402 { error: "locked", packId }', async () => {
    const res = packLockedResponse(new PackLockedError('s1-this-is'))
    expect(res?.status).toBe(402)
    expect(await res?.json()).toEqual({ error: 'locked', packId: 's1-this-is' })
  })
  it('returns null for anything else', () => {
    expect(packLockedResponse(new Error('boom'))).toBeNull()
    expect(packLockedResponse(undefined)).toBeNull()
  })
})

describe('accessibleSentencePackIds', () => {
  const all = ['animals', 'food', 'family', 'feelings', 'home', 's1-this-is', 's2-colors-counts', 's3-where-have']
  it('returns everything while payments are off', () => {
    expect(accessibleSentencePackIds({ plan: 'free' }, all)).toEqual(all)
  })
  it('keeps only free source packs for a free account when payments are on', () => {
    process.env.PAYMENTS_ENABLED = 'true'
    expect(accessibleSentencePackIds({ plan: 'free' }, all)).toEqual(['animals'])
  })
  it('returns everything for lifetime', () => {
    process.env.PAYMENTS_ENABLED = 'true'
    expect(accessibleSentencePackIds({ plan: 'lifetime' }, all)).toEqual(all)
  })
})
```

- [x] **Step 2: Run to see them fail**

Run: `npm test`
Expected: FAIL — cannot resolve `@/lib/pack-gate`.

- [x] **Step 3: Create `lib/pack-gate.ts`**

```ts
import { NextResponse } from 'next/server'
import { canAccessPack } from '@/lib/plan'

/**
 * Server-side pack gate (spec 2026-10-13 §3). Routes call assertPackAccess()
 * right after auth and map the error with packLockedResponse() next to
 * authErrorResponse(). The rule itself lives in lib/plan.ts; this file only
 * turns it into an error + a 402.
 */
export class PackLockedError extends Error {
  constructor(public packId: string) {
    super('locked')
    this.name = 'PackLockedError'
  }
}

export function assertPackAccess(account: { plan: string }, packId: string): void {
  if (!canAccessPack(account, packId)) throw new PackLockedError(packId)
}

/** 402 Payment Required — the client shows the "Ask a grown-up" card. */
export function packLockedResponse(err: unknown): NextResponse | null {
  if (err instanceof PackLockedError) {
    return NextResponse.json({ error: 'locked', packId: err.packId }, { status: 402 })
  }
  return null
}

/** For /api/sentences/all: which source packs this account may draw sentences from. */
export function accessibleSentencePackIds(account: { plan: string }, allPackIds: string[]): string[] {
  return allPackIds.filter((id) => canAccessPack(account, id))
}
```

- [x] **Step 4: Run the unit tests**

Run: `npm test`
Expected: PASS (17 tests).

- [x] **Step 5: Apply the gate in `app/api/questions/[packId]/route.ts`**

Add the import after the auth import:
```ts
import { assertPackAccess, packLockedResponse } from '@/lib/pack-gate'
```
Change
```ts
    const { child } = await requireChild()
```
to
```ts
    const { account, child } = await requireChild()
    assertPackAccess(account, packId)
```
In the `catch`, before `const authErr = authErrorResponse(err)`, add:
```ts
    const locked = packLockedResponse(err)
    if (locked) return locked
```

- [x] **Step 6: Apply the gate in `app/api/math/questions/[topicId]/route.ts`**

Same three edits. The handler's parameter is `{ params }: { params: { topicId: string } }`; use `assertPackAccess(account, params.topicId)` (or the local `topicId` variable if the handler already destructures it — read the handler body first and match its name). Add the same `packLockedResponse` lines at the top of the `catch`.

- [x] **Step 7: Apply the gate in `app/api/sentences/[packId]/route.ts`**

This route uses `getAuthContext()` (no child). Find the `GET` handler's auth call; change it to
```ts
    const { account } = await getAuthContext()
    assertPackAccess(account, params.packId)
```
(match the existing param name — the handler signature is `GET(_req, { params }: { params: { packId: string } })`). Add the import and the `packLockedResponse` lines at the top of its `catch`. If the handler's try/catch only wraps the auth call (like `sentences/all`), widen the `try` so the assert is inside it.

- [x] **Step 8: Filter `app/api/sentences/all/route.ts`**

Replace the `ALL_SENTENCES` constant with a map keyed by source pack, and filter at request time:

```ts
import { accessibleSentencePackIds } from '@/lib/pack-gate'

const SENTENCES_BY_PACK: Record<string, Sentence[]> = {
  animals: animalsData.sentences as Sentence[],
  food: foodData.sentences as Sentence[],
  family: familyData.sentences as Sentence[],
  feelings: feelingsData.sentences as Sentence[],
  home: homeData.sentences as Sentence[],
  's1-this-is': s1Data.sentences as Sentence[],
  's2-colors-counts': s2Data.sentences as Sentence[],
  's3-where-have': s3Data.sentences as Sentence[],
}
```

In `GET`, capture the account and build the pool:
```ts
  let account: { plan: string }
  try {
    ;({ account } = await getAuthContext())
  } catch (err) {
    const authErr = authErrorResponse(err)
    if (authErr) return authErr
    throw err
  }

  const allowed = accessibleSentencePackIds(account, Object.keys(SENTENCES_BY_PACK))
  const pool = allowed.flatMap((id) => SENTENCES_BY_PACK[id])
  const shuffled = shuffle(pool)
```
Keep the rest of the handler as is (it slices 8 and maps to questions). Delete the old `ALL_SENTENCES` array.

- [x] **Step 9: Gate the two writes**

`app/api/progress/route.ts`, in `POST` only (the `GET` stays open — reading progress of a locked pack is harmless and the parent report needs it):
```ts
    const { account, child } = await requireChild()
    const body = await req.json() as { … }   // unchanged
    const { packId, … } = body               // unchanged
    assertPackAccess(account, packId)
```
Place the assert right after the destructure of `packId`, before any `upsert`. Add the import and the `packLockedResponse` lines at the top of the POST `catch`.

`app/api/answers/route.ts`, in `POST` only:
```ts
    const { account, child } = await requireChild()
    const body = await req.json() as { packId: string; wordId: string; correct: boolean }
    assertPackAccess(account, body.packId)
```
Add the import and the `packLockedResponse` lines at the top of the POST `catch`.

- [x] **Step 10: Type check, lint, tests**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: clean, 17 tests pass.

- [x] **Step 11: Smoke the open state against the dev server**

Run: `npm run dev` in one terminal. In another:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/questions/food
```
Expected: `401` (no auth; proves the route still loads — the full locked/open behaviour is Task 9).

- [x] **Step 12: Commit**

```bash
git add lib/pack-gate.ts lib/pack-gate.test.ts "app/api/questions/[packId]/route.ts" "app/api/math/questions/[topicId]/route.ts" "app/api/sentences/[packId]/route.ts" app/api/sentences/all/route.ts app/api/progress/route.ts app/api/answers/route.ts
git commit -m "feat(gate): 402 locked on question, sentence, progress and answer routes; sentences/all filtered per source pack"
```

---

### Task 6: `locked` on the pack list + `GET /api/account`

**Files:**
- Modify: `app/api/packs/route.ts` (the `result` map, lines 66–78)
- Create: `app/api/account/route.ts`

**Interfaces:**
- Consumes: `canAccessPack`, `paymentsEnabled`, `hasLifetime`, `isPackFree` (Task 1); `account` from `requireChild()` / `getAuthContext()` (Task 3).
- Produces:
  - `GET /api/packs` element gains `locked: boolean`.
  - `GET /api/account` → `{ plan: string; isFounder: boolean; isGuest: boolean; email: string | null; paymentsEnabled: boolean; lifetime: boolean; freePackCount: number; totalPackCount: number }`. `totalPackCount` counts packs with content (same filter as `/api/packs`), excluding the `sentences` pseudo-pack; `freePackCount` counts those that are free.

- [x] **Step 1: Add `locked` to the pack list**

In `app/api/packs/route.ts`:

Add the import:
```ts
import { canAccessPack } from '@/lib/plan'
```
Change `const { child } = await requireChild()` to `const { account, child } = await requireChild()`.

In the `.map((pack) => ({ … }))`, add after `masteryPct`:
```ts
        locked: !canAccessPack(account, pack.id),
```

- [x] **Step 2: Create `app/api/account/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext, authErrorResponse } from '@/lib/auth'
import { hasLifetime, isPackFree, paymentsEnabled } from '@/lib/plan'

export const runtime = 'nodejs'

/**
 * GET /api/account — what the Parent Zone needs to render the unlock card.
 * Plan state comes from the validated session only. No childId involved.
 */
export async function GET() {
  try {
    const { account } = await getAuthContext()

    const packs = await prisma.pack.findMany({
      select: {
        id: true,
        _count: { select: { words: true, problems: true, sentences: true } },
      },
    })
    const withContent = packs.filter(
      (p) => p.id !== 'sentences' && p._count.words + p._count.problems + p._count.sentences > 0
    )
    const freePackCount = withContent.filter((p) => isPackFree(p.id)).length

    return NextResponse.json({
      plan: account.plan,
      lifetime: hasLifetime(account),
      isFounder: account.isFounder,
      isGuest: account.isGuest,
      email: account.email,
      paymentsEnabled: paymentsEnabled(),
      freePackCount,
      totalPackCount: withContent.length,
    })
  } catch (err) {
    const authErr = authErrorResponse(err)
    if (authErr) return authErr
    console.error('[account GET]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
```

- [x] **Step 3: Type check, lint, tests**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: clean.

- [x] **Step 4: Check the shapes on the dev server**

With `npm run dev` running and a browser session signed in (open http://localhost:3000 once in Chrome so a guest exists), there is no cookie in curl, so check the 401 path only here:
```bash
curl -s http://localhost:3000/api/account; echo
```
Expected: `{"error":"unauthenticated"}`. Full shape is verified in Task 9.

- [x] **Step 5: Commit**

```bash
git add app/api/packs/route.ts app/api/account/route.ts
git commit -m "feat(api): locked flag on pack list; GET /api/account for the Parent Zone unlock card"
```

---

### Task 7: Kid lock UI — badge, "Ask a grown-up" card, 402 handling

**Files:**
- Create: `components/kid/AskGrownUp.tsx`
- Modify: `app/packs/page.tsx` (`PackMeta` interface; the pack button at lines 170–197), `app/math/topics/page.tsx` (`TopicMeta`; the topic button at lines 116–135), `app/practice/session/page.tsx` (`loadSession` lines 62–82 and the empty-questions block at lines 185–199), `app/math/practice/session/page.tsx` (`loadSession` lines 59–79 and the "taking a nap" block near line 173)

**Interfaces:**
- Consumes: `locked` from `/api/packs` (Task 6); 402 from the session routes (Task 5).
- Produces: `AskGrownUp({ onClose?: () => void })` — a full-screen kid card: panda, "Ask a grown-up to unlock 🔒", one "Grown-ups" button → `/parent`, optional "Back" when `onClose` is given.

- [x] **Step 1: Create the card**

`components/kid/AskGrownUp.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

/**
 * Shown when a child taps a locked pack or a session route answers 402.
 * No price, no buy button, no external link — the only way forward is the
 * Parent Zone, which sits behind the grown-ups gate (spec 2026-10-13 §4).
 */
export default function AskGrownUp({ onClose }: { onClose?: () => void }) {
  const router = useRouter()
  return (
    <motion.div
      role="dialog"
      aria-label="Ask a grown-up to unlock"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative z-20 w-full max-w-sm bg-white rounded-[26px] p-6 shadow-press-card flex flex-col items-center text-center gap-3"
    >
      <span className="font-emoji text-6xl" aria-hidden>🐼</span>
      <p className="text-2xl font-extrabold text-ink leading-tight">
        Ask a grown-up to unlock <span className="font-emoji">🔒</span>
      </p>
      <p className="text-[15px] font-bold text-ink-soft">This pack is waiting for you!</p>
      <button
        onClick={() => router.push('/parent')}
        className="pressable w-full min-h-[56px] bg-success text-white rounded-2xl px-6 text-lg font-extrabold shadow-press-success mt-2"
      >
        Grown-ups
      </button>
      {onClose && (
        <button
          onClick={onClose}
          className="pressable w-full min-h-[48px] bg-canvas-top text-ink-soft rounded-2xl px-6 text-[15px] font-extrabold shadow-press-chip"
        >
          Back
        </button>
      )}
    </motion.div>
  )
}
```

- [x] **Step 2: Packs page — badge + card on tap**

In `app/packs/page.tsx`:

Add to `PackMeta`: `locked?: boolean` (optional, so a cached pre-Phase-A response still parses).

Add the import: `import AskGrownUp from '@/components/kid/AskGrownUp'`.

Add state after `tab`: `const [asking, setAsking] = useState(false)`.

Replace the pack `<button … onClick=…>` with:

```tsx
                  <button
                    onClick={() => {
                      if (pack.locked) {
                        setAsking(true)
                        return
                      }
                      router.push(pack.id === 'sentences' ? '/practice/sentences' : `/practice/session?pack=${pack.id}`)
                    }}
                    aria-label={pack.locked ? `${pack.name}, locked` : pack.name}
                    className={`pressable w-full min-h-[72px] bg-white rounded-[22px] px-4 py-3 flex items-center gap-4 text-left shadow-press-card ${
                      pack.locked ? 'opacity-70' : ''
                    }`}
                  >
```
Inside the button, directly before `<MasteryRing percent={pack.masteryPct} />`, add:
```tsx
                    {pack.locked && (
                      <span className="font-emoji text-lg leading-none" aria-hidden>🔒</span>
                    )}
```

Render the card when `asking` is true. Change the `return (` of the ready state so the card overlays the grid: right after `<Hills />` inside `<KidLayout …>`, add:
```tsx
      {asking && (
        <div className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-black/20">
          <AskGrownUp onClose={() => setAsking(false)} />
        </div>
      )}
```

- [x] **Step 3: Math topics page — same treatment**

In `app/math/topics/page.tsx`: add `locked?: boolean` to `TopicMeta`; import `AskGrownUp`; add `const [asking, setAsking] = useState(false)` after `status`; wrap the topic button's `onClick` with the same `if (topic.locked) { setAsking(true); return }`; add `aria-label` and the `opacity-70` class the same way; add the 🔒 span before `<MasteryRing …/>`; add the same overlay block after `<Hills />` in the ready-state return.

- [x] **Step 4: Chinese session — 402 shows the card**

In `app/practice/session/page.tsx`:

Import `AskGrownUp`. Add state near `loading`: `const [locked, setLocked] = useState(false)`.

In `loadSession`, change
```ts
      if (!sessionRes.ok || !sessionRes.data) throw new Error('Could not load session')
```
to
```ts
      if (sessionRes.status === 402) {
        setLocked(true)
        setLoading(false)
        return
      }
      if (!sessionRes.ok || !sessionRes.data) throw new Error('Could not load session')
```

Directly before the `if (questions.length === 0) {` block, add:
```tsx
  if (locked) {
    return (
      <PracticeCanvas>
        <AskGrownUp onClose={() => router.push('/packs')} />
      </PracticeCanvas>
    )
  }
```
(`PracticeCanvas` and `router` already exist in this file; keep their current definitions.)

- [x] **Step 5: Math session — same**

In `app/math/practice/session/page.tsx`: import `AskGrownUp`; add `const [locked, setLocked] = useState(false)`; add the same `status === 402` branch in `loadSession`; add the same `if (locked)` return before the "taking a nap" block, with `onClose={() => router.push('/math/topics')}`.

- [x] **Step 6: Type check, lint, tests**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: clean.

- [x] **Step 7: Look at it**

With `npm run dev` running and `PAYMENTS_ENABLED=true npm run dev` **not** yet used (payments off), open http://localhost:3000/packs in the browser: no badges, no change. Then stop the server and start it with `PAYMENTS_ENABLED=true npm run dev`; reload `/packs` as a guest: Animals, Colors, Numbers, and Sentences have no badge; every other pack shows 🔒 at 70% opacity; tapping Food shows the panda card; "Grown-ups" goes to `/parent`; "Back" closes it. Open `/practice/session?pack=food` directly: the card shows instead of "taking a nap". Repeat for `/math/topics` (Single Digits open, the other three locked). Stop the server and restart it without the variable before continuing.

If the Chrome extension or playwright is not available, use the headless capture from the iPad audit (`scratchpad/pw/shots.mjs` pattern) at 430×900 to screenshot `/packs`, `/math/topics`, and `/practice/session?pack=food` with `PAYMENTS_ENABLED=true`.

- [x] **Step 8: Commit**

```bash
git add components/kid/AskGrownUp.tsx app/packs/page.tsx app/math/topics/page.tsx app/practice/session/page.tsx app/math/practice/session/page.tsx
git commit -m "feat(kid): lock badge on paid packs, Ask-a-grown-up card, 402 handling in sessions"
```

---

### Task 8: Parent Zone unlock card (web path), `/unlock` redirect, checkout guards

**Files:**
- Modify: `app/parent/page.tsx` (add `UnlockSection`, render it between `<ChildrenSection />` and `<AccountSection />` at lines 790–791)
- Modify: `app/unlock/page.tsx` (replace the page body with a redirect)
- Modify: `app/api/stripe/checkout/route.ts` (guest refusal)

**Interfaces:**
- Consumes: `GET /api/account` (Task 6); `POST /api/stripe/checkout` (existing; returns `{ url }`, `404` while dormant, `409 already unlocked`, new `403 claim-first`).
- Produces: `UnlockSection()` component inside `app/parent/page.tsx`; `/unlock` → `router.replace('/parent')`.

- [x] **Step 1: Guest refusal in the checkout route**

In `app/api/stripe/checkout/route.ts`, after the `hasLifetime` 409 check, add:
```ts
    if (account.isGuest) {
      // Email is the only way to restore a web purchase on a new device
      // (spec 2026-10-13 §7 rule 6). The Parent Zone card asks for it first.
      return NextResponse.json({ error: 'claim-first' }, { status: 403 })
    }
```
Update the file's doc comment: replace the sentence starting `Guests CAN buy` with `Guests must claim the account (add an email) before buying — see the 403 below.` Remove the `wasGuestAtPurchase` metadata key (it can no longer be true): delete the line `wasGuestAtPurchase: account.isGuest ? 'true' : 'false',`.

- [x] **Step 2: Add `UnlockSection` to the Parent Zone**

In `app/parent/page.tsx`, add the import near the top: `import { LIFETIME_PRICE_DISPLAY } from '@/lib/plan'`.

Add this component above `function AccountSection()`:

```tsx
interface AccountStatus {
  plan: string
  lifetime: boolean
  isFounder: boolean
  isGuest: boolean
  email: string | null
  paymentsEnabled: boolean
  freePackCount: number
  totalPackCount: number
}

/**
 * The one buy surface (spec 2026-10-13 §4). Web path only in Phase A; the
 * native StoreKit path lands in Phase C. Renders nothing while payments are
 * off, so the Parent Zone is unchanged for everyone until go-live.
 */
function UnlockSection() {
  const [status, setStatus] = useState<AccountStatus | null>(null)
  const [buying, setBuying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchJsonWithAuthRetry<AccountStatus>('/api/account').then(({ ok, data }) => {
      if (!cancelled && ok && data) setStatus(data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!status || !status.paymentsEnabled) return null

  async function handleBuy() {
    if (buying) return
    setBuying(true)
    setError(null)
    const { ok, status: code, data } = await fetchJsonWithAuthRetry<{ url?: string; error?: string }>(
      '/api/stripe/checkout',
      { method: 'POST' }
    )
    if (ok && data?.url) {
      window.location.assign(data.url)
      return
    }
    setError(
      code === 409
        ? 'Good news — this family already has everything unlocked!'
        : code === 403
          ? 'Add your email below first, so the purchase is saved to your account.'
          : "We couldn't start the checkout. Please try again in a moment."
    )
    setBuying(false)
  }

  if (status.lifetime) {
    return (
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-extrabold text-ink">Unlock</h2>
        <div className="bg-white rounded-[22px] p-5 shadow-press-card">
          <p className="font-extrabold text-ink">Everything is unlocked ✓</p>
          <p className="text-ink-soft text-sm font-bold mt-1">
            {status.isFounder
              ? 'Founder — thank you! Every future pack and upgrade is yours, forever.'
              : 'Every pack, every child in your family, forever.'}
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-extrabold text-ink">Unlock everything</h2>
      <div className="bg-white rounded-[22px] p-5 shadow-press-card flex flex-col gap-3">
        <p className="text-ink-soft text-sm font-bold">
          {status.freePackCount} of {status.totalPackCount} packs are free forever. One purchase opens the rest for every
          child in your family — pay once, keep it always. No subscription.
        </p>
        {status.isGuest && (
          <p className="text-ink text-sm font-bold bg-chip-track rounded-2xl px-4 py-3">
            Add your email first (below, under Account) so your purchase is safe on every device.
          </p>
        )}
        {error && <p className="text-ink text-sm font-bold">{error}</p>}
        <button
          onClick={handleBuy}
          disabled={buying || status.isGuest}
          className="pressable min-h-[56px] bg-success text-white rounded-2xl px-5 text-sm font-extrabold shadow-press-success disabled:opacity-50 self-start"
        >
          {buying ? 'Opening checkout…' : `Unlock everything — ${LIFETIME_PRICE_DISPLAY}`}
        </button>
        <p className="text-ink-soft text-xs font-bold">Have a founder code? Enter it at checkout.</p>
      </div>
    </section>
  )
}
```

Render it: change
```tsx
        <ChildrenSection />
        <AccountSection />
```
to
```tsx
        <ChildrenSection />
        <UnlockSection />
        <AccountSection />
```

- [x] **Step 3: `/unlock` becomes a redirect**

Replace the whole of `app/unlock/page.tsx` with:

```tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * The Parent Zone is the single buy surface (spec 2026-10-13 §4). This route
 * stays only because it is Stripe's cancel_url and an old deep link.
 */
export default function UnlockPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/parent')
  }, [router])
  return null
}
```
Leave `app/unlock/thanks/page.tsx` untouched (it is Stripe's success URL).

- [x] **Step 4: Type check, lint, tests**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: clean. (The `EARLY_ACCESS` shim from Task 1 is gone with the page body.)

- [x] **Step 5: Look at it**

`PAYMENTS_ENABLED=true npm run dev`; open `/parent`, pass the gate. As a guest: the "Unlock everything" section shows the pack counts, the email hint, and a disabled button. Restart without the variable: the section is absent. Open `/unlock`: it lands on `/parent`.

- [x] **Step 6: Commit**

```bash
git add app/parent/page.tsx app/unlock/page.tsx app/api/stripe/checkout/route.ts
git commit -m "feat(parent): Unlock everything card (web path), /unlock redirects to the Parent Zone, checkout refuses guests"
```

---

### Task 9: End-to-end check of the gate against the dev server

**Files:**
- Create: `scripts/e2e-gate.mjs`

**Interfaces:**
- Consumes: the running dev server at `http://localhost:3000` started with `PAYMENTS_ENABLED=true`; `.env` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DIRECT_URL`/`DATABASE_URL`).
- Produces: a script that creates a throwaway guest (same anonymous sign-in the app uses), exercises every gated path for free and lifetime plans, and deletes the guest at the end. It prints one line per check and exits non-zero on the first failure.

- [x] **Step 1: Write the script**

`scripts/e2e-gate.mjs`:

```js
// End-to-end check of the pack gate (spec 2026-10-13 §3, §7).
// Run:  PAYMENTS_ENABLED=true npm run dev   (in another terminal)
//       node scripts/e2e-gate.mjs
// Creates a throwaway guest via the same anonymous sign-in the app uses,
// drives the API with the native Bearer transport, flips the plan in the DB,
// and deletes the guest (Account + auth.users) at the end — even on failure.
import pg from 'pg'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8') + '\n' + (fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '')
const get = (k) => (env.match(new RegExp('^' + k + '="?([^"\\n]+)"?', 'm')) || [])[1]
const SB = get('NEXT_PUBLIC_SUPABASE_URL'), KEY = get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const DB = get('DIRECT_URL') || get('DATABASE_URL')
const API = process.env.API_BASE || 'http://localhost:3000'

let failures = 0
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)
  if (!ok) failures++
}

const signup = await fetch(`${SB}/auth/v1/signup`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: '{}' })
const session = await signup.json()
if (!session.access_token) throw new Error('anonymous sign-in failed: ' + JSON.stringify(session))
const uid = session.user.id
const H = { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
const db = new pg.Client({ connectionString: DB })
await db.connect()

try {
  const child = await (await fetch(`${API}/api/children`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'GateTest', avatar: '🐼' }) })).json()
  const HC = { ...H, 'x-child-id': child.id }
  const j = async (path, init = {}) => { const r = await fetch(API + path, { headers: HC, ...init }); return { status: r.status, body: await r.json().catch(() => null) } }

  // --- free account, payments on ---
  let acct = await j('/api/account')
  check('account: paymentsEnabled true, plan free, guest', acct.body?.paymentsEnabled === true && acct.body?.plan === 'free' && acct.body?.isGuest === true, JSON.stringify(acct.body))
  check('account: 4 free packs counted', acct.body?.freePackCount === 4, `got ${acct.body?.freePackCount}/${acct.body?.totalPackCount}`)

  let packs = await j('/api/packs')
  check('packs: array shape kept', Array.isArray(packs.body))
  const byId = Object.fromEntries((packs.body || []).map((p) => [p.id, p]))
  check('packs: animals unlocked', byId.animals?.locked === false)
  check('packs: food locked', byId.food?.locked === true)
  check('packs: sentences mode unlocked', byId.sentences?.locked === false)
  const math = await j('/api/packs?subject=math')
  const m = Object.fromEntries((math.body || []).map((p) => [p.id, p]))
  check('math: math_add_singles unlocked', m.math_add_singles?.locked === false)
  check('math: math_add_tens locked', m.math_add_tens?.locked === true)

  check('questions/animals → 200', (await j('/api/questions/animals')).status === 200)
  const lockedQ = await j('/api/questions/food')
  check('questions/food → 402 locked', lockedQ.status === 402 && lockedQ.body?.error === 'locked' && lockedQ.body?.packId === 'food', JSON.stringify(lockedQ.body))
  check('math/questions/math_add_singles → 200', (await j('/api/math/questions/math_add_singles')).status === 200)
  check('math/questions/math_add_tens → 402', (await j('/api/math/questions/math_add_tens')).status === 402)
  check('sentences/animals → 200', (await j('/api/sentences/animals')).status === 200)
  check('sentences/s1-this-is → 402', (await j('/api/sentences/s1-this-is')).status === 402)
  const all = await j('/api/sentences/all')
  const ids = (all.body?.questions || []).map((q) => q.sentence?.id || '')
  check('sentences/all: only animals sentences for a free account', all.status === 200 && ids.length > 0 && ids.every((id) => id.startsWith('animals_')), ids.slice(0, 3).join(','))

  const prog = { wordId: 'x', easiness: 2.5, interval: 1, repetitions: 1, nextReview: new Date().toISOString() }
  check('progress POST food → 402', (await j('/api/progress', { method: 'POST', body: JSON.stringify({ packId: 'food', ...prog }) })).status === 402)
  check('answers POST food → 402', (await j('/api/answers', { method: 'POST', body: JSON.stringify({ packId: 'food', wordId: 'x', correct: true }) })).status === 402)
  check('answers POST animals → 200', (await j('/api/answers', { method: 'POST', body: JSON.stringify({ packId: 'animals', wordId: 'x', correct: true }) })).status === 200)

  check('stripe checkout as guest → 403 claim-first or 404 dormant', [403, 404].includes((await j('/api/stripe/checkout', { method: 'POST' })).status))

  // --- flip to lifetime in the DB (what the Stripe/Apple handlers will do in Phases B/C) ---
  await db.query(`update "Account" set plan='lifetime', "planSource"='manual', "planGrantedAt"=now() where id=$1`, [uid])
  acct = await j('/api/account')
  check('account: lifetime true after flip', acct.body?.lifetime === true)
  packs = await j('/api/packs')
  check('packs: nothing locked for lifetime', Array.isArray(packs.body) && packs.body.every((p) => p.locked === false))
  check('questions/food → 200 for lifetime', (await j('/api/questions/food')).status === 200)
  check('sentences/s1-this-is → 200 for lifetime', (await j('/api/sentences/s1-this-is')).status === 200)

  // --- the cleanup guard: a paid guest must not be selected ---
  await db.query(`update "Account" set "createdAt" = now() - interval '400 days' where id=$1`, [uid])
  const stale = await db.query(`select count(*)::int as n from "Account" where id=$1 and "isGuest"=true and plan='free' and "createdAt" < now() - interval '90 days'`, [uid])
  check('cleanup filter would skip the paid guest', stale.rows[0].n === 0)
} finally {
  await db.query('delete from "Account" where id=$1', [uid])
  await db.query('delete from auth.users where id=$1::uuid and is_anonymous = true', [uid])
  await db.end()
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
```

- [x] **Step 2: Run it with payments on**

Terminal 1: `PAYMENTS_ENABLED=true npm run dev`
Terminal 2: `node scripts/e2e-gate.mjs`
Expected: every line `PASS`, then `ALL CHECKS PASSED`, exit 0.

- [x] **Step 3: Run it with payments off (the dormant state that ships)**

Terminal 1: restart `npm run dev` without the variable.
Terminal 2: `node scripts/e2e-gate.mjs`
Expected: the first `account: paymentsEnabled true` line FAILs and the locked-expecting lines FAIL; the `→ 200` lines PASS. This is the correct dormant behaviour. (The script is written for the on-state; do not "fix" it to pass here.)

- [x] **Step 4: Commit**

```bash
git add scripts/e2e-gate.mjs
git commit -m "test(e2e): scripted gate check against the dev server — free vs lifetime, all five routes, cleanup guard"
```

---

### Task 10: Docs, spec amendments, pull request

**Files:**
- Modify: `CLAUDE.md` and `AGENTS.md` (section "Payments (dormant)")
- Modify: `docs/superpowers/specs/2026-10-13-payments-design.md` (two amendments)
- Modify: `lib/plan.ts` doc comment is already accurate (Task 1)

- [x] **Step 1: Amend the spec to match what was built**

In `docs/superpowers/specs/2026-10-13-payments-design.md`:

Section 3, replace the bullet beginning `**The pack list keeps every pack.**` with:
```
- **The pack list keeps every pack and its array shape.** `GET /api/packs` stays an array (build 6 in the field parses it as one) and each element gains `locked: boolean`. The payments-on state and plan details for the Parent Zone come from a new `GET /api/account` (`plan`, `lifetime`, `isFounder`, `isGuest`, `email`, `paymentsEnabled`, `freePackCount`, `totalPackCount`). Mastery math is unchanged.
```
Section 1, after the sentence `Pack-attached sentences … follow their pack's state.` add:
```
The `sentences` practice mode (DB pack id `sentences`, served by `/api/sentences/all`) is always reachable; its pool is filtered to sentences whose source pack the account can access, so a free account practices Animals sentences only.
```

- [x] **Step 2: Update the project instructions**

In both `CLAUDE.md` and `AGENTS.md`, replace the "Payments (dormant)" section with:

```
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
```

- [x] **Step 3: Final gates and the pull request**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: clean.

```bash
git add CLAUDE.md AGENTS.md docs/superpowers/specs/2026-10-13-payments-design.md
git commit -m "docs: payments Phase A — server-side switch, gate, free list; spec amendments"
git push -u origin payments-phase-a
gh pr create --base main --head payments-phase-a --title "Payments Phase A: server-side pack gate, kid lock UI, Parent Zone unlock card (dormant)" --body "$(cat <<'EOF'
Implements Phase A of docs/superpowers/specs/2026-10-13-payments-design.md.

- Server-side switch `PAYMENTS_ENABLED` (the `NEXT_PUBLIC_` constant is gone); everything stays open until it is set
- `lib/plan.ts` free list (+ `math_add_singles`, `sentences` mode) and `canAccessPack`; `lib/pack-gate.ts` → 402 on questions, math questions, sentences, progress and answer writes; `sentences/all` filtered per source pack
- `Account` gains planSource / planGrantedAt / isFounder / Stripe + Apple ids (migration applied)
- Cleanup cron never deletes a paid account
- `/api/packs` keeps its array shape, adds `locked`; new `GET /api/account`
- Kid UI: lock badge, "Ask a grown-up" card, 402 handling in both session pages
- Parent Zone "Unlock everything" card (web path); `/unlock` redirects there; checkout refuses guests (403 claim-first)
- vitest: plan rule, pack gate, cleanup filter; `scripts/e2e-gate.mjs` passes against a dev server with `PAYMENTS_ENABLED=true`

Dormant in production after merge: no visible change until `PAYMENTS_ENABLED=true` is set in Vercel (go-live is after 1.0.1 ships with Phase C).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: a PR URL. Record it on GitHub issue #10's sibling tracking issue (open one titled "Payments: Phase A gate + UI" if none exists) and in `ios-rollout-status` memory.

---

## Self-review

**Spec coverage (Phase A items from §10):** migration (Task 2) ✔; `lib/plan.ts` helpers + server switch (Task 1) ✔; 402 on the three reads and two writes (Task 5) ✔; `locked` in `/api/packs` (Task 6) ✔ — amended from a top-level `paymentsEnabled` to the array-safe `GET /api/account` (Task 10 records the amendment); cleanup fix (Task 4) ✔; kid badge + card (Task 7) ✔; Parent Zone card, web path (Task 8) ✔; `/unlock` redirect (Task 8) ✔; vitest with plan and cleanup tests (Tasks 1, 4, 5) ✔ — the Stripe webhook tests belong to Phase B where the webhook changes; §7 rule 6 guest refusal (Task 8) ✔; §7 rule 1 (409) already exists ✔.

**Placeholder scan:** none. Every code step shows the code; the only "match the existing name" instructions (Task 5 Steps 6–7) tell the implementer exactly which identifier to look for.

**Type consistency:** `canAccessPack(account: { plan: string }, packId: string)` is used identically in Tasks 1, 5, 6; `assertPackAccess`/`packLockedResponse`/`accessibleSentencePackIds` names match between Task 5 tests and code and Task 5 route edits; `AccountStatus` in Task 8 matches the JSON produced in Task 6 field for field; `locked?: boolean` on `PackMeta`/`TopicMeta` matches the `locked` key added in Task 6.

**Not in this plan (by design):** Stripe promo codes, founder detection, refund webhook (Phase B); StoreKit plugin, verify and notification routes, privacy manifest/listing updates (Phase C); Jenny's App Store Connect and Stripe dashboard steps.
