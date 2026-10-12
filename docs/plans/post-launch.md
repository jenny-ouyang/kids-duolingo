# Post-launch plan (v1.0 → 1.0.1)

Written 2026-10-12 for GitHub issue #7. Companion to `app-store-path.md` (status section) and `launch-plan.md`.

## 1. Crash and feedback visibility without third-party SDKs

The app is child-directed, so no analytics or crash SDK goes in the iOS build (Kids-safe by design, and it keeps the App Privacy label honest). What we use instead:

- **Xcode → Organizer → Crashes**: Apple's own crash reports for App Store builds, opt-in from users who share diagnostics. Check weekly for the first month.
- **TestFlight feedback**: testers can shake-to-report with a screenshot. Keep the internal TestFlight group alive after launch so Jenny's own devices stay on the newest build.
- **App Store Connect → Ratings and Reviews**: reply to every review in the first month (replies are public and count toward trust).
- **Server side**: Vercel function logs for `/api/*` 5xx spikes; Supabase Auth logs for sign-in failures. The daily keepalive (n8n) already proves the DB is up.

## 2. App Review rejection playbook

Budget one rejection cycle. Reply in Resolution Center within 24h, be concrete, attach a screen recording when it helps.

**Guideline 4.2 (Minimum Functionality — "app is a website wrapper")**
> Thank you for the review. Mandarineer is a bundled native app, not a remote web view: the UI, all 484 Mandarin audio clips and all 360 illustrations ship inside the binary, so practice runs with no network once a pack has been played (please play one pack, enable Airplane Mode, and replay it). The app also uses native haptics on every answer and the native splash/status bar. Only progress sync uses the network. We are happy to add any further native functionality you would find appropriate for a children's vocabulary app.

**Guideline 5.1.1(v) (account deletion not found)**
> Account deletion is available in-app: open the Parent Zone (home → "Parent Dashboard"), answer the grown-ups gate, scroll to "Account" → "Delete account", type DELETE and tap "Delete forever". This removes the account, every child profile and all progress immediately on our servers (the Supabase auth user is deleted, not deactivated).

**Guideline 5.1.4 / 1.3 (kids: data or links)**
> The app collects no data from children directly. A profile is a nickname and an emoji chosen by the parent; the only email we ever store is the parent's, and only if the parent chooses to claim the guest account. There are no third-party SDKs, no ads, no analytics and no tracking (see the privacy manifest and App Privacy label). Links to the privacy policy and terms exist only inside the Parent Zone, behind the grown-ups gate.

**Guideline 2.1 (app crashed / could not log in)**
> No login is needed: the app signs in silently as a guest on first launch. If the welcome screen did not advance, please confirm the device had network access on first launch (the guest session is created server-side once, then cached). We tested build N on iPhone and iPad on iOS 17–26. Could you share the device, OS version and a screen recording so we can reproduce?

**Guideline 2.3 (metadata / screenshots don't match)**
> Reply with the exact screen each screenshot shows and the build it was taken from; re-shoot from the submitted build if anything drifted.

## 3. 1.0.1 scope (ship 2–4 weeks after approval)

1. **Licensed audio**: regenerate the 355 edge-tts clips with Jenny's Azure Speech key, same voice names (`zh-CN-XiaoyiNeural`, `zh-CN-YunxiaNeural`). Issue #10. Jenny creates the Azure resource; Claude swaps the backend in `scripts/generate-audio.py` and reruns (ask before the batch).
2. **Parent-configured practice reminder** via `@capacitor/local-notifications`: one gentle daily reminder, off by default, set from the Parent Zone, no streak-pressure copy. Strengthens the 4.2 story and is genuinely useful.
3. **Anything App Review asked for** in the v1.0 cycle.
4. **Review-prompt**: `SKStoreReviewController` after the 3rd completed session, parent-side only (never on a kid screen). Optional.

Explicitly not in 1.0.1: payments/IAP (content gating isn't built), Kids Category move (decision D2), Sign in with Apple (no third-party login exists, so 4.8 doesn't apply).

## 4. Launch-day checklist

- [ ] Approved → set release to "Manually release" so the web and store go live together, then press Release.
- [ ] Verify the App Store listing page on a phone (screenshots, subtitle "Chinese for kids, ages 4–8").
- [ ] Add the App Store badge + link to the mandarineer.com landing page.
- [ ] Update CLAUDE.md status line and `launch-plan.md` Phase 5 to "shipped vX (build N)".
- [ ] Open the 1.0.1 milestone with issues #10 and the reminder feature.
