# Pre-Generated Audio Pipeline (Spec)

**Date:** 2026-08-17
**Status:** Proposed — not implemented. No code changes yet.
**Goal:** Replace the browser Web Speech API as the primary Chinese audio path with pre-generated mp3 clips: consistent, high-quality Mandarin on every device, offline-capable for a future Capacitor iOS build. Web Speech stays as the fallback.

## Why

- Web Speech (`lib/tts.ts`, `utterance.lang = 'zh-CN'`) is free but device-dependent: voice quality varies wildly (Tingting on macOS vs. whatever Android ships), and iOS Safari blocks speech not started inside a user gesture — the source of the June silence bugs (`docs/2026-06-20-no-sound-total-silence.md`).
- A paid public launch needs audio that sounds the same for every customer.
- Pre-generated files bundled in the app work with `next export` / Capacitor for offline iOS later. Web Speech does not exist reliably in a WebView.

## 1. Audio Inventory (counted 2026-08-17, from `data/`)

Every string the app ever passes to `speakChinese()` comes from four closed sets. Callers audited: `PictureChoice.tsx` (word audio: autoplay, speaker button, after-answer), `SentenceBuild.tsx` (each tapped tile + the full sentence — tiles are a shuffled copy of the sentence's own tokens, no external distractors, per `app/api/sentences/[packId]/route.ts`), `app/celebrate/page.tsx` (encouragement phrase from `lib/encouragement.ts`).

| Set | Source | Count |
|---|---|---|
| Vocabulary words | `data/packs/*.json` (13 packs with words; `sentences.json` has none) — 173 entries, 1 cross-pack duplicate | **172 unique** |
| Full sentences | `data/sentences/*.json` (5 files, joined `chinese` arrays) | **19 unique** |
| Sentence tiles not already vocab words | 36 unique tiles total; 19 overlap vocab; extras: 猫 喝 水 唱 歌 狗 吃 鱼 可爱 爱 高 漂亮 累 饿 想 坐 在 | **17 unique** |
| Celebration phrases | `lib/encouragement.ts` (你真棒, 太厉害了, 加油, …) | **15 unique** |
| **Total clips** | | **223** |

Total Chinese characters across all 223 clips: **463** (415 from words/sentences/tiles + 48 encouragement).

Estimated audio: ~1–2 s per clip → ~5–6 minutes total. At mp3 48 kbps mono, ~10–20 KB per clip → **~3–4 MB for the entire library**. Trivially bundleable.

## 2. TTS Provider Comparison (Mandarin, child-friendly)

Pricing verified via web search 2026-08 (see Sources at bottom).

| Provider | Best zh-CN option | Price | Cost for 463 chars | Notes |
|---|---|---|---|---|
| **Azure AI Speech** | `zh-CN-XiaoxiaoNeural` (styles incl. *child*, *cheerful*, *affectionate*), also `zh-CN-XiaoyiNeural`, and a real child voice `zh-CN-XiaoshuangNeural` | $16/1M chars (Neural HD $22/1M); free tier 500K chars/month | 463 × $16/1M = **$0.0074 → $0.00 within free tier** | Widely considered the strongest zh-CN neural voices; SSML `<mstts:express-as style="child">` control; already listed in our own preferred-voice list in `lib/tts.ts` |
| **Google Cloud TTS** | Chirp 3: HD zh-CN voices; Neural2 `cmn-CN-*` | Chirp 3 HD $30/1M, Neural2 $16/1M; free tier 1M chars/month each | 463 × $30/1M = **$0.014 → $0.00 within free tier** | Chirp 3 HD is very natural; less style control than Azure SSML |
| **OpenAI TTS** | `gpt-4o-mini-tts` with an instructions prompt ("warm, slow, cheerful, for a young child") | ~$0.015/min of audio (token-billed); legacy `tts-1-hd` $30/1M chars | ~6 min × $0.015 = **~$0.09** | Voices are English-first; Mandarin tone accuracy is weaker than Azure/Google — risky for a language-learning app |
| **ElevenLabs** | Multilingual v2, zh support | Subscription: Free 10K credits/mo (~1 credit/char), Starter $6/mo (commercial license) | 463 credits → **$0 on free tier, but commercial use needs Starter ($6/mo)** | Best expressiveness, but subscription model is overkill for a 463-character one-time job; native-Mandarin naturalness varies by voice |

**The math, plainly:** this is a one-time generation of 463 characters. Every per-character provider prices in millions of characters, so the whole library costs **under 2 cents at list price, and $0.00 inside Azure's or Google's monthly free tier**. Cost is a non-factor; voice quality and Mandarin nativeness are the whole decision.

> **DECISION POINT 1 — Provider + voice (Jenny picks by ear).**
> Proposal: generate the same 4-clip sample set (猫, 你好, 你真棒, 猫喝水) from the top two candidates and listen:
> 1. **Azure `zh-CN-XiaoxiaoNeural`** with `style="cheerful"` (and try `zh-CN-XiaoshuangNeural`, the child voice)
> 2. **Google Chirp 3: HD** zh-CN female voice
>
> Recommendation going in: **Azure Xiaoxiao** — native zh-CN voice family, per-clip style control, free at our volume, and the app's own voice-preference list already ranks Xiaoxiao first among online voices. But the ear test decides.

> **DECISION POINT 2 — Commit clips to git vs. regenerate at build.**
> Recommendation: **commit the mp3s** (~3–4 MB, well under repo pain thresholds). Deterministic, no API key in CI, `next build` and a future Capacitor build need no network. Regeneration is a manual dev-time step.

## 3. Storage & Delivery

| Option | Verdict |
|---|---|
| **`/public/audio/zh/` (bundled)** | **Recommended.** Served by Vercel CDN automatically; survives `output: 'export'` for the Capacitor path, so clips ship inside the iOS app for offline use; zero extra infra; 3–4 MB is nothing. Note: `public/` does not exist yet (word `image` paths like `/images/actions/eat.png` are currently dead — the app falls back to `EMOJI_FALLBACKS`); this creates it. |
| Supabase Storage | Adds a network dependency to the one project that already got PAUSED once (July keepalive saga); breaks offline; no benefit at this size. No. |
| Vercel Blob | Fine for large/mutable assets; ours are tiny and immutable; breaks the Capacitor offline story. No. |

## 4. Generation Pipeline — `scripts/generate-audio.ts`

New directory `scripts/` (today generation scripts live in `prisma/`; audio is not a DB concern, so it gets its own home).

**Naming: content hash, not pinyin.** Pinyin filenames collide on homophones and choke on phrases. Filename = `sha1(exact Chinese string).slice(0, 12) + '.mp3'`. The script also emits a manifest so the runtime never hashes:

```
public/audio/zh/9f2b41c07a3e.mp3        # one per unique string
public/audio/zh/manifest.json           # { "猫": "9f2b41c07a3e.mp3", "你真棒": "...", ... }
```

**Algorithm:**
1. Collect unique strings from the four sets in §1:
   - `data/packs/*.json` → every `words[].chinese`
   - `data/sentences/*.json` → every tile in `sentences[].chinese` AND the joined full sentence
   - Encouragement phrases — extract the `phrase` list from `lib/encouragement.ts` into `data/encouragement.json` (single source of truth; `encouragement.ts` imports it) so the script reads only `data/`
2. For each string: compute filename; **skip if the file already exists** (idempotent — reruns only generate new/missing clips)
3. Call the chosen TTS API (voice + style pinned as constants at the top of the script), write the mp3 (mono, 24 kHz, ~48 kbps)
4. Rewrite `manifest.json` from the full collected set every run
5. Print a summary: generated N, skipped M, orphans K (files on disk no longer referenced — warn, don't delete)

**npm script:** `"audio:generate": "ts-node --skip-project ... scripts/generate-audio.ts"`. API key via env var (e.g. `AZURE_SPEECH_KEY`), never committed.

**How new vocab gets audio:** add the word to its `data/packs/*.json` file → run `npm run audio:generate` (only the new clips are synthesized, costing fractions of a cent) → commit json + mp3s + manifest together. Same flow as the existing `db:seed` habit. Optional later: a lint-style check that every string in `data/` has a manifest entry, so a missing clip fails CI instead of failing on a kid's iPad.

## 5. Runtime Changes — do not regress the June hardening

The June work (`e94231d`, documented in `docs/2026-06-20-no-sound-total-silence.md`) established three invariants that MUST survive:

1. **One shared `AudioContext`**, never per-sound (~6/tab cap → silence), resumed on every use (`lib/sounds.ts` `getCtx()`)
2. **First-gesture unlock**: `VoicePreloader` calls `unlockAudio()` + `primeSpeech()` on the first `pointerdown`/`touchstart`/`keydown`
3. **iOS timer-fired speech works only because of the silent-utterance prime** — several call sites fire from `setTimeout` (after-answer in `PictureChoice`, sentence readback in `SentenceBuild`, celebrate mount)

**Design: play clips through the existing shared AudioContext, not `<audio>` elements.** `HTMLAudioElement.play()` has its own per-element autoplay gating and would re-open the exact class of iOS bugs the June work closed. `AudioBufferSourceNode` on an already-unlocked context plays fine from timers and from mount — the same property `playCelebrationSound()` relies on today.

Changes, all inside `lib/` (call sites keep calling `speakChinese(text)` unchanged):

- **`lib/sounds.ts`**: export the shared context (e.g. `getAudioContext()`), one added line. Everything else untouched.
- **`lib/tts.ts`** (or a new `lib/audio-clips.ts` that `tts.ts` delegates to):
  - Load `manifest.json` once (static import — it's build-time data)
  - `speakChinese(text)`: manifest hit → fetch `/audio/zh/<file>`, `decodeAudioData`, cache the `AudioBuffer` in a `Map`, play via `AudioBufferSourceNode` on the shared context. Manifest miss, fetch failure, or decode failure → **existing Web Speech path, unchanged** (voice selection, rate 0.85, pitch 1.15, `primeSpeech`, all preserved)
  - `stopSpeech()`: also stop the currently playing source node (track it; PictureChoice relies on cancel-before-speak semantics via `speechSynthesis.cancel()` today — mirror that: starting a new clip stops the previous one)
  - **Preload per session**: when a practice page receives its 8 questions, warm the cache (fetch + decode the ≤ ~20 clips involved). Decoded buffers for the whole library would be ~30 MB of PCM, so cache decoded buffers with a simple cap (e.g. 50 entries) and keep raw fetches to the browser HTTP cache
- **`VoicePreloader.tsx`**: unchanged. `preloadVoices()` + `primeSpeech()` stay — they now serve the fallback path. Optionally also prefetch `manifest.json` on mount.
- **Capacitor later**: same relative `/audio/zh/...` URLs resolve inside the static export; no code change needed.

**What Web Speech remains for:** any string not in the manifest (safety net for a data/audio drift bug) and as a total fallback if clip playback throws. It is no longer the primary path anywhere.

## 6. Ordered Task List

| # | Task | Effort |
|---|---|---|
| 1 | **DECISION 1 sample bake-off**: tiny script or curl to generate 猫 / 你好 / 你真棒 / 猫喝水 from Azure Xiaoxiao (+Xiaoshuang child voice) and Google Chirp 3 HD; Jenny listens and picks | ~1 h |
| 2 | Extract encouragement phrases to `data/encouragement.json`; `lib/encouragement.ts` imports it (behavior unchanged) | ~0.5 h |
| 3 | Build `scripts/generate-audio.ts` (collect → hash → skip-existing → synth → manifest) + `audio:generate` npm script + env var for the key | ~2–3 h |
| 4 | Run full generation (223 clips, < $0.02), listen to a sample spot-check, commit `public/audio/zh/` + manifest (**DECISION 2** confirmed here) | ~0.5 h |
| 5 | Runtime: export shared context from `lib/sounds.ts`; clip playback + buffer cache + fallback in `lib/tts.ts`; session preload hook in the two practice pages | ~2–3 h |
| 6 | Device verification pass (the June doc's method: AnalyserNode probe + trusted gestures) on desktop Chrome AND a real iPhone/iPad Safari — confirm dings, clip audio, sentence readback, celebrate-on-mount all play; confirm fallback fires when a clip is renamed away | ~1–2 h |
| 7 | Add a manifest-completeness check to `npm run lint` or a tiny `audio:check` script; update `CLAUDE.md` (commands + "new vocab needs `audio:generate`") | ~0.5 h |

**Total: roughly one focused day** (~8–10 h), of which the only irreversible choice is the voice — and that costs cents to redo entirely if Jenny changes her mind later (delete `public/audio/zh/`, rerun with a new voice constant).

## Sources (pricing, checked 2026-08)

- Google: [Google Cloud TTS pricing 2026 (TextToLab)](https://texttolab.com/blog/google-cloud-tts-pricing), [diyai.io pricing guide](https://diyai.io/ai-tools/audio-generation/google-cloud-text-to-speech-pricing/) — Neural2 $16/1M, Chirp 3 HD $30/1M, free tier 1M chars/mo on both
- Azure: [Azure TTS pricing (TextToLab)](https://texttolab.com/blog/azure-text-to-speech-pricing) — Neural $16/1M (HD $22/1M), free 500K chars/mo
- OpenAI: [OpenAI TTS pricing 2026 (TextToLab)](https://texttolab.com/blog/openai-tts-pricing), [costgoat calculator](https://costgoat.com/pricing/openai-tts) — gpt-4o-mini-tts ~$0.015/min, tts-1-hd $30/1M chars
- ElevenLabs: [ElevenLabs pricing 2026 (BIGVU)](https://bigvu.tv/blog/elevenlabs-pricing-2026-plans-credits-commercial-rights-api-costs/) — Free 10K credits/mo, Starter $6/mo for commercial use
