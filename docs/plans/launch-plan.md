# Launch Plan — Free Web Trial → Paid iOS App

*Synthesized 2026-08-17 from four design specs in this directory. Read those for full detail; this file is the sequence and the decision register.*

| Spec | File | Effort |
|---|---|---|
| Multi-tenancy & auth | `multi-tenancy-spec.md` | ~30–37 h |
| Public launch readiness | `launch-readiness.md` | ~15–20 h (must-haves) |
| Audio pipeline | `audio-pipeline.md` | ~8–10 h |
| App Store path | `app-store-path.md` | ~3–4 wk + review latency |

## Phases

### Phase 1 — Multi-tenancy foundation (blocks everything)
Supabase Auth (guest-first anonymous sign-in, upgrade-in-place to real account), new
`Account → Child → progress` schema keyed by `childId`, expand/backfill/contract migration
preserving Julian's data, one `requireChild()` funnel across all API routes, RLS deny-all
on public tables (guests hold JWTs; PostgREST must be closed). Also fixes the
`const CHILD = 'julian'` hardcoded in all 6 API routes.

### Phase 2 — Public polish (parallel-safe with Phase 3)
From `launch-readiness.md` must-have list:
- De-Julianize: 25+ personal references (home heading, site title, encouragement strings, localStorage key).
- Landing page for parents + kid-facing home coexisting; onboarding (child name at minimum).
- Parent dashboard: read from DB (currently reads dead localStorage → shows zeros); remove dead Lock/Unlock; add adult gate.
- Trust surface: privacy policy, terms, contact (COPPA + App Store prerequisite).
- Error resilience: packs/math pages crash on API failure (`.map` on `{error}`); add error/empty states.

### Phase 3 — Pre-generated audio (parallel-safe with Phase 2)
223 clips (172 words + 19 sentences + 17 tiles + 15 celebration phrases), ~$0 in Azure/Google
free tier. `scripts/generate-audio.ts`, sha1 filenames + manifest, committed to git under
`/public/audio/zh/`. Playback via existing shared AudioContext (preserves June iOS unlock);
Web Speech fallback. Voice chosen by 4-clip bake-off (Azure Xiaoxiao/Xiaoshuang vs Google Chirp 3 HD).

### Phase 4 — Free web launch
Deploy, verify keepalive still fits usage, share link. Watch Supabase free-tier limits.

### Phase 5 — iOS App Store (Capacitor)
Bundled Next.js static export (never remote-URL mode). Guideline 4.2 package: offline practice
(bundle questions), native TTS plugin (`@capacitor-community/text-to-speech` — WKWebView
speechSynthesis is unreliable for zh-CN), haptics, local notifications. Free app + one-time
non-consumable IAP; apply to Small Business Program (15%). Web purchases may unlock iOS
(3.1.3(b)) provided the unlock is also sold as IAP. Budget one rejection cycle.

## Decision register (owner: Jenny)

| # | Decision | Outcome | Status |
|---|---|---|---|
| D1 | Guest-first vs account-first onboarding | **Guest-first** | DECIDED 2026-08-17 |
| D2 | Kids Category vs Education listing (sticky) | **REVISED 2026-08-19: plain Education category** (owner chose lower process overhead; app remains child-directed so COPPA-minimal design stays — parent accounts, nickname+avatar only, zero trackers) | DECIDED 2026-08-19 |
| D3 | Price + free/paid boundary | **$9.99 one-time, generous free tier (3–4 packs + math sampler free)** | DECIDED 2026-08-17 |
| D4 | App name | **FINAL 2026-08-20: "Mandarineer"** — brand name Jenny is comfortable wearing; SEO lives in the subtitle pattern "Mandarineer: Mandarin for Kids" (App Store name, title tags, landing subhead). Chinese-first copy, math as included bonus. Domain **mandarineer.com registered 2026-08-20 (Cloudflare)**. Supersedes "Mandarin & Math for Kids" (2026-08-19). | LOCKED |
| D5 | Auth providers at launch | Magic link only (add Google later) | DEFAULT ACCEPTED |
| D6 | TTS voice | Bake-off in Phase 3 | DEFERRED |
| D7 | Guest-data retention window | 90 days | DEFAULT ACCEPTED |
| D8 | Zero third-party SDK commitment (required by D2) | Yes | LOCKED by D2 |

## Next expansion (decided 2026-08-20)

**Custom Family Packs** — parents create their own packs ("My Family's Words": 姥姥,
the dog's name, favorite snacks) via a parent-zone editor with auto-pinyin; browser
voice covers custom words. THE retention feature + THE paid differentiator.
Sequencing: after parent progress reports. **Pricing fork to decide at build time:**
included in the $9.99 one-time unlock vs. a small separate subscription (custom packs
are an ongoing service, so a sub is defensible despite the no-subscription rule for
content). Jenny's go-to-market focus: SEO.

## Corrections to CLAUDE.md discovered during design
- API routes run on the **Node runtime** (`pg` driver), not edge as CLAUDE.md states.
- Parent dashboard reads legacy localStorage, not the DB — effectively broken for current usage.
