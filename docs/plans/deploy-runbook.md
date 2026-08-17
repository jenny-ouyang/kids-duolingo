# Multi-Tenancy Deploy Runbook

Ordered steps to take `launch/multi-tenancy` live. Steps marked **[JENNY]** need dashboard
access; everything else is scripted.

## A. Supabase dashboard (one-time) **[JENNY]**
Project: `odwoxbxkvmjjqvjyynko` (kids-duolingo — NOT the ai-memory one).

1. **Authentication → Sign In / Up**: enable **Anonymous sign-ins**. Recommended: also enable
   the built-in CAPTCHA (Cloudflare Turnstile) for anonymous sign-in to stop bot row-spam.
2. **Authentication → Sign In / Up → Email**: ensure Email (magic link / OTP) is enabled.
   Set "Confirm email" ON (used by the guest→permanent claim flow).
3. **Authentication → URL Configuration**: Site URL `https://kids-duolingo.vercel.app`
   (update when a custom domain lands); add `http://localhost:3000` to redirect allow-list.
4. **Settings → API**: copy the **anon (publishable) key** →
   - local `.env`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`)
   - Vercel env vars: same two, all environments.
5. **Settings → API → Data API**: consider disabling the Data API entirely (nothing uses
   PostgREST). Either way, run the RLS lockdown (step D).

## B. Create the owner account **[JENNY]**
1. Authentication → Users → Add user (or sign up once through the deployed app) with
   `bingjie.j.ouyang@gmail.com`.
2. Copy its UUID into local `.env` as `JENNY_USER_ID`, plus `JENNY_EMAIL`.

## C. Run the data migration (scripted, idempotent)
```bash
npm run db:migrate-multitenancy
```
Does: expand migration → creates Jenny's Account + Child "Julian" (501 hearts, streak 1)
→ maps all 143 WordProgress / 44 MathProgress / 872 AnswerEvent rows → guarded contract
migration (drops childName, ChildProfile) → marks both migrations applied in
`_prisma_migrations`.

Contract SQL aborts safely if any row is unmapped. Re-runnable.

**Timing:** run C together with the code deploy (E). Old code breaks after the contract
step (childName is gone); new code breaks before it (childId not NOT NULL is fine, but
Prisma client expects new shape). The app has ~0 concurrent users, so the window is a
non-issue — run C, then deploy immediately.

## D. Security lockdown
Run `scripts/enable-rls.sql` in the Supabase SQL editor (deny-all RLS on all public
tables; Prisma unaffected). Verify with the query at the bottom of the file.

## E. Deploy
Merge `launch/multi-tenancy` → main → Vercel deploy (env vars from A.4 must exist first).

## F. Post-deploy verification
1. Fresh incognito visit → plays within seconds (anonymous session + Who's-learning screen).
2. Julian's data: sign in as Jenny → child Julian shows 501 hearts.
3. `/api/packs` unauthenticated → 401 (expected; the n8n keepalive's HTTP ping now gets
   401 — fine, it's the can't-fail secondary; the primary is direct Postgres `SELECT 1`).
4. PostgREST closed: `curl -H "apikey: <anon>" https://odwoxbxkvmjjqvjyynko.supabase.co/rest/v1/Account?select=*`
   → empty/denied.
5. iOS Safari device test: audio still primes after the new auth bootstrap (June fix intact).

## G. Deferred (pre-iOS)
- Apple OAuth (required once Google OAuth ships in the iOS app).
- Guest-cleanup job: delete guest accounts with no practice in 90 days (n8n cron is a good home).
- `Account.plan` gating for the $9.99 unlock.
