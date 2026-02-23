import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const CHILD = 'julian'

/**
 * GET /api/progress?packId=animals
 * GET /api/progress?packId=math_add_5&subject=math
 * Returns SM-2 progress as a map { itemId: { easiness, interval, repetitions, nextReview } }
 */
export async function GET(req: NextRequest) {
  const packId = req.nextUrl.searchParams.get('packId')
  const subject = req.nextUrl.searchParams.get('subject') ?? 'chinese'

  if (!packId) {
    return NextResponse.json({ error: 'packId required' }, { status: 400 })
  }

  try {
    if (subject === 'math') {
      const rows = await prisma.mathProgress.findMany({
        where: { childName: CHILD, packId },
      })
      const result: Record<string, { easiness: number; interval: number; repetitions: number; nextReview: string }> = {}
      for (const row of rows) {
        result[row.problemId] = {
          easiness: row.easiness,
          interval: row.interval,
          repetitions: row.repetitions,
          nextReview: row.nextReview.toISOString(),
        }
      }
      return NextResponse.json(result)
    }

    // Default: chinese
    const rows = await prisma.chineseProgress.findMany({
      where: { childName: CHILD, packId },
    })
    const result: Record<string, { easiness: number; interval: number; repetitions: number; nextReview: string }> = {}
    for (const row of rows) {
      result[row.wordId] = {
        easiness: row.easiness,
        interval: row.interval,
        repetitions: row.repetitions,
        nextReview: row.nextReview.toISOString(),
      }
    }
    return NextResponse.json(result)
  } catch (err) {
    console.error('[progress GET]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}

/**
 * POST /api/progress
 * Body: { packId, wordId, easiness, interval, repetitions, nextReview, subject? }
 * Upserts a single item's SM-2 state into the appropriate progress table.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      packId: string
      wordId: string
      easiness: number
      interval: number
      repetitions: number
      nextReview: string
      subject?: string
    }

    const { packId, wordId, easiness, interval, repetitions, nextReview, subject = 'chinese' } = body

    if (subject === 'math') {
      await prisma.mathProgress.upsert({
        where: { childName_packId_problemId: { childName: CHILD, packId, problemId: wordId } },
        create: { childName: CHILD, packId, problemId: wordId, easiness, interval, repetitions, nextReview: new Date(nextReview) },
        update: { easiness, interval, repetitions, nextReview: new Date(nextReview) },
      })
    } else {
      await prisma.chineseProgress.upsert({
        where: { childName_packId_wordId: { childName: CHILD, packId, wordId } },
        create: { childName: CHILD, packId, wordId, easiness, interval, repetitions, nextReview: new Date(nextReview) },
        update: { easiness, interval, repetitions, nextReview: new Date(nextReview) },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[progress POST]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
