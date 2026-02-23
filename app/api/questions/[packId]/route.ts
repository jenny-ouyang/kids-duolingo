import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Word } from '@/lib/types'

const CHILD = 'julian'
const SESSION_SIZE = 8

/**
 * GET /api/questions/[packId]
 *
 * Returns a ready-to-play Chinese session: picks words due for review (SM-2 + recently wrong),
 * loads their pre-generated questions from the DB, and shuffles options.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { packId: string } }
) {
  const { packId } = params

  try {
    const [pack, progressRows, recentWrong] = await Promise.all([
      prisma.pack.findUnique({
        where: { id: packId },
        include: { words: { orderBy: { sortOrder: 'asc' } } },
      }),
      prisma.chineseProgress.findMany({
        where: { childName: CHILD, packId },
        select: { wordId: true, repetitions: true, nextReview: true },
      }),
      prisma.answerEvent.findMany({
        where: { childName: CHILD, packId, correct: false },
        orderBy: { answeredAt: 'desc' },
        take: 30,
        select: { itemId: true },
      }),
    ])

    if (!pack) {
      return NextResponse.json({ error: 'Pack not found' }, { status: 404 })
    }

    const progressMap: Record<string, { repetitions: number; nextReview: Date }> = {}
    for (const p of progressRows) {
      progressMap[p.wordId] = { repetitions: p.repetitions, nextReview: p.nextReview }
    }

    const prioritySet = new Set<string>()
    for (const e of recentWrong) {
      prioritySet.add(e.itemId)
    }

    const now = new Date()
    const allWordIds = pack.words.map((w) => w.id)

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

    const generatedRows = await prisma.generatedQuestion.findMany({
      where: { packId, wordId: { in: selectedIds } },
    })

    const wordMap: Record<string, Word> = {}
    for (const w of pack.words) {
      wordMap[w.id] = { id: w.id, english: w.english, chinese: w.chinese, pinyin: w.pinyin, image: w.image }
    }

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
        const distractors = shuffle(Object.values(wordMap).filter((w) => w.id !== wordId)).slice(0, 3)
        const options = shuffle([word, ...distractors])
        return [{ word, options, correctId: wordId, type: 'audio_to_picture' }]
      }

      const row = rows[Math.floor(Math.random() * rows.length)]
      const distractors = (row.distractors as unknown as Word[]).map((d) => wordMap[d.id] ?? d)
      const options = shuffle([word, ...distractors])
      return [{ word, options, correctId: wordId, type: row.type }]
    })

    const allProgress = await prisma.chineseProgress.findMany({ where: { childName: CHILD, packId } })
    const wordProgress: Record<string, { easiness: number; interval: number; repetitions: number; nextReview: string }> = {}
    for (const p of allProgress) {
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
