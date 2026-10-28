# Payment settings checklist

Everything outside the code that must exist before payments go live. Spec: `docs/superpowers/specs/2026-10-13-payments-design.md`. Code work: `docs/superpowers/plans/2026-10-13-payments-phase-a.md` (Phase A), then the Phase B and Phase C plans.

Owner marks: **J** = Jenny must do it (her login or her money). **C** = Claude does it with Jenny's go. Tick a box only when the item is done and checked.

## 1. Stripe (web payments)

- [x] **C** Confirm which Stripe account and mode the MCP connection uses (live or test). Checked 2026-10-28: `acct_1Q4BsvI8CgNewoIS`, display name "Jenny Ouyang", **live mode**. It is the Build to Launch account (membership, sprints, kits). No Mandarineer product exists in it. Its MCP key stops working on 2026-11-30 (Stripe deprecation notice).
- [x] **J** Decide: separate Stripe account. Jenny chose "Create a separate account" (2026-10-28).
- [x] **J** New account made: `acct_1UVRTmEuUPOEXjWv`, name "Mandarineer", US, live, charges and payouts enabled, nothing due. Jenny does not use test mode; Claude may create coupons when needed.
- [x] **J** Live secret key given through a hidden Mac dialog, saved only in `.env.local` (git-ignored). Never in chat.
- [ ] **J** Statement descriptor is "JENNY OUYANG". Change it to `MANDARINEER`: Stripe → Settings → Business → Public details. (Only the Dashboard can change it. Checked 2026-10-28: the API answers "You cannot use this method on your own account". Stripe first asks for support details: support URL `https://mandarineer.com`, privacy `https://mandarineer.com/privacy`, terms `https://mandarineer.com/terms`; all three pages answer 200.)
- [x] **C** Create the product "Mandarineer lifetime unlock" (one-time): `prod_VWUfZ5jzR8JSR5` (live, Mandarineer account).
- [x] **C** Create the price: $9.99 USD, one-time: `price_1UVRgHEuUPOEXjWvTyPWLGQ0` (product default price).
- [x] **C** Create the coupon "Founder": $8.99 off, USD, duration once (nets $1.00): `zod1MPKN`, limited to the product.
- [x] **C** Create the promotion code `FOUNDER` on that coupon: max 100 redemptions, expires **2026-12-27** (60 days from 2026-10-28, not from go-live; Claude makes a new code if go-live is later).
- [x] **C** Create the webhook endpoint `https://mandarineer.com/api/stripe/webhook` with events `checkout.session.completed` and `charge.refunded`: `we_1UVRgXEuUPOEXjWvEavj6v4v`. Live route answers 400 without a signature (armed).
- [x] **C** (Jenny gave the key; Claude set it) Vercel Production + Preview: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, all type Sensitive.
- [x] **C** Phase B code: founder detection, purchase ids, full-refund downgrade, 7 tests (`e0223c6`). Payments Phase A merged (`8a2b9af`).
- [ ] **J** Live end-to-end run (no test mode, Jenny's call): Jenny buys once with `FOUNDER` ($1.00) on the preview (payments on there), Claude checks the unlock, then refunds it and checks the lock comes back.
- [ ] **J** Stripe Dashboard → Settings → Public details: statement descriptor "MANDARINEER", support email support@mandarineer.com, support URL https://mandarineer.com. (Parents see this on their card statement.)

## 2. App Store Connect (iPhone purchase)

- [ ] **J** Agreements, Tax, and Banking → accept the **Paid Applications Agreement**. Fill in banking and tax forms. Acceptance can take days. Nothing below can be tested on a phone until this is accepted.
- [ ] **J** Apply to the **Small Business Program** (15% instead of 30%): https://developer.apple.com/app-store/small-business-program/ . It is an application, not a toggle. Apply before go-live so the first sale is at 15%.
- [ ] **J** Mandarineer → In-App Purchases → create a **Non-Consumable**: reference name "Lifetime unlock", product id `com.mandarineer.app.lifetime`, price tier for $9.99 USD, display name "Unlock everything", description "Every pack, every child in your family, forever.", review screenshot (Claude supplies it in Phase C).
- [ ] **J** Users and Access → Sandbox → Test Accounts → create one sandbox tester (any email you control). Record only the email here, never the password: {{sandbox tester email}}
- [ ] **J** Mandarineer → App Information → App Store Server Notifications: Production URL `https://mandarineer.com/api/apple/notifications`, Sandbox URL the same, version 2.
- [ ] **C** Phase C sandbox run: purchase on Jenny's phone with the sandbox tester, restore on a second account, refund through the sandbox.

## 3. Vercel (the switch)

- [x] **C** Add `PAYMENTS_ENABLED` to Production env with value `false` now (done 2026-10-28). Preview has `true` for testing.
- [ ] **J** Go-live, same hour as the 1.0.1 release: set `PAYMENTS_ENABLED=true` and redeploy. Web and phone switch on together.

## 4. Listing and privacy (ship with 1.0.1)

- [ ] **C** App Privacy label: add Purchases → Purchase History (linked, not tracking, App Functionality). Also in `ios/App/App/PrivacyInfo.xcprivacy`.
- [ ] **C** Privacy policy page: a "Purchases" paragraph (what we store; no card numbers ever reach our servers).
- [ ] **C** Store listing: replace "Free to play. 加油!" with the free-tier sentence from the spec §8; add the in-app-purchase line to the review notes.

## 5. Go-live order

1. Phase A merged (dormant). 2. Stripe objects + keys in place, test-mode run green. 3. Paid Applications Agreement accepted, IAP product created, sandbox run green. 4. 1.0.1 submitted with the IAP and approved. 5. Release 1.0.1 and set `PAYMENTS_ENABLED=true` in the same hour. 6. Announce `FOUNDER`.
