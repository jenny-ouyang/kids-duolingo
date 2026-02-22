import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const CHILD = 'julian'

/**
 * POST /api/answers
 * Body: { packId, wordId, correct }
 * Records an answer event. Used to surface recently-wrong words in future sessions.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      packId: string
      wordId: string
      correct: boolean
    }

    await prisma.answerEvent.create({
      data: {
        childName: CHILD,
        packId: body.packId,
        wordId: body.wordId,
        correct: body.correct,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[answers POST]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}

/**
 * GET /api/answers?packId=animals&limit=30
 * Returns the most recent wrong-answer wordIds for Julian in a pack.
 * Used to prioritize these words in the next session.
 */
export async function GET(req: NextRequest) {
  const packId = req.nextUrl.searchParams.get('packId')
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '30', 10)

  if (!packId) {
    return NextResponse.json({ error: 'packId required' }, { status: 400 })
  }

  try {
    const events = await prisma.answerEvent.findMany({
      where: { childName: CHILD, packId, correct: false },
      orderBy: { answeredAt: 'desc' },
      take: limit,
      select: { wordId: true },
    })

    // Deduplicate, keeping order (most recent wrong first)
    const seen = new Set<string>()
    const wordIds: string[] = []
    for (const e of events) {
      if (!seen.has(e.wordId)) {
        seen.add(e.wordId)
        wordIds.push(e.wordId)
      }
    }

    return NextResponse.json({ wordIds })
  } catch (err) {
    console.error('[answers GET]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
