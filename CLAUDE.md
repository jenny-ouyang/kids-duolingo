# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A kid-friendly Chinese + Math learning app (Duolingo-style) built with Next.js 14, Prisma, and Supabase. Core philosophy: **no punishment**—wrong answers show the correct answer and encourage retries. Sessions are 8 questions, end with a celebration screen.

## Commands

```bash
npm run dev              # Start dev server (localhost:3000)
npm run build            # Production build
npm run lint             # ESLint

# Database
npm run db:migrate               # Create and apply Prisma migrations
npm run db:generate              # Generate Prisma client types
npm run db:seed                  # Seed Chinese vocabulary packs
npm run db:seed-math             # Seed math problems (addition 1–100)
npm run db:generate-questions    # Pre-generate exercise questions into DB
```

No test suite exists. TypeScript + `npm run lint` are the primary quality checks.

## Architecture

### Session Flow

```
Home → Subject (Chinese/Math) → Pack/Topic selection → 8-question practice → Celebration
```

Practice sessions load **pre-generated questions** from the DB (no AI calls at runtime). SM-2 spaced repetition picks which words/problems are due. Progress updates are fire-and-forget (never block the UI).

### Key Directories

```
app/
├── page.tsx                          # Home: Chinese vs Math subject picker
├── packs/page.tsx                    # Chinese pack grid with mastery rings
├── practice/[packId]/page.tsx        # Chinese practice session
├── math/topics/page.tsx              # Math topic selection
├── math/practice/[topicId]/page.tsx  # Math practice session
└── celebrate/page.tsx                # End-of-session celebration screen

app/api/
├── packs/                  # List packs by subject
├── questions/[packId]/     # Load 8 questions + current word progress
├── math/questions/[topicId]/
├── progress/               # POST: save SM-2 updates
├── answers/                # POST: log answer events
└── profile/                # GET/POST: hearts & streak

components/
├── PictureChoice.tsx        # Main Chinese exercise (3 question types)
├── CountAndChoose.tsx       # Math exercise
├── ExerciseShell.tsx        # Progress bar wrapper
└── KidLayout.tsx            # Full-screen kid-friendly layout

lib/
├── db.ts                    # Prisma singleton with PrismaPg adapter (edge runtime)
├── spaced-repetition.ts     # SM-2 algorithm: updateSM2(), pickWordsForSession()
├── tts.ts                   # speakChinese() via Web Speech API (zh-CN)
├── encouragement.ts         # Varied praise with emoji, Chinese phrases, missions
├── sounds.ts                # Celebration/correct/wrong sound effects
└── types.ts                 # Shared TypeScript interfaces
```

### Database Models

- **Pack** – Vocabulary pack or math topic (subject, name, emoji, color, sortOrder)
- **Word** – Chinese vocab (english, chinese, pinyin, image, packId)
- **MathProblem** – Arithmetic fact (operand1, operator, operand2, answer, emoji)
- **GeneratedQuestion** – Pre-cached exercise questions with distractor options (JSON)
- **ChineseProgress / MathProgress** – SM-2 state per child × item (easeFactor, interval, nextReview)
- **AnswerEvent** – Full answer history for analytics
- **ChildProfile** – Hearts total, streak, lastPracticed

### Critical Patterns

**Prisma + Edge Runtime:** Uses `@prisma/adapter-pg` (PrismaPg) for compatibility with Next.js edge runtime. `lib/db.ts` exports a singleton client. Migrations use session-mode pooler; app runtime uses transaction-mode pooler.

**Question Types:** `PictureChoice.tsx` handles three exercise types:
- `audio_to_picture` – Hear Chinese → pick picture
- `picture_to_chinese` – See picture → pick Chinese character
- `english_to_chinese` – See English → pick Chinese character

**Emoji Fallbacks:** When no image is available, a hardcoded emoji map in `PictureChoice.tsx` provides 50+ vocabulary emoji fallbacks.

**Chinese TTS:** `lib/tts.ts` uses the Web Speech API (`utterance.lang = 'zh-CN'`). `VoicePreloader.tsx` warms up voices on mount to avoid first-utterance silence on iOS/Safari.

**SM-2 Algorithm:** `pickWordsForSession()` in `lib/spaced-repetition.ts` selects 8 items: prioritizes overdue items, then new items, then random. `updateSM2()` applies the SM-2 formula after each answer.

## Data

Chinese vocabulary packs live as JSON in `data/packs/` (13 packs: animals, colors, numbers, food, family, body, feelings, home, actions, nature, greetings, pronouns, words). `prisma/seed.ts` reads these and upserts into the DB.

Math problems are generated programmatically in `prisma/seed-math.ts` covering addition 1–100.

## Environment

Supabase project: `odwoxbxkvmjjqvjyynko` (this app's production DB).
Note: `.env` also references a different Supabase project (`fhdjzktrpcsjleargmrb`) used for an unrelated ai-memory-agent — don't confuse the two.

Deployed on Vercel (`.vercel/` config present).
