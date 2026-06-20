# Fix Session: No sound — total silence on Mac Chrome

**Date:** 2026-06-20
**Status:** 🔧 Code hardened + verified · user's silence cause = environment (pending user confirmation by ear)
**Scope:** Audio subsystem only — `lib/sounds.ts`, `lib/tts.ts`, exercise components' audio calls, and a gesture-unlock hook. No DB/layout/unrelated changes.

## Inputs
- **Symptom:** Total silence on Mac Chrome. None of the three sound paths produce audio: (1) 🔊 speaker button → Chinese pronunciation (Web Speech, `lib/tts.ts`), (2) correct/wrong "ding" on answer (Web Audio, `lib/sounds.ts`), (3) celebration music at end (`lib/sounds.ts` + speech).
- **Done when:** All three paths emit a real audio signal — verified programmatically (AudioContext `.state==='running'`, AnalyserNode shows non-zero output, `speechSynthesis` utterance fires `onstart`/`onend` with a zh-CN voice present) — and the fix is robust on desktop Chrome AND iPad/Safari.
- **Pages:** `/practice/[packId]` (PictureChoice), `/practice/sentences` (SentenceBuild), `/math/practice/[topicId]` (CountAndChoose), `/celebrate`.

## Past patterns checked
None found — `docs/` had no prior bug session files.

## Investigation

### Key insight carried in (from prior session + advisor)
Total silence on **desktop Chrome** does NOT match the two code bugs spotted below. On Chrome those bugs would only kill the celebration screen; the speaker button (Web Speech) and the answer dings (Web Audio) are independent subsystems and should both work. So there is likely a THIRD cause muting everything: system/tab mute, missing zh-CN voice, a JS error halting handlers, a stale/failed Vercel deploy, or the exercise not rendering (no questions → no dings, user never taps speaker). Must reproduce, not assume.

### Two code bugs already identified (fix regardless)
1. **`lib/sounds.ts` — `AudioContext` per call, never resumed.** `getCtx()` does `new AudioContext()` on every sound. Browsers cap ~6 contexts/tab (then `new AudioContext()` throws → silence) and start them *suspended* until a user gesture. Celebration sounds fire from a mount `useEffect` (`app/celebrate/page.tsx`) with no gesture → suspended → silent.
2. **TTS fired from `setTimeout`.** `speakChinese` called inside timers in `PictureChoice.tsx` (auto-play + after-answer), `SentenceBuild.tsx`, `celebrate/page.tsx`. iOS Safari blocks speech not fired synchronously inside a user gesture.

### Reproduction (local dev on the user's Mac, instrumented Chromium)
Ran `npm run dev`, loaded `/practice/animals` in a CDP-driven Chromium (trusted clicks). Installed a probe that wraps `AudioContext` (taps each with an AnalyserNode) and `speechSynthesis.speak` (records start/end/error), then performed a REAL click on a correct answer.

**Results — the app audio code WORKS on this machine:**
- Data layer healthy: 14 packs, questions return 8 items with content (DB resume OK). Exercise renders fully. → "no exercise / no questions" ruled out.
- Voices: 180 total, 18 Chinese, including **Tingting / zh-CN** (the app's #1 preferred voice). → "missing zh-CN voice" ruled out.
- Web Audio on a real tap: 1 AudioContext, `createdState: running`, `lastState: running`, **Analyser peak 229/255** (strong signal). → dings produce real output.
- TTS on a real tap: spoke "金鱼", lang zh-CN, voice **Tingting**, events **start → end**. → pronunciation works.

### One-line diagnosis
The app's audio code is functional on desktop Chrome (empirically verified). The user's TOTAL silence on desktop is therefore **environmental** (system volume / output device / muted Chrome tab), not the app code. Separately, two genuine robustness bugs WILL cause silence on iPad/Safari, on long sessions (>6 sounds), and on a hard-loaded celebration screen — fixing those for good.

### Why the two bugs don't explain desktop total-silence (but still matter)
On desktop Chrome, sounds are triggered by taps (answer / speaker button) → AudioContext created inside the gesture starts `running`, and speech from a short timer works once the page has activation. So desktop plays. The bugs bite where there's NO gesture (mount-fired celebration) or on iOS (timer-fired speech) or after the ~6-context cap (long sessions).

## Fix attempts

### Attempt 1 — Singleton AudioContext + first-gesture unlock + iOS speech priming
**Files changed:** `lib/sounds.ts`, `lib/tts.ts`, `components/layout/VoicePreloader.tsx`
**Root cause addressed:**
1. Per-call `new AudioContext()` that never resumed and hits the ~6/tab cap → now ONE shared context, resumed on every use (`lib/sounds.ts`).
2. Audio + speech blocked until a user gesture → `VoicePreloader` now primes both (`unlockAudio()` + `primeSpeech()`) on the first `pointerdown`/`touchstart`/`keydown` anywhere in the app.
3. iOS Safari blocks timer-fired speech → `primeSpeech()` speaks one silent utterance during the first gesture to unlock the engine, so later `setTimeout`-fired pronunciation works.

**These harden audio for iPad/Safari, long sessions, and the mount-fired celebration screen. They do NOT explain the user's desktop total-silence** — the code already produced sound on desktop (see Verification).

## Verification

### Pass 1 — instrumented Chromium on the user's Mac (post-fix)
Method: wrapped `AudioContext` with an AnalyserNode (peak 0–255) + `speechSynthesis` start/end/error events; clicks via CDP = trusted gestures.

- audio_to_picture (animals), clicked correct answer → AudioContext **running**, Analyser **peak 232**; spoke "金鱼" via **Tingting** (start→end); first-gesture unlock fired (silent `" "` utterance, start→end). ✅
- Second answer/ding → **contextCount stayed 1** (singleton holds; old code would spawn a 2nd), peak 233, running; 3 speech events total, all start→end. ✅

Conclusion: audio engine works and is now robust (one context, resumed, primed). Any remaining desktop silence is environmental.

## Resolution
**Status:** 🔧 Code hardened + verified. The audio code is proven to produce a real signal on-device; the user's desktop silence is environmental. NOT marked fully resolved — the exit condition is the USER confirming by ear that they now hear sound (an AnalyserNode measures signal generated, not audibility past the OS output). Also: the fix is committed but NOT deployed, so if the user is on the Vercel URL it hasn't reached them yet.
**Fix:** One shared `AudioContext` (resumed on use), primed together with speech on the first user gesture (`VoicePreloader`), iOS speech unlocked via a silent utterance (`primeSpeech`).
**Root cause (two parts):**
- (a) Real robustness bugs in the audio code (per-call AudioContext; timer-fired speech) — fixed. These caused silence on iPad/Safari, long sessions (>6 sounds), and the mount-fired celebration screen.
- (b) The reported TOTAL silence on **desktop Chrome** is NOT the code. Instrumentation on the same Mac showed the app produces a real audio signal (peak 232) and speaks via Tingting (start→end). That points to an environment cause: macOS volume / output device, or a muted Chrome tab.

**Attempts:** 1 · **Verification:** programmatic (AnalyserNode + speech events), singleton confirmed across 2 sounds.

### Patterns for future AI
- **"Total silence on desktop Chrome" rarely matches Web-Audio + Web-Speech code bugs** — they are independent subsystems and both play on desktop via gestures. Total silence ⇒ suspect ENVIRONMENT (system volume, output device, per-tab mute) or a stale build BEFORE touching code.
- **Measure audio, don't guess.** Wrap `AudioContext` with an AnalyserNode (peak) and listen for `speechSynthesis` start/end/error. Trigger via a TRUSTED gesture (CDP click) — `eval` alone is not a user gesture, so audio looks blocked even when it's fine.
- **`lib/sounds.ts`:** never `new AudioContext()` per sound (~6/tab cap → silence; starts suspended). One shared context, `resume()` on use, unlock on first gesture.
- **iOS speech:** `speechSynthesis` is blocked unless started in a gesture; prime once with a silent utterance on the first gesture (`lib/tts.ts` `primeSpeech`).
- Voice "Tingting" (zh-CN) IS present on this Mac (180 voices, 18 zh). Missing-voice was ruled out.
