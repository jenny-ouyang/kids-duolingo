#!/bin/bash
# Mandarineer illustration pipeline — concrete-noun packs, Sunrise Playground style.
# Usage: ./scripts/generate-images.sh [packId ...]   (default: all concrete packs)
# Output: raw renders in .image-work/, final 512x512 JPEGs in public/images/words/<id>.jpg
# Idempotent: skips words whose final JPEG already exists.
set -uo pipefail
cd "$(dirname "$0")/.."

PACKS=${@:-"animals toys my-room clothes fruits vegetables snacks-drinks food home nature farm-animals wild-animals little-creatures weather vehicles places shopping school-things sports tools jobs"}
STYLE="STYLE (must be followed exactly): flat vector illustration, chunky rounded shapes, thick soft forms, no outlines, warm and friendly, big gentle eyes, small smile, simple two-tone shading. EXACTLY ONE single character/object — never two, never a pair, never a group. Centered in the middle of the frame with generous empty margins on both sides, full body, no background scene — plain pure white background (#FFFFFF), no text, no letters, no border. Palette accents: coral #F4576B, gold #FFCF57, teal #1FA88C, warm brown #6B4423. Toy-like, cute, suitable for ages 4-8."

mkdir -p .image-work public/images/words

python3 - "$PACKS" <<'EOF' > .image-work/queue.txt
import json, sys
packs = sys.argv[1].split()
skip_ids = {'hungry-meal','full-meal','yummy','buy','sell','expensive','cheap','warm'}  # feelings keep emoji
for p in packs:
    d = json.load(open(f'data/packs/{p}.json'))
    for w in d['words']:
        if w['id'] in skip_ids: continue
        print(f"{w['id']}\t{w['english']}\t{d['name']}")
EOF

total=$(wc -l < .image-work/queue.txt | tr -d ' ')
done_n=0
while IFS=$'\t' read -r id english pack; do
  done_n=$((done_n+1))
  final="public/images/words/${id}.jpg"
  [ -s "$final" ] && continue
  raw=".image-work/${id}.png"
  echo "[$done_n/$total] $id ($english)"
  mcporter call nanobanana.generate_image \
    prompt="Children's educational flashcard illustration of a cute ${english} (${pack} theme), for a kids' Chinese learning app. ${STYLE}" \
    aspect_ratio="1:1" \
    output_path="$PWD/$raw" >/dev/null 2>&1
  if [ ! -s "$raw" ]; then echo "  RENDER FAILED: $id" >> .image-work/failures.txt; continue; fi
  # center-crop to square, resize 512, save jpeg
  W=$(sips -g pixelWidth "$raw" | awk '/pixelWidth/{print $2}')
  H=$(sips -g pixelHeight "$raw" | awk '/pixelHeight/{print $2}')
  S=$(( W < H ? W : H ))
  sips -c "$S" "$S" "$raw" --out "$raw.crop.png" >/dev/null 2>&1
  sips -z 512 512 -s format jpeg -s formatOptions 82 "$raw.crop.png" --out "$final" >/dev/null 2>&1
  rm -f "$raw.crop.png"
  [ -s "$final" ] || echo "  POSTPROCESS FAILED: $id" >> .image-work/failures.txt
done < .image-work/queue.txt

echo "--- run complete ---"
ls public/images/words/*.jpg 2>/dev/null | wc -l | xargs echo "final images:"
[ -f .image-work/failures.txt ] && { echo "failures:"; cat .image-work/failures.txt; } || echo "no failures"

# Rebuild the word-image manifest the app imports
python3 - <<'PYEOF'
import json, os
ids = sorted(f[:-4] for f in os.listdir('public/images/words') if f.endswith('.jpg'))
json.dump(ids, open('lib/word-images.json','w'), indent=0)
print(f"manifest: {len(ids)} illustrated words -> lib/word-images.json")
PYEOF
