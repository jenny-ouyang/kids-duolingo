# iOS App Store Launch Path

**App:** kids-duolingo — Next.js 14 kid-friendly Chinese + Math learning app, currently a Vercel web app.
**Goal:** free trial on the web, one-time purchase on the iOS App Store.
**Owner status:** active Apple Developer account.
**Researched:** 2026-08-17. Policy details below were verified against current sources (linked inline); Apple revises the App Review Guidelines several times a year, so re-check the linked guidelines at submission time.

---

## 1. Wrapper strategy

### Recommendation: Capacitor, bundled static export, plus 3–4 native capabilities

Capacitor is the right wrapper for this codebase. It runs the existing web UI inside WKWebView, exposes native APIs (TTS, haptics, notifications, filesystem) through plugins, and produces a normal Xcode project you submit like any native app. Alternatives compared:

| Option | Verdict |
|---|---|
| **Capacitor** | Best fit. Keeps the React/Next.js code, mature plugin ecosystem, first-class Next.js guides ([Capgo guide](https://capgo.app/blog/building-a-native-mobile-app-with-nextjs-and-capacitor/), [nextnative tutorial](https://nextnative.dev/tutorials/build-ios-app-nextjs)). |
| Cordova | Legacy; Capacitor is its successor. No reason to choose it in 2026. |
| React Native / Expo | Full rewrite of the UI layer. Only worth it if 4.2 rejection proves unbeatable with a wrapper (unlikely if the native work below is done). |
| PWA only (Add to Home Screen) | No App Store presence, no IAP, no paid distribution. Fails the goal. |
| Swift + bare WKWebView | Same review risk as Capacitor with none of the plugin ecosystem. |

### Guideline 4.2 (Minimum Functionality) in 2026 — the real risk

This is the single biggest rejection risk for this project. Current state of play:

- Apple's [guideline 4.2](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality) requires the app to be more than "a website in a wrapper." Enforcement has tightened steadily; web-wrapper rejections are now among the most common ([MobiLoud analysis](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper), [Publishd: "Why Wrapping a Web App Doesn't Work (Anymore)"](https://publishd.app/blog/why-wrapping-a-web-app-doesnt-work)).
- The practical test reviewers apply: **if the app behaves identically to the site in Safari, it gets rejected.** Bolting on one token API (push alone, GPS alone) is explicitly called out as insufficient ([AcceptMyApp requirements guide](https://acceptmy.app/guides/web-app-to-ios-app-store-requirements), [Ionic forum 4.2 thread](https://forum.ionicframework.com/t/apple-4-2-minimum-functionality/189688)).
- What reliably gets wrapped apps through: **genuine offline behavior** (cached content, usable without network) and **native capabilities tied to the app's actual purpose**, not decoration.

For this app, the honest 4.2 story is strong *if built*: an 8-question practice session with pre-generated questions is naturally cacheable, and native Chinese TTS is core to the product. Planned native capabilities, in priority order:

1. **Offline practice (highest 4.2 value).** Bundle the question/vocab data (or sync it to local SQLite/Preferences on first launch) so a child can practice on a plane. The app already pre-generates questions into the DB, so shipping a local snapshot is architecturally easy. This is the capability reviewers weight most.
2. **Native TTS** via `@capacitor-community/text-to-speech` ([repo](https://github.com/capacitor-community/text-to-speech)) or Capawesome's [Speech Synthesis plugin](https://capawesome.io/docs/sdks/capacitor/speech-synthesis/) — required anyway, see below.
3. **Haptics** (`@capacitor/haptics`) on correct/wrong answers and celebrations — cheap, kid-delightful, native-only.
4. **Local notifications** (`@capacitor/local-notifications`) for a daily practice/streak reminder. Note: in a kids' context, keep reminders parent-configured and gentle; manipulative streak pressure invites both review and COPPA scrutiny.
5. Optional garnish: native splash/status-bar handling, app badge, home-screen quick actions.

### Web Speech API in WKWebView — native TTS plugin IS needed

The current `lib/tts.ts` uses `window.speechSynthesis` with a zh-CN voice preference list. In WKWebView this is unreliable:

- `speechSynthesis` nominally exists in WKWebView, but **only pre-installed system voices are exposed; downloadable/enhanced voices never appear**, and `getVoices()` returns an incomplete list compared to Settings ([Apple Developer Forums: voices not listed](https://developer.apple.com/forums/thread/723503), [caniwebview: speech synthesis](https://caniwebview.com/features/web-feature-speech-synthesis/)).
- zh-CN specifically is flaky on iOS: devices with zh-HK/Siri-language settings have been observed speaking Cantonese when zh-CN is requested, and iOS 18 introduced Siri-language interference with Mandarin voice selection ([forum thread on Mandarin/Cantonese swap](https://developer.apple.com/forums/thread/768259), [TTS language change failure](https://developer.apple.com/forums/thread/801554)).
- The app's existing first-gesture unlock hack (June 2026 audio hardening) exists precisely because web speech on iOS is fragile.

**Plan:** create a small TTS abstraction — `speakChinese()` keeps its signature; on native (detected via `Capacitor.isNativePlatform()`) it calls the native plugin with `lang: 'zh-CN'` (AVSpeechSynthesizer under the hood, which handles Mandarin far better and needs no gesture unlock); on web it falls back to the current `speechSynthesis` path. This one change simultaneously fixes the app's worst platform bug *and* is a legitimate 4.2 native capability.

**DECISION POINT (D1):** Approve Capacitor + the four native capabilities above as the 4.2 package. If you want a lower-effort first submission, the minimum credible set is offline practice + native TTS + haptics; local notifications can ship in 1.1.

---

## 2. Monetization

### Recommendation: free app + one-time non-consumable IAP ("Unlock Everything")

| Model | Fit |
|---|---|
| **Paid-upfront app** ($X to download) | Poor fit. No trial on iOS at all; conversion from a web trial requires the parent to pay *before* the app opens; paid apps convert far worse in 2026; and there is no clean way to grant the app free to existing web users. |
| **Free app + non-consumable IAP** | Best fit. App downloads free, some content (e.g. first 2 packs of each subject) is playable forever, one IAP unlocks all packs. Mirrors the web free-trial exactly and lets the same "unlocked" entitlement be shared across web and iOS. |
| Subscription | Not the stated goal; also adds Schedule 2 agreements, restore complexity, and parental-consent friction. Skip. |

Mechanics and policy facts (verified current):

- **Small Business Program: 15% commission applies equally** to paid apps, consumable/non-consumable IAP, and subscriptions, for developers under $1M/year prior-year proceeds. New developers qualify. Enroll at [developer.apple.com/app-store/small-business-program](https://developer.apple.com/app-store/small-business-program/); details in [RevenueCat's 2026 guide](https://www.revenuecat.com/blog/engineering/small-business-program). **Enrollment is not automatic — apply before launch.** If proceeds later exceed $1M in a calendar year, the standard rate applies to sales after crossing it.
- **Referencing the web version is now allowed in the US.** Since the May 2025 guideline update following the Epic ruling, [guideline 3.1.1](https://developer.apple.com/app-store/review/guidelines/#payments) permits US-storefront apps to include buttons/links/calls-to-action to external purchase mechanisms ([9to5Mac coverage](https://9to5mac.com/2025/05/01/apple-app-store-guidelines-external-links/), [mjtsai guideline diff](https://mjtsai.com/blog/2025/05/02/app-review-guidelines-updated-for-epic-anti-steering/)). This applies to the **US storefront**; other storefronts retain stricter steering rules (EU has its own DMA regime).
- **Cross-platform entitlement is explicitly blessed:** [guideline 3.1.3(b) Multiplatform Services](https://developer.apple.com/app-store/review/guidelines/#payments) lets users access content "acquired … on other platforms or your web site, provided those items are also available as in-app purchases within the app." So: sell the unlock on the web (Stripe, keep ~97%) *and* offer the same unlock as an IAP in the app. A parent account that bought on the web signs in on iOS and is unlocked. This is the standard, approved pattern.
- **Kids-context caveat:** any purchase or link-out inside the app must sit behind a **parental gate** if the app targets kids (see §3), and in the Kids Category, linking out of the app requires a gate regardless.

Suggested price point: $9.99–$14.99 one-time (kids' education apps with real content depth support this; at 15% you net ~$8.50–$12.75). Not a policy matter — pick at launch.

**DECISION POINT (D2):** Confirm free-with-non-consumable-IAP model, the free-tier boundary (e.g. 2 packs per subject vs. N sessions), and the price. Also decide whether web purchases unlock iOS (requires parent sign-in in the app — currently the app has no auth, see §6 prerequisite).

---

## 3. Kids Category vs. general Education listing

### Current Kids Category rules ([guideline 1.3](https://developer.apple.com/app-store/review/guidelines/#kids-category) + [5.1.4](https://developer.apple.com/app-store/review/guidelines/#kids))

- **No third-party advertising.** Third-party **analytics** only if they collect no IDFA, no identifiable child information, no location, no device identifiers ([Apple's 2019 clarification](https://developer.apple.com/news/?id=091202019a), [guideline history](https://www.appstorereviewguidelineshistory.com/articles/2019-09-14-kids-apps-ads-analytics-and-sign-in-with-apple/)).
- **May not send personally identifiable information or device information to third parties** at all.
- **Parental gate** required before: links out of the app, purchase flows, permission requests ([BuddyBoss 1.3 guide](https://buddyboss.com/docs/app-store-guideline-1-3-safety-kids-category/)). A gate is typically "hold for 3 seconds" / "solve 7 × 8" — adult-difficulty interaction.
- **Privacy policy required** (linked in App Store Connect and in-app) and compliance with children's privacy law (COPPA, GDPR-K).
- **Sticky:** once shipped in the Kids Category, the app must keep meeting Kids rules **even if you later leave the category** ([Apple news post](https://developer.apple.com/news/?id=091202019a)).
- Age-rating overhaul (2025): ratings are now 4+, 9+, 13+, 16+, 18+, with a mandatory expanded questionnaire; all apps had to re-rate by Jan 31, 2026 ([Apple](https://developer.apple.com/news/?id=ks775ehf), [MacRumors](https://www.macrumors.com/2025/07/25/apple-overhauls-app-store-age-ratings/)). This app is a clean 4+.

### COPPA implications (independent of category choice)

The planned model — parent email + child first name + per-child answer history — makes COPPA apply because the app is **directed to children**, category or not ([FTC 6-step compliance plan](https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business), [2025 practitioner guide](https://blog.promise.legal/startup-central/coppa-compliance-in-2025-a-practical-guide-for-tech-edtech-and-kids-apps/)). And Apple's [5.1.4](https://developer.apple.com/app-store/review/guidelines/#kids) applies children's-privacy obligations to *any* app that collects personal info from minors, not just Kids Category apps. Practical requirements:

- The **parent** creates the account and consents; collect the child's data *through the parent* (parent enters child's first name). Direct collection from the child triggers verifiable-parental-consent machinery — avoid it.
- **Data minimization:** first name (or nickname) only, no child email, no child photos, no location, no persistent advertising identifiers. Answer history keyed to an opaque child ID is fine under the "internal operations" support, but keep it first-party only.
- **No third-party trackers in the app.** Vercel Analytics/Speed Insights, Sentry, PostHog etc. must be stripped from (or never added to) the iOS build unless verified child-safe. Supabase as your own backend processor is fine.
- Privacy policy must name what's collected from children, why, retention, and a parental deletion mechanism (a "delete child profile" button satisfies this cleanly).

### Tradeoff and recommendation

| | Kids Category | General Education listing (4+ rating) |
|---|---|---|
| Discoverability | Curated Kids section; parents browse it with trust | Normal Education charts/search |
| Constraints | All of 1.3 forever (sticky), gates everywhere, stricter review | Still COPPA + 5.1.4 (because the app is child-directed), still parental gate around purchase links per 5.1.4/3.1.1 practice |
| Flexibility | Can never quietly add analytics/ads later | Marginally more room, but not really — child-directed is child-directed |

**Recommendation: list in the Kids Category** (Kids ▸ Ages 5 & Under / 6–8 as fits). Reasoning: the app must satisfy ~95% of Kids rules anyway because it is child-directed under COPPA and Apple 5.1.4; the remaining delta (parental gate UI, no third-party SDKs) is one or two days of work; and the Kids Category is where parents actually look for exactly this app. The "stay flexible by avoiding Kids Category" argument only pays off for apps that want ads or heavy analytics later — which this app should never want.

**DECISION POINT (D3):** Kids Category (recommended) vs. plain Education listing. If Kids Category, also pick the age band (recommend "6–8", or "5 & Under" if that matches the real audience). Note the stickiness: this choice is hard to walk back.

---

## 4. Privacy requirements

### App Privacy "nutrition label" ([Apple: App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/))

Required in App Store Connect before submission. Given the data model (parent email, child first name, answer events, hearts/streak), declare:

| Data type | Collected? | Linked to identity? | Tracking? |
|---|---|---|---|
| Contact Info ▸ Email Address (parent) | Yes — account creation | Yes | No |
| Contact Info ▸ Name (child first name) | Yes | Yes (linked to parent account) | No |
| Usage Data ▸ Product Interaction (answer history, streaks) | Yes | Yes (per child profile) | No |
| Identifiers ▸ User ID (internal account/child IDs) | Yes | Yes | No |
| Purchases (IAP receipt/entitlement) | Yes | Yes | No |
| Location, Contacts, Photos, Browsing, Advertising Data, Diagnostics | No | — | — |

Purpose for all: **App Functionality** only. **"Data Used to Track You" must be empty** — non-negotiable for a kids app, and any tracking declaration conflicts with Kids Category rules. If the current build works profile-less (localStorage child), the label shrinks accordingly — but declare for what you ship.

### Privacy policy

Required for every app (guideline 5.1.1) and doubly for child-directed apps (5.1.4). Must be: linked in App Store Connect metadata, reachable in-app (behind the parental gate is fine), and must cover children's data specifically — what's collected, from whom, first-party-only sharing, retention, and how a parent deletes a child's data ([privacy-policy requirements overview](https://www.legalforge.app/blog/privacy-policy-for-mobile-app), [TermsFeed children's app guide](https://www.termsfeed.com/blog/privacy-guidelines-apps-children/)). Host it on the app's own domain. Optional credibility add-on: a COPPA Safe Harbor certification (kidSAFE, PRIVO) — not required, skip for v1.

### Account deletion

Apps with account creation must offer **in-app account deletion** (guideline 5.1.1(v)). If parent accounts ship, a working "delete account and all child data" flow is mandatory before submission.

---

## 5. Technical checklist (Capacitor + Next.js)

### Static export vs. remote URL — ship the bundle

- **Bundle a static export.** `output: 'export'` in `next.config.js` produces `out/`, which Capacitor copies into the native shell ([Capgo guide](https://capgo.app/blog/building-a-native-mobile-app-with-nextjs-and-capacitor/)). This is the intended production mode.
- **Do NOT ship `server.url` pointing at the Vercel site.** Capacitor's remote-URL mode is a livereload/dev feature; a production app that is literally the remote website in a shell is the exact thing 4.2 rejects ("works identically in Safari"), and it forfeits the offline story. Loading *data* from your API is fine; loading the *app UI* remotely is not.
- Consequences of static export for this codebase:
  - Dynamic routes `practice/[packId]` and `math/practice/[topicId]` need `generateStaticParams` (pack/topic IDs are a small fixed set — easy) or a query-param route variant.
  - `app/api/*` routes do not exist in the export. The iOS build must call the deployed Vercel API absolutely (`NEXT_PUBLIC_API_BASE=https://kids-duolingo.vercel.app`) — with offline-first caching layered on top (§1).
  - CORS: allow the capacitor origin (`capacitor://localhost`) on the API routes.
- iOS platform: `npm i @capacitor/core @capacitor/cli @capacitor/ios`, `npx cap init`, `npx cap add ios`, then per release `next build && npx cap sync ios && npx cap open ios`.

### Assets and store plumbing

- **App icon:** 1024×1024 master; Xcode 15+ single-size asset catalogs generate the rest (or `@capacitor/assets` generates all sizes + splash from one source image).
- **Splash screen:** `@capacitor/splash-screen` with a storyboard-based launch screen (required; no static launch images).
- **Bundle ID, signing:** create App ID + app record in App Store Connect; automatic signing via the existing developer account.
- **Screenshots:** 6.9" iPhone and 13" iPad sets (iPad is effectively mandatory for a kids app — and the app must actually look right on iPad).
- **App Review notes:** provide a demo parent login and state where the parental gate is; kids apps get extra scrutiny.

### TestFlight and review timelines (2026 reality)

- **Internal TestFlight** (your own devices): no review, minutes after upload.
- **External TestFlight**: Beta App Review — plan for **2–7 days**, with documented backlogs stretching longer ([Runway live review times](https://www.runway.team/appreviewtimes), [PTKD TestFlight backlog report](https://ptkd.com/journal/testflight-external-testing-approved-2026-backlog)).
- **App Store review:** ~90% within 24h historically, but first submissions of new apps — especially Kids Category with IAP — realistically take **2–5 days**, and 2026 has seen backlog spikes of a week or more ([Aerious 2026 review-time overview](https://aerious.uk/blog/app-store-review-time-in-2026-expected-approval-windows-and-delays), [lowcode.agency on the March 2026 delays](https://www.lowcode.agency/blog/ios-app-review-delays-march-2026)). **Budget for one rejection cycle** (4.2 or 1.3 nitpicks) — that's normal, not failure.

---

## 6. Ordered task list — "web app works" → "approved"

Prerequisite reality check: the current app has **no auth** (single-child, per-device). The "free web trial + one purchase unlocks everywhere" model needs parent accounts. Phase 0 is therefore real product work, not packaging.

| # | Task | Effort | Notes |
|---|---|---|---|
| 0a | **Parent account + child profile auth** (Supabase Auth: parent email sign-in, child profiles under parent, migrate ChildProfile/progress keys) | 3–5 days | Prerequisite for cross-platform unlock (D2). Skippable if v1 iOS is standalone-IAP-only with local profiles — **that simplification cuts ~1 week total** but breaks web↔iOS entitlement sharing. |
| 0b | **Entitlement model**: `unlocked` flag per parent account; free-tier boundary enforced in pack/question APIs | 1–2 days | Same flag set by Stripe (web) or StoreKit (iOS). |
| 1 | **Static-export refactor**: `output: 'export'`, `generateStaticParams`, `NEXT_PUBLIC_API_BASE`, CORS for `capacitor://localhost` | 1–2 days | Keep Vercel deploy working from the same repo (conditional config). |
| 2 | **Capacitor shell**: init, add iOS, icons + splash via `@capacitor/assets`, run on device | 1 day | |
| 3 | **Native TTS abstraction** (plugin on native, speechSynthesis on web) | 1 day | Fixes zh-CN reliability; core 4.2 item. |
| 4 | **Offline practice**: bundle/sync question data locally (Capacitor Preferences or SQLite), queue progress writes for reconnect | 3–4 days | The heavyweight 4.2 item; also a genuinely better product on the go. |
| 5 | **Haptics + local notifications** (parent-configured reminder) | 1 day | |
| 6 | **Parental gate** component (gates: purchase, external links, settings/account area) | 0.5–1 day | Required for Kids Category (D3) and wise regardless. |
| 7 | **StoreKit IAP**: non-consumable product in App Store Connect, purchase + restore via a Capacitor IAP plugin (e.g. RevenueCat's `purchases-capacitor` or `@capgo/native-purchases`), server-side receipt→entitlement | 2–3 days | "Restore Purchases" button is required for non-consumables. |
| 8 | **Privacy work**: privacy policy page (children's section), in-app account deletion, strip third-party SDKs from iOS build, fill nutrition label | 1–2 days | §4. |
| 9 | **App Store Connect setup**: app record, Kids Category + new age-rating questionnaire, screenshots (iPhone + iPad), description, **Small Business Program enrollment** | 1 day | Enroll in SBP early — it's an application, not a toggle. |
| 10 | **TestFlight**: internal build → fix; external beta with 2–3 parent testers | 2–7 days elapsed (Beta App Review) | Test on a real child + real iPad. Re-test Chinese audio end-to-end. |
| 11 | **Submit for review**; respond to rejection round if any | 2–5 days elapsed, +1 cycle buffer | Include reviewer notes: demo account, parental-gate location, offline demo instructions. |

**Total effort: roughly 3–4 working weeks** of focused work including Phase 0 (≈2–2.5 weeks if v1 skips shared web/iOS entitlements), plus ~1–2 calendar weeks of review/beta latency.

---

## Decision points (summary)

- **D1 — 4.2 package:** Capacitor with offline practice + native TTS + haptics (+ notifications). Approve scope, or trim notifications to v1.1.
- **D2 — Monetization:** free app + one-time non-consumable IAP (recommended); set free-tier boundary and price ($9.99–$14.99 suggested); decide whether web purchase unlocks iOS in v1 (requires Phase 0 auth) or v1 ships standalone.
- **D3 — Category:** Kids Category, age band 6–8 (recommended) vs. general Education 4+. Sticky choice — Kids rules apply forever once listed there.
- **D4 — Third-party SDK policy:** commit to zero third-party analytics/ads in the iOS build (recommended and effectively required for D3).

## Sources

- [App Review Guidelines (Apple)](https://developer.apple.com/app-store/review/guidelines/) — 1.3, 3.1.1, 3.1.3(b), 4.2, 5.1.1, 5.1.4
- [App Privacy Details (Apple)](https://developer.apple.com/app-store/app-privacy-details/)
- [Small Business Program (Apple)](https://developer.apple.com/app-store/small-business-program/) · [RevenueCat 2026 guide](https://www.revenuecat.com/blog/engineering/small-business-program)
- [Kids Category update news (Apple, 2019)](https://developer.apple.com/news/?id=091202019a) · [BuddyBoss guideline 1.3 guide](https://buddyboss.com/docs/app-store-guideline-1-3-safety-kids-category/)
- [Updated age ratings (Apple)](https://developer.apple.com/news/?id=ks775ehf) · [MacRumors age-rating overhaul](https://www.macrumors.com/2025/07/25/apple-overhauls-app-store-age-ratings/)
- [9to5Mac: external payment links allowed (May 2025)](https://9to5mac.com/2025/05/01/apple-app-store-guidelines-external-links/) · [mjtsai guideline diff](https://mjtsai.com/blog/2025/05/02/app-review-guidelines-updated-for-epic-anti-steering/)
- [MobiLoud: webview apps & review](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper) · [Publishd: wrapping doesn't work anymore](https://publishd.app/blog/why-wrapping-a-web-app-doesnt-work) · [AcceptMyApp iOS requirements](https://acceptmy.app/guides/web-app-to-ios-app-store-requirements)
- [Capgo: Next.js + Capacitor](https://capgo.app/blog/building-a-native-mobile-app-with-nextjs-and-capacitor/) · [nextnative iOS tutorial](https://nextnative.dev/tutorials/build-ios-app-nextjs)
- [capacitor-community/text-to-speech](https://github.com/capacitor-community/text-to-speech) · [Capawesome Speech Synthesis](https://capawesome.io/docs/sdks/capacitor/speech-synthesis/) · [caniwebview: speech synthesis](https://caniwebview.com/features/web-feature-speech-synthesis/)
- [Apple forums: WKWebView voice list gaps](https://developer.apple.com/forums/thread/723503) · [Mandarin/Cantonese voice bug](https://developer.apple.com/forums/thread/768259)
- [FTC COPPA six-step plan](https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business) · [COPPA 2025 practitioner guide](https://blog.promise.legal/startup-central/coppa-compliance-in-2025-a-practical-guide-for-tech-edtech-and-kids-apps/)
- [Runway live review times](https://www.runway.team/appreviewtimes) · [Aerious 2026 review windows](https://aerious.uk/blog/app-store-review-time-in-2026-expected-approval-windows-and-delays) · [PTKD TestFlight backlog](https://ptkd.com/journal/testflight-external-testing-approved-2026-backlog)
