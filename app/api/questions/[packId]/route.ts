import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Word } from '@/lib/types'

const CHILD = 'julian'
const SESSION_SIZE = 8

/**
 * GET /api/questions/[packId]
 *
 * Returns a ready-to-play session: picks words due for review (SM-2 + recently wrong),
 * loads their pre-generated questions from the DB, and shuffles options.
 * Zero AI calls at runtime.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { packId: string } }
) {
  const { packId } = params

  try {
    // Load everything in parallel
    const [pack, wordProgressRows, recentWrong] = await Promise.all([
      prisma.pack.findUnique({
        where: { id: packId },
        include: { words: { orderBy: { sortOrder: 'asc' } } },
      }),
      prisma.wordProgress.findMany({
        where: { childName: CHILD, packId },
        select: { wordId: true, repetitions: true, nextReview: true },
      }),
      prisma.answerEvent.findMany({
        where: { childName: CHILD, packId, correct: false },
        orderBy: { answeredAt: 'desc' },
        take: 30,
        select: { wordId: true },
      }),
    ])

    if (!pack) {
      return NextResponse.json({ error: 'Pack not found' }, { status: 404 })
    }

    // Build progress map
    const progressMap: Record<string, { repetitions: number; nextReview: Date }> = {}
    for (const p of wordProgressRows) {
      progressMap[p.wordId] = { repetitions: p.repetitions, nextReview: p.nextReview }
    }

    // Deduplicate recent wrong words (priority order)
    const prioritySet = new Set<string>()
    for (const e of recentWrong) {
      prioritySet.add(e.wordId)
    }

    const now = new Date()
    const allWordIds = pack.words.map((w) => w.id)

    // Select words: priority first → due for review → never seen → not yet due
    const priority  = allWordIds.filter((id) => prioritySet.has(id))
    const due       = allWordIds.filter((id) => !prioritySet.has(id) && progressMap[id] && progressMap[id].nextReview <= now)
    const neverSeen = allWordIds.filter((id) => !prioritySet.has(id) && !progressMap[id])
    const notDue    = allWordIds.filter((id) => !prioritySet.has(id) && progressMap[id] && progressMap[id].nextReview > now)

    const shuffle = <T>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5)

    const selectedIds = [
      ...priority,
      ...shuffle(due),
      ...shuffle(neverSeen),
      ...shuffle(notDue),
    ].slice(0, SESSION_SIZE)

    // Load pre-generated questions for selected words
    const generatedRows = await prisma.generatedQuestion.findMany({
      where: { packId, wordId: { in: selectedIds } },
    })

    // Build word lookup map
    const wordMap: Record<string, Word> = {}
    for (const w of pack.words) {
      wordMap[w.id] = { id: w.id, english: w.english, chinese: w.chinese, pinyin: w.pinyin, image: w.image }
    }

    // For each selected word pick one question (cycle through types for variety)
    const questionsByWord: Record<string, typeof generatedRows> = {}
    for (const row of generatedRows) {
      if (!questionsByWord[row.wordId]) questionsByWord[row.wordId] = []
      questionsByWord[row.wordId].push(row)
    }

    const questions = selectedIds.flatMap((wordId) => {
      const word = wordMap[wordId]
      if (!word) return []

      const rows = questionsByWord[wordId]
      if (!rows || rows.length === 0) {
        // Fallback: build a question with random distractors if somehow missing
        const distractors = shuffle(Object.values(wordMap).filter((w) => w.id !== wordId)).slice(0, 3)
        const options = shuffle([word, ...distractors])
        return [{ word, options, correctId: wordId, type: 'audio_to_picture' }]
      }

      // Pick one question per word, rotating through question types
      const row = rows[Math.floor(Math.random() * rows.length)]
      const distractors = (row.distractors as unknown as Word[]).map((d) => wordMap[d.id] ?? d)
      const options = shuffle([word, ...distractors])
      return [{ word, options, correctId: wordId, type: row.type }]
    })

    // Also return the word progress so the client doesn't need a separate /api/progress call
    const wordProgress: Record<string, { easiness: number; interval: number; repetitions: number; nextReview: string }> = {}
    for (const p of await prisma.wordProgress.findMany({ where: { childName: CHILD, packId } })) {
      wordProgress[p.wordId] = {
        easiness: p.easiness,
        interval: p.interval,
        repetitions: p.repetitions,
        nextReview: p.nextReview.toISOString(),
      }
    }

    return NextResponse.json({ questions, wordProgress })
  } catch (err) {
    console.error('[questions GET]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
