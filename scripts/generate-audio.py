#!/usr/bin/env python3
"""
Mandarineer audio pipeline — pre-generates every Chinese clip the app speaks.

Run:  uv run --with edge-tts scripts/generate-audio.py

Voices (bake-off winners, 2026-08-20):
  - zh-CN-XiaoyiNeural  (lively woman)  → all learning content: words, sentences, tiles
  - zh-CN-YunxiaNeural  (cute boy)      → celebration/praise phrases

Sources swept: data/packs/*.json (words + the sentences pack),
data/sentences/*.json (token tiles + joined sentences), praise phrases
(mirrors lib/encouragement.ts — update PRAISE below if that list changes).

Output: public/audio/zh/<sha1(voice|text)>.mp3 + lib/audio-manifest.json
Idempotent: existing files are skipped, stale manifest entries pruned.
NOTE: edge-tts uses Microsoft's free Edge endpoint — fine for development;
regenerate with a licensed Azure key (same voice names) before wide promotion.
"""
import asyncio, glob, hashlib, json, os, sys

VOICE_CONTENT = "zh-CN-XiaoyiNeural"
VOICE_PRAISE = "zh-CN-YunxiaNeural"
RATE = "-10%"  # slightly slower for young learners

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "audio", "zh")
MANIFEST = os.path.join(ROOT, "lib", "audio-manifest.json")

# Mirror of lib/encouragement.ts PRAISE list (Yunxia voice)
PRAISE = [
    "你真棒", "太厉害了", "好极了", "你做到了", "太酷了", "了不起", "真聪明",
    "棒极了", "越来越好", "加油", "好厉害", "继续加油", "没问题", "太好了", "你最棒",
]


def collect() -> dict[str, str]:
    """text → voice"""
    texts: dict[str, str] = {}

    for f in glob.glob(os.path.join(ROOT, "data", "packs", "*.json")):
        d = json.load(open(f, encoding="utf-8"))
        for w in d.get("words", []):
            texts[w["chinese"]] = VOICE_CONTENT
        for s in d.get("sentences", []):
            ch = s["chinese"]
            texts["".join(ch) if isinstance(ch, list) else ch] = VOICE_CONTENT

    for f in glob.glob(os.path.join(ROOT, "data", "sentences", "*.json")):
        d = json.load(open(f, encoding="utf-8"))
        for s in d.get("sentences", []):
            tokens = s["chinese"]
            texts["".join(tokens)] = VOICE_CONTENT  # full sentence
            for t in tokens:                          # each tap-tile
                texts[t] = VOICE_CONTENT

    for p in PRAISE:
        texts[p] = VOICE_PRAISE
    return texts


def fname(voice: str, text: str) -> str:
    return hashlib.sha1(f"{voice}|{text}".encode()).hexdigest()[:16] + ".mp3"


async def synth(sem, voice: str, text: str, path: str):
    import edge_tts
    async with sem:
        for attempt in range(3):
            try:
                await edge_tts.Communicate(text, voice, rate=RATE).save(path)
                if os.path.getsize(path) > 1000:
                    return True
            except Exception as e:
                if attempt == 2:
                    print(f"  FAILED {text!r}: {e}", file=sys.stderr)
                await asyncio.sleep(1 + attempt)
        if os.path.exists(path):
            os.remove(path)
        return False


async def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    texts = collect()
    manifest, jobs = {}, []
    sem = asyncio.Semaphore(6)

    for text, voice in texts.items():
        f = fname(voice, text)
        manifest[text] = f
        path = os.path.join(OUT_DIR, f)
        if not (os.path.exists(path) and os.path.getsize(path) > 1000):
            jobs.append(synth(sem, voice, text, path))

    print(f"{len(texts)} unique texts · {len(jobs)} to generate · {len(texts)-len(jobs)} cached")
    if jobs:
        results = await asyncio.gather(*jobs)
        print(f"generated {sum(bool(r) for r in results)}/{len(jobs)}")

    # Only keep manifest entries whose file actually exists
    manifest = {t: f for t, f in manifest.items()
                if os.path.exists(os.path.join(OUT_DIR, f))}
    json.dump(manifest, open(MANIFEST, "w", encoding="utf-8"),
              ensure_ascii=False, indent=0, sort_keys=True)
    print(f"manifest: {len(manifest)} entries → lib/audio-manifest.json")

    # Prune orphaned mp3s no longer referenced
    keep = set(manifest.values())
    removed = 0
    for f in os.listdir(OUT_DIR):
        if f.endswith(".mp3") and f not in keep:
            os.remove(os.path.join(OUT_DIR, f)); removed += 1
    if removed:
        print(f"pruned {removed} stale clips")


if __name__ == "__main__":
    asyncio.run(main())
