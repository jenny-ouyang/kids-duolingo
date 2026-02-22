# Kids Chinese Learning App — Project Plan

## What We're Building

A Chinese (Mandarin) learning app for a 5-year-old. Audio-first, picture-based exercises with no punishment for wrong answers. Parent controls the vocabulary content; a local LLM (Qwen) generates exercises on the fly. No hearts, no locked paths, no pressure.

---

## Core Design Principles

- **Audio-first**: Every word is spoken aloud in Mandarin with correct tones
- **Picture-based**: No reading required for the child — everything is images + sound
- **No punishment**: Wrong answers show the correct answer with encouragement, then move on
- **Parent-controlled content**: Parent decides which vocabulary packs exist and what's in them
- **Short sessions**: 8–10 questions max per session, then a big celebration screen
- **Flexible practice**: Child can practice any unlocked pack, not a forced linear path

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | Already familiar, clean routing |
| Styling | Tailwind CSS | Fast iteration on kid-friendly UI |
| Animations | Framer Motion | Celebration effects, transitions |
| Audio/TTS | Google Cloud TTS or Azure Neural TTS | High-quality Mandarin with tones |
| Exercise generation | `qwen2.5:7b` via Ollama at `localhost:11434` | Free, offline, excellent Chinese — made by Alibaba |
| Data storage | JSON files + localStorage | Simple v1, no backend needed |
| Language | TypeScript | Consistency with existing projects |

---

## App Structure

```
kids-duolingo/
├── app/
│   ├── page.tsx                  # Home screen (kid's entry point)
│   ├── packs/
│   │   └── page.tsx              # Pack selection screen
│   ├── practice/
│   │   └── [packId]/
│   │       └── page.tsx          # Active practice session
│   ├── celebrate/
│   │   └── page.tsx              # End-of-session celebration
│   └── parent/
│       ├── page.tsx              # Parent dashboard
│       └── packs/
│           └── page.tsx          # Manage vocabulary packs
│
├── components/
│   ├── ui/                       # Shared UI primitives
│   ├── exercise/
│   │   ├── PictureChoice.tsx     # Main exercise: tap the right picture
│   │   ├── ListenAndChoose.tsx   # Hear a word, pick the picture
│   │   └── ExerciseShell.tsx     # Progress bar, question counter
│   ├── celebration/
│   │   ├── Confetti.tsx          # Celebration animation
│   │   └── StarBurst.tsx         # Per-correct-answer feedback
│   └── layout/
│       ├── KidLayout.tsx         # Big buttons, bright colors
│       └── ParentLayout.tsx      # Clean admin layout
│
├── lib/
│   ├── spaced-repetition.ts      # SM-2 algorithm
│   ├── exercise-generator.ts     # Calls local LLM to generate exercises
│   ├── tts.ts                    # Text-to-speech (Google/Azure)
│   ├── audio.ts                  # Audio playback management
│   └── progress.ts               # Read/write progress to localStorage
│
├── data/
│   └── packs/
│       ├── animals.json          # Vocabulary pack: animals
│       ├── colors.json           # Vocabulary pack: colors
│       ├── numbers.json          # Vocabulary pack: numbers 1–10
│       ├── food.json             # Vocabulary pack: food
│       ├── family.json           # Vocabulary pack: family members
│       └── greetings.json        # Vocabulary pack: basic greetings
│
├── public/
│   ├── images/
│   │   └── [category]/           # Pictures for each vocabulary item
│   └── audio/                    # Optional: pre-recorded MP3s
│
└── PLAN.md                       # This file
```

---

## Vocabulary Pack Format

Each pack is a JSON file in `data/packs/`. Structure:

```json
{
  "id": "animals",
  "name": "Animals",
  "nameZh": "动物",
  "emoji": "🐾",
  "color": "#FFB347",
  "words": [
    {
      "id": "cat",
      "english": "cat",
      "chinese": "猫",
      "pinyin": "māo",
      "tone": 1,
      "image": "/images/animals/cat.png",
      "audio": "/audio/animals/cat.mp3"
    },
    {
      "id": "dog",
      "english": "dog",
      "chinese": "狗",
      "pinyin": "gǒu",
      "tone": 3,
      "image": "/images/animals/dog.png",
      "audio": "/audio/animals/dog.mp3"
    }
  ]
}
```

---

## Progress Data Format (localStorage)

```json
{
  "childName": "Leo",
  "packs": {
    "animals": {
      "unlocked": true,
      "words": {
        "cat": {
          "easiness": 2.5,
          "interval": 1,
          "repetitions": 3,
          "nextReview": "2026-02-22T00:00:00Z",
          "lastSeen": "2026-02-21T00:00:00Z"
        }
      }
    }
  }
}
```

---

## SM-2 Spaced Repetition (Simplified)

Each word has an easiness factor. After each answer:
- Correct (confident): interval increases, next review pushed further out
- Correct (hesitant): interval increases slightly
- Wrong: interval resets to 1 day, review scheduled for tomorrow

The practice session picks words that are due for review today, plus a few new words if the child is ready.

---

## Exercise Generation via Local LLM

The app calls Qwen (via Ollama at `localhost:11434`) to:
1. Generate 3 plausible wrong-answer options for a given word
2. Suggest age-appropriate example phrases using known vocabulary
3. Generate new vocabulary suggestions within a theme

Example prompt:
```
You are helping a 5-year-old learn Mandarin Chinese.
The child is learning the word: 猫 (māo) = cat.
Give me 3 other animal words in Chinese (characters + pinyin + English) 
that would make plausible wrong-answer options for a picture quiz.
Respond as JSON only.
```

---

## TTS Strategy

Primary: **Google Cloud TTS** or **Azure Neural TTS**
- Use `zh-CN-XiaoxiaoNeural` (Azure) or `cmn-CN-Wavenet-A` (Google)
- Called at build time or on-demand to generate MP3s per word
- Cache audio files locally once generated

Fallback: **Web Speech API**
```javascript
const utterance = new SpeechSynthesisUtterance(chineseText)
utterance.lang = 'zh-CN'
speechSynthesis.speak(utterance)
```

---

## Key Screens

### 1. Home Screen
- Child's name and avatar
- Colorful "Play!" button
- Simple streak/star count (positive only, never shows losses)

### 2. Pack Selection
- Grid of colorful cards, one per vocabulary theme
- Each card shows emoji, theme name, and a ring showing mastery %
- Locked packs shown dimmed (parent unlocks them)

### 3. Practice Session
- Progress bar at top (question 3 of 8)
- Central question area: "Which one is 猫?" with audio button
- 4 large picture cards to tap
- Correct: star burst animation + cheerful sound + brief Chinese word display
- Wrong: gentle "try again" animation, correct answer highlighted, audio replays

### 4. Celebration Screen
- Confetti + stars animation
- "You learned X words today!"
- Option to play again or go back to packs

### 5. Parent Dashboard
- See progress per pack
- Add/edit vocabulary packs
- Unlock new packs
- View which words need more practice

---

## GitHub References to Study

- **zakkariyaa/Lingle** — kids language app UI patterns
- **LibreLingo/LibreLingo** — exercise structure and spaced repetition logic
- **buger/homeschoolai** — AI-powered adaptive learning with spaced repetition
- **m98/fluent** — SM-2 + Claude-powered exercise generation (MIT licensed)

---

## Hosting Options

### Option A — Local + iPad on same WiFi (Easiest, free)
Run `npm run dev` on the laptop. Any device on the same home WiFi can access it at `http://[laptop-ip]:3000`. Julian uses it on an iPad or tablet. Ollama works because it's all on the local network. Zero cost, zero complexity. Downside: laptop must be on and running.

### Option B — Vercel deploy + cloud LLM API (Accessible anywhere)
Deploy the Next.js app to Vercel (free tier). Replace Ollama calls with a cloud LLM API (OpenAI, Anthropic, or Groq — Groq is free and very fast). Progress stays in localStorage on the device used. Works from any device, anywhere. Medium effort to set up.

### Option C — Self-host on a small home server / Raspberry Pi
Run both Next.js and Ollama on a dedicated home machine. Accessible from anywhere on home network, or exposed via Tailscale for remote access. More setup but keeps everything local and private.

**Recommendation:** Start with Option A during development. It's instant and lets you test with Julian immediately. Once it's working well, decide if you want Option B for tablet use outside the house.

---

## Build Order (Phases)

### Phase 1 — Core Loop (Week 1)
- [ ] Scaffold Next.js project with Tailwind + Framer Motion
- [ ] Create vocabulary pack JSON files (animals, colors, numbers)
- [ ] Build PictureChoice exercise component
- [ ] Wire up Web Speech API for audio (free, immediate)
- [ ] Build practice session flow (start → questions → celebrate)
- [ ] Store progress in localStorage

### Phase 2 — Polish (Week 2)
- [ ] Add celebration animations
- [ ] Build pack selection screen with mastery rings
- [ ] Implement SM-2 spaced repetition properly
- [ ] Add proper image assets for all vocabulary

### Phase 3 — Intelligence (Week 3)
- [ ] Connect Qwen via Ollama for wrong-answer generation
- [ ] Upgrade TTS to Google Cloud or Azure Neural
- [ ] Build parent dashboard
- [ ] Let parent add custom vocabulary words

---

## Open Questions

1. ~~What is the child's name?~~ → **Julian** ✓
2. Are there specific vocabulary topics that are highest priority?
3. ~~Is Ollama already set up and running locally?~~ → **Yes, running** ✓ (default port 11434)
4. Hosting: see Hosting Options section below
