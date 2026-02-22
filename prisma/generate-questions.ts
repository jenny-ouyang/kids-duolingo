/**
 * One-time AI question generation script.
 *
 * For every word in every pack, calls Ollama (qwen2.5:7b) to generate
 * 3 plausible wrong-answer distractors for each question type, then stores
 * the results in the GeneratedQuestion table.
 *
 * Safe to re-run — clears existing questions for a pack before regenerating.
 *
 * Run with: npm run db:generate-questions
 */

import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../lib/generated/prisma'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any)

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'qwen2.5:7b'

const QUESTION_TYPES = ['audio_to_picture', 'audio_to_picture', 'picture_to_chinese', 'english_to_chinese'] as const
type QuestionType = typeof QUESTION_TYPES[number]

interface WordData {
  id: string
  english: string
  chinese: string
  pinyin: string
  image: string
}

async function getDistractorsFromOllama(
  targetWord: WordData,
  packWords: WordData[]
): Promise<WordData[] | null> {
  const otherWords = packWords.filter((w) => w.id !== targetWord.id)

  const prompt = `You are helping a 5-year-old child learn Mandarin Chinese.
The child is being tested on the word: "${targetWord.chinese}" (${targetWord.pinyin}) = "${targetWord.english}".

Pick exactly 3 different words from this list that would make good wrong-answer options for a picture quiz:
${otherWords.map((w) => `- ${w.chinese} (${w.pinyin}) = ${w.english} [id: ${w.id}]`).join('\n')}

Return a JSON object with an "options" key containing an array of exactly 3 objects.
Each object must have these fields: id, english, chinese, pinyin.
Use the exact id and chinese values from the list above.
Example format: {"options": [{"id": "...", "english": "...", "chinese": "...", "pinyin": "..."}, ...]}`

  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        format: 'json',
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) return null

    const data = await response.json() as { response?: string }
    const text: string = data.response ?? ''

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return null
    }

    // Unwrap {"options": [...]} or any object whose first array value is the list
    if (parsed && !Array.isArray(parsed) && typeof parsed === 'object') {
      const vals = Object.values(parsed as Record<string, unknown>)
      parsed = vals.find(Array.isArray) ?? parsed
    }

    if (!Array.isArray(parsed) || parsed.length < 3) return null

    // Resolve returned items back to real WordData using chinese field as key
    // (AI may hallucinate image paths or IDs, but chinese characters are reliable)
    const byChinese: Record<string, WordData> = {}
    for (const w of otherWords) byChinese[w.chinese] = w

    const resolved: WordData[] = []
    for (const item of parsed.slice(0, 3)) {
      const obj = item as Partial<WordData>
      // Try matching by id first, then by chinese character
      const match =
        otherWords.find((w) => w.id === obj.id) ??
        (obj.chinese ? byChinese[obj.chinese] : undefined)
      if (match) resolved.push(match)
    }

    // Need exactly 3 valid matches
    if (resolved.length !== 3) return null

    return resolved
  } catch {
    return null
  }
}

function pickRandomDistractors(targetWord: WordData, packWords: WordData[]): WordData[] {
  const others = packWords.filter((w) => w.id !== targetWord.id)
  const shuffled = [...others].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 3)
}

async function checkOllama(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

async function main() {
  const ollamaAvailable = await checkOllama()
  if (!ollamaAvailable) {
    console.warn(`⚠️  Ollama not reachable at ${OLLAMA_URL}. Falling back to random distractors.`)
    console.warn('   Start Ollama and re-run this script to get AI-generated questions.')
  } else {
    console.log(`✓ Ollama running at ${OLLAMA_URL} (model: ${OLLAMA_MODEL})`)
  }

  const packs = await prisma.pack.findMany({
    include: { words: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { sortOrder: 'asc' },
  })

  let totalGenerated = 0

  for (const pack of packs) {
    console.log(`\n📦 ${pack.name} (${pack.words.length} words)`)

    // Clear existing generated questions for this pack
    await prisma.generatedQuestion.deleteMany({ where: { packId: pack.id } })

    const packWords = pack.words as WordData[]

    for (const word of packWords) {
      // Generate one question per type (3 types = 3 questions per word)
      const types: QuestionType[] = ['audio_to_picture', 'picture_to_chinese', 'english_to_chinese']

      // One Ollama call per word to get the best distractors — reuse across all types
      let distractors: WordData[] | null = null
      if (ollamaAvailable && packWords.length >= 4) {
        process.stdout.write(`  ${word.english}: calling AI... `)
        distractors = await getDistractorsFromOllama(word, packWords)
        process.stdout.write(distractors ? 'ok\n' : 'fallback\n')
      } else {
        process.stdout.write(`  ${word.english}: random distractors\n`)
      }

      if (!distractors) {
        distractors = pickRandomDistractors(word, packWords)
      }

      // Store one GeneratedQuestion per type, all sharing the same distractors
      await prisma.generatedQuestion.createMany({
        data: types.map((type) => ({
          packId: pack.id,
          wordId: word.id,
          type,
          distractors: distractors as object,
        })),
      })

      totalGenerated += types.length
    }
  }

  console.log(`\n✓ Done — ${totalGenerated} questions stored in database.`)
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
