import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireChild, authErrorResponse } from '@/lib/auth'

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
    const { child } = await requireChild()
    if (subject === 'math') {
      const rows = await prisma.mathProgress.findMany({
        where: { childId: child.id, packId },
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
      where: { childId: child.id, packId },
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
    const authErr = authErrorResponse(err)
    if (authErr) return authErr
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
    const { child } = await requireChild()
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
        where: { childId_packId_problemId: { childId: child.id, packId, problemId: wordId } },
        create: { childId: child.id, packId, problemId: wordId, easiness, interval, repetitions, nextReview: new Date(nextReview) },
        update: { easiness, interval, repetitions, nextReview: new Date(nextReview) },
      })
    } else {
      await prisma.chineseProgress.upsert({
        where: { childId_packId_wordId: { childId: child.id, packId, wordId } },
        create: { childId: child.id, packId, wordId, easiness, interval, repetitions, nextReview: new Date(nextReview) },
        update: { easiness, interval, repetitions, nextReview: new Date(nextReview) },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const authErr = authErrorResponse(err)
    if (authErr) return authErr
    console.error('[progress POST]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
