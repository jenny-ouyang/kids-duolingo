#!/usr/bin/env python3
"""Fail if any vocabulary word would render with no visual at all.

A word has a visual if any of these hold:
  1. an illustration exists (id in lib/word-images.json)
  2. its data `image` field holds an emoji (non-path value)
  3. its id or english name is in PictureChoice's EMOJI_FALLBACKS map

Run after adding content packs (and before an iOS build):
    python3 scripts/audit-visuals.py
"""
import json, glob, re, sys, os

os.chdir(os.path.join(os.path.dirname(__file__), ".."))
illustrated = set(json.load(open("lib/word-images.json")))
src = open("components/exercise/PictureChoice.tsx").read()
m = re.search(r"EMOJI_FALLBACKS[^{]*\{(.*?)\n\}", src, re.S)
fallbacks = dict(re.findall(r"['\"]?([\w-]+)['\"]?:\s*'([^']+)'", m.group(1))) if m else {}

def has_visual(w):
    if w["id"] in illustrated:
        return True
    img = w.get("image") or ""
    if img and not img.startswith("/") and not img.endswith((".jpg", ".png", ".webp")):
        return True
    return w["id"] in fallbacks or w["english"].lower() in fallbacks

missing, total = [], 0
for f in sorted(glob.glob("data/packs/*.json")):
    d = json.load(open(f))
    for w in d.get("words", []):
        total += 1
        if not has_visual(w):
            missing.append((d["id"], w["id"], w["english"]))

if missing:
    print(f"FAIL — {len(missing)} of {total} words have NO visual:")
    for pack, wid, en in missing:
        print(f"  {pack:16} {wid:20} {en}")
    sys.exit(1)
print(f"OK — all {total} words have an illustration or emoji.")
