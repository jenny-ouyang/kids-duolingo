import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const CHILD = 'julian'

/**
 * GET /api/progress?packId=animals
 * Returns all WordProgress rows for Julian in a pack as a map { wordId: {...} }
 */
export async function GET(req: NextRequest) {
  const packId = req.nextUrl.searchParams.get('packId')
  if (!packId) {
    return NextResponse.json({ error: 'packId required' }, { status: 400 })
  }

  try {
    const rows = await prisma.wordProgress.findMany({
      where: { childName: CHILD, packId },
    })

    const result: Record<string, {
      easiness: number
      interval: number
      repetitions: number
      nextReview: string
    }> = {}

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
 * Body: { packId, wordId, easiness, interval, repetitions, nextReview }
 * Upserts a single word's SM-2 state.
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
    }

    const { packId, wordId, easiness, interval, repetitions, nextReview } = body

    await prisma.wordProgress.upsert({
      where: { childName_packId_wordId: { childName: CHILD, packId, wordId } },
      create: { childName: CHILD, packId, wordId, easiness, interval, repetitions, nextReview: new Date(nextReview) },
      update: { easiness, interval, repetitions, nextReview: new Date(nextReview) },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[progress POST]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
