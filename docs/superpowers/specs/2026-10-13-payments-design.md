# Payments design — one lifetime unlock, web + iPhone

**Status:** approved by Jenny 2026-10-13 (design conversation), spec written 2026-10-13.
**Ships in:** 1.0.1. Phase A can merge before the 1.0 App Store approval because everything stays behind the server switch.
**Supersedes:** the "dormant payments" notes in `lib/plan.ts` and the IAP section of `docs/plans/app-store-path.md`. Decision D3 (price + free boundary) in `docs/plans/launch-plan.md` stays as decided and is made concrete here.
**Owner rule, stated verbatim from Jenny:** "make sure to never ever never ever overcharge". Section 7 turns that rule into code.

## 1. Product

- **One purchase.** $9.99, one time, lifetime. No subscription, no consumable, no second tier. It unlocks every pack that exists now and every pack added later, on the web and in the iPhone app, under one account.
- **Free forever (4 packs):** Chinese `animals`, `colors`, `numbers`; math `math_add_singles` (Single Digits). Everything else is paid, including the three sentence tracks `s1-this-is`, `s2-colors-counts`, `s3-where-have`. Pack-attached sentences (the `sentences` array inside a pack file such as `animals.json`) follow their pack's state. The `sentences` practice mode (DB pack id `sentences`, served by `/api/sentences/all`) is always reachable; its pool is filtered to sentences whose source pack the account can access, so a free account practices Animals sentences only.
- **Founder deal (web only):** promo code `FOUNDER` at Stripe Checkout gives a fixed price of $1.00. Cap: 100 redemptions. End date: set by Jenny when she creates it; default 60 days after go-live. Founders receive the same lifetime plan plus `isFounder = true`.
- **Founder promise, recorded here:** founders get every future pack and every upgrade for free, forever. If a paid add-on ever ships (for example Custom Family Packs as a subscription), accounts with `isFounder = true` are grandfathered in at no charge. Code that introduces any future paid feature must check `isFounder` and skip the charge.
- **No coupon on the iPhone in 1.0.1.** The iPhone product is $9.99 with no code. Apple offer codes for one-time purchases are not verified for this product type; a founder buys on the web and the unlock appears on the phone through the account.

## 2. Entitlement model

`Account` already has `plan: 'free' | 'lifetime'`. Add:

| Field | Type | Purpose |
|---|---|---|
| `planSource` | `'stripe' \| 'apple' \| 'manual' \| null` | Which system granted the plan. Refunds only downgrade when the refund source matches. `manual` is for Jenny granting a free unlock by hand. |
| `planGrantedAt` | `DateTime?` | Audit. |
| `isFounder` | `Boolean @default(false)` | The founder promise. Never cleared by a refund of a different source. |
| `stripeCheckoutSessionId` | `String? @unique` | Idempotency and refund matching for Stripe. |
| `stripePaymentIntentId` | `String?` | Refund matching (`charge.refunded` carries the payment intent). |
| `appleOriginalTransactionId` | `String? @unique` | One Apple purchase binds to at most one account at a time. |

`hasLifetime(account)` stays the only read API. Nothing outside `lib/plan.ts` compares `plan` strings.

**Restore policy for Apple (the one place "never overcharge" and "never share" pull against each other):** an Apple purchase belongs to the parent's Apple ID. When a verified transaction arrives whose `originalTransactionId` is already bound to a different account, the entitlement **moves** to the current account: the old account is set to `plan = 'free'` (unless its `planSource` is not `apple`, in which case it keeps its own plan) and the new account becomes lifetime with `planSource = 'apple'`. The parent who paid is never locked out; the cost is that one Apple purchase cannot unlock two accounts at once.

## 3. The gate: server only, one helper

`lib/plan.ts` becomes the single place that knows the rule:

```ts
export const FREE_PACK_IDS = ['animals', 'colors', 'numbers', 'math_add_singles'] as const
export function isPackFree(packId: string): boolean
export function canAccessPack(account: { plan: string }, packId: string): boolean   // free pack OR hasLifetime
export function paymentsEnabled(): boolean   // server-side: process.env.PAYMENTS_ENABLED === 'true'
```

- **The switch is server-side.** `PAYMENTS_ENABLED` (not `NEXT_PUBLIC_`) is read on the server only. The existing `NEXT_PUBLIC_PAYMENTS_ENABLED` constant is removed from client code; the iPhone bundle must never freeze the switch at build time. Go-live is one Vercel env change after Apple approves 1.0.1. The web and the phone switch on at the same moment.
- When `paymentsEnabled()` is false, `canAccessPack` returns true for everything (today's behaviour).
- **Gated routes** (all return `402 { error: 'locked', packId }` when `!canAccessPack`): `GET /api/questions/[packId]`, `GET /api/math/questions/[topicId]`, `GET /api/sentences/[packId]`. `GET /api/sentences/all` filters locked tracks out of its result. Progress and answer writes (`POST /api/progress`, `POST /api/answers`) refuse writes for a locked pack with the same 402.
- **The pack list keeps every pack and its array shape.** `GET /api/packs` stays an array (build 6 in the field parses it as one) and each element gains `locked: boolean`. The payments-on state and plan details for the Parent Zone come from a new `GET /api/account` (`plan`, `lifetime`, `isFounder`, `isGuest`, `email`, `paymentsEnabled`, `freePackCount`, `totalPackCount`). Mastery math is unchanged.
- **Caching:** `fetchJsonCached` only stores successful responses, so a 402 never pollutes the offline cache, and a pack cached while unlocked stays playable offline (acceptable: it was paid for).
- **Field behaviour after go-live for an outdated client:** build 6 users see the existing "Oops! This topic is taking a nap" screen on a locked pack until they update. No server workaround; 1.0.1 is required for the lock UI.

## 4. What the child sees

- **Packs and topics grids:** locked packs stay in the grid, same position, with a small lock badge and the card at 70% opacity. The mastery ring still shows.
- **Tap on a locked pack:** a kid card, "Ask a grown-up to unlock 🔒", with one button "Grown-ups" that goes to `/parent`. No price, no buy button, no external link on any child screen. This matches the App Store reviewer notes ("purchase flows sit behind the grown-ups gate").
- **Parent Zone → new "Unlock everything" card** (shown only when `paymentsEnabled` and the account is not lifetime):
  - Web: the pack count ("33 of 37 packs"), the price from `LIFETIME_PRICE_DISPLAY`, a button that calls `POST /api/stripe/checkout`, and the line "Have a founder code? Enter it at checkout." Guests see the email-claim form first with the copy "Add your email first so your purchase is safe on every device"; the buy button is disabled until the account is claimed.
  - iPhone: the pack count, Apple's localized price read from StoreKit (never the hardcoded string), a "Buy" button, and a "Restore Purchases" button. No link to the website. Guests may buy (Apple's own restore covers a lost guest account).
  - Lifetime accounts see "Everything is unlocked ✓" and, for founders, "Founder — thank you!".
- `/unlock` and `/unlock/thanks` stay as the web landing for the purchase and the Stripe success URL; `/unlock` redirects to `/parent` when the gate is already passed, so there is one buy surface.

## 5. Stripe (web)

Existing: hosted Checkout session, `client_reference_id = accountId`, signature-verified webhook, idempotent `plan = 'lifetime'`.

Changes:

- Checkout: `allow_promotion_codes: true`. Refuse (409) when the account is lifetime (exists) and refuse (403 `claim-first`) when the account is a guest.
- Webhook `checkout.session.completed`: set `plan`, `planSource = 'stripe'`, `planGrantedAt`, `stripeCheckoutSessionId`, `stripePaymentIntentId`. Set `isFounder = true` when the session's applied promotion code (expand `total_details.breakdown.discounts` → promotion code → `code === 'FOUNDER'`) is present. Detection by code, never by amount.
- Webhook `charge.refunded` (full refund only): find the account by `stripePaymentIntentId`; if `planSource === 'stripe'`, set `plan = 'free'`, clear `planSource`/`planGrantedAt`, keep `isFounder` as is. A partial refund does nothing.
- Stripe objects, created with Jenny's go through the Stripe MCP: product "Mandarineer lifetime unlock", price $9.99 one-time USD, coupon "Founder" of type fixed amount off that nets $1.00 (amount off $8.99, currency USD, duration once), promotion code `FOUNDER` with `max_redemptions = 100` and `expires_at`. Keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`) are pasted into Vercel by Jenny (credential rule).

## 6. Apple (iPhone)

- **Product:** non-consumable `com.mandarineer.app.lifetime`, price tier for $9.99, created by Jenny in App Store Connect (needs the Paid Applications Agreement first).
- **Client plugin, in-repo, no third party:** `ios/App/App/LifetimePurchase.swift`, a Capacitor plugin on StoreKit 2 exposing `getProduct()` → `{ id, displayPrice }`, `purchase()` → `{ jws }`, `restore()` → `{ jws[] }` from `Transaction.currentEntitlements`. JS wrapper in `lib/purchase-native.ts` with `isNativeApp()` guard. About 120 lines of Swift.
- **Server verify:** `POST /api/apple/verify { jws }` → `@apple/app-store-server-library` `SignedDataVerifier` (Apple root CAs bundled in the repo, bundle id `com.mandarineer.app`, try Production then Sandbox environment). Accept only `productId === 'com.mandarineer.app.lifetime'`, `type === 'Non-Consumable'`, no `revocationDate`. Then apply the restore policy from section 2 and set `plan`, `planSource = 'apple'`, `planGrantedAt`, `appleOriginalTransactionId`. The account comes from `getAuthContext()` only. Verification is offline against Apple's certificates; the App Store Connect API key is **not** needed and does not go to Vercel.
- **Server notifications:** `POST /api/apple/notifications` (App Store Server Notifications V2) → verify the signed payload with the same library; on `REFUND` or `REVOKE` for our product, find the account by `appleOriginalTransactionId`; if `planSource === 'apple'`, set `plan = 'free'` and clear the Apple binding. Any other notification type is acknowledged and ignored. Jenny sets the production and sandbox URLs in App Store Connect to `https://mandarineer.com/api/apple/notifications`.
- **Client flow:** Buy → `purchase()` → `POST /api/apple/verify` → on 200 refresh the pack list (`/api/packs`) → locks disappear. Restore → `restore()` → verify each JWS until one succeeds. Errors show a calm parent-facing message; nothing is charged on failure because StoreKit only completes a charge on a successful purchase, and our verify route never triggers a charge.
- **Testing in the sandbox:** TestFlight builds use the sandbox automatically with a sandbox tester Apple ID that Jenny creates in App Store Connect.

## 7. Never-overcharge rules, each with its enforcement point

1. **One purchase per account.** `POST /api/stripe/checkout` returns 409 when `hasLifetime`. The iPhone Buy button is hidden when lifetime, and StoreKit itself refuses to charge twice for a non-consumable.
2. **A paid account is never deleted by the cleanup job.** `app/api/cron/cleanup-guests/route.ts` adds `plan: 'free'` to its delete filter. Today it would delete a paid guest after 90 days. This is the first change in Phase A.
3. **No subscriptions, no consumables, one price.** Nothing in the code can create a recurring charge.
4. **Refunds downgrade automatically, by source** (sections 5 and 6). A parent who was refunded is never charged again unless they buy again on purpose.
5. **The founder code cannot stack and cannot go below $1.** Fixed amount off, `duration: once`, capped, dated, web only.
6. **Guests cannot buy on the web without an email**, because email is the only web restore path. A purchase that could be lost is treated as an overcharge.
7. **Restore always works on the iPhone** and moves the entitlement to the account in use (section 2).
8. **The switch flips once, server-side, after 1.0.1 is live.** No window where the web charges and the phone cannot unlock.
9. **Tests guard the money paths** (section 9).

## 8. Data and privacy updates that ship with 1.0.1

- App Privacy label: add Purchases → Purchase History (linked, not tracking, App Functionality). `ios/App/App/PrivacyInfo.xcprivacy`: add `NSPrivacyCollectedDataTypePurchaseHistory`.
- Privacy policy page: a "Purchases" paragraph (what we store: plan, source, Stripe/Apple transaction ids; no card numbers ever touch our servers).
- Store listing: replace "Free to play. 加油!" with "Free to start: 4 packs are free forever. One $9.99 purchase unlocks everything, for every child on the account, on iPhone, iPad, and the web." Review notes: add the sentence "In-app purchase: Parent Zone → Unlock everything; Restore Purchases is on the same card."
- Small Business Program: Jenny applies before go-live so the 15% rate applies from the first sale.

## 9. Testing

No suite exists today. Add `vitest` (dev dependency, `npm test`) scoped to the money paths:

- `lib/plan.test.ts`: `isPackFree`, `canAccessPack` with payments on/off, free/lifetime accounts.
- `app/api/stripe/webhook`: `checkout.session.completed` with and without the FOUNDER code; `charge.refunded` full vs partial; refund for an Apple-sourced account is a no-op. Stripe events are JSON fixtures; signature verification is stubbed.
- `app/api/apple/verify` and `notifications`: a valid sandbox JWS fixture, a wrong product id, a revoked transaction, the move-on-restore case, and REFUND for a Stripe-sourced account is a no-op. The verifier is stubbed at the library boundary.
- Scripted end-to-end, the same style as the account-deletion test: Stripe test mode checkout with the test card and the FOUNDER code; Apple sandbox purchase in TestFlight on Jenny's phone, then restore on a second account.

## 10. Phases and ownership

**Phase A (Claude, mergeable now, dormant):** Prisma migration for the new fields; `lib/plan.ts` helpers and the server-side switch; 402 gating on the three read routes and two write routes; `locked`/`paymentsEnabled` in `/api/packs`; cleanup-cron fix; kid lock badge + "Ask a grown-up" card; Parent Zone unlock card (web path); `/unlock` redirect; vitest with the plan, gate, cleanup, and checkout-guard tests (webhook tests move to Phase B).

**Phase B (Claude + Jenny):** promo codes, founder detection, refund webhook; Stripe objects created via MCP with Jenny's go; Jenny pastes the three Stripe keys into Vercel; end-to-end test-mode run.

**Phase C (Claude + Jenny):** StoreKit plugin, verify and notifications routes, Apple tests; Jenny: Paid Applications Agreement, Small Business Program, IAP product, sandbox tester, notification URLs; build 7 to TestFlight; sandbox purchase + restore test; privacy manifest and listing updates; submit 1.0.1.

**Go-live:** after Apple approves 1.0.1, Jenny releases it and sets `PAYMENTS_ENABLED=true` in Vercel the same hour. Announce the FOUNDER code.

**Jenny's items with latency, start now:** Paid Applications Agreement (banking + tax), Small Business Program application. Both can take days and nothing in Phase C can be tested on a device without the first.

## 11. Out of scope

Custom Family Packs pricing (decision still open), Apple offer codes, Android, regional pricing beyond Apple's automatic equalization and Stripe's single USD price, gifting, family-sharing of the Apple purchase across Apple IDs.
