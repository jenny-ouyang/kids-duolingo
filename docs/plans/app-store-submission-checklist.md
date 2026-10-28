# App Store submission checklist — Mandarineer 1.0 (build 6)

Goal: submit version 1.0, build 6, free, to App Review. Claude drives App Store Connect; Jenny gives the inputs only she has and presses nothing unless stated. Tracking issue: GitHub #9. Copy source: `store/listing.md`.

**J** = Jenny. **C** = Claude.

## 0. Access (one of the two)

- [ ] **J** Option A, browser: reconnect the Claude Chrome extension and open App Store Connect in that Chrome, signed in. Claude then fills every screen below with you watching.
- [ ] **J** Option B, API: paste the **Issuer ID** from App Store Connect → Users and Access → Integrations → App Store Connect API (it is a UUID at the top of the page, not a secret). Key `TT2YN4RP4G` already sits on this Mac. Claude then fills everything the API supports and asks for the browser only for the App Privacy answers, which the API does not cover. Issuer ID: {{issuer id}}

## 1. Already done

- [x] **C** Build 6 uploaded and processed (2026-10-12). TestFlight has it.
- [x] **C** Listing copy, keywords, URLs, category, price in `store/listing.md`.
- [x] **C** Screenshots: 6 iPhone 6.9" and 3 iPad 13" in `store/screenshots/`.
- [x] **C** Age-rating answers and App Privacy table in `store/listing.md`.
- [x] **C** Reviewer notes with the 4.2 story and the account-deletion path.
- [ ] **J** Build 6 tested on your phone: a pack plays, Airplane Mode replay works, Parent Zone gate opens. (Issue #8.)

## 2. App Store Connect entry

- [ ] **C** App Information: name "Mandarineer", subtitle "Chinese for kids, ages 4–8", primary category Education, no secondary.
- [ ] **C** Age rating questionnaire: all descriptors None/No → expected 4+.
- [ ] **C** Pricing: Free, all territories.
- [ ] **C** Version 1.0: description, promotional text, keywords, support URL, marketing URL, privacy policy URL.
- [ ] **C** Screenshots uploaded for iPhone 6.9" (6) and iPad 13" (3).
- [ ] **C** App Privacy: Email, Name, User ID, Product Interaction; all linked, none for tracking, purpose App Functionality. (Browser only.)
- [ ] **C** App Review information: contact name, phone, email; no sign-in required; reviewer notes from `store/listing.md`.
- [ ] **C** Build 6 attached to version 1.0.
- [ ] **C** Release option: "Manually release this version" so the release day is yours.
- [ ] **J** App Review contact phone number (Apple requires one): {{phone}}

## 3. Submit

- [ ] **J** Say "submit". Claude presses Submit for Review (API) or you press it in the browser.
- [ ] **C** Record the submission date and time here: {{date}}
- [ ] **C** Watch for the review result email. On rejection: reply with the matching template in `docs/plans/post-launch.md` within 24 hours.
- [ ] **J** On approval: press Release (or say "release" and Claude does it by API). Then the launch-day list in `docs/plans/post-launch.md`.
