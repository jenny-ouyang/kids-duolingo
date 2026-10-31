import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireChild, authErrorResponse } from '@/lib/auth'
import { assertPackAccess, packLockedResponse } from '@/lib/pack-gate'

/**
 * POST /api/answers
 * Body: { packId, wordId, correct }
 * Records an answer event. Used to surface recently-wrong items in future sessions.
 * wordId is kept as the body field name for backward compat with existing Chinese practice page.
 */
export async function POST(req: NextRequest) {
  try {
    const { account, child } = await requireChild()
    const body = await req.json() as {
      packId: string
      wordId: string
      correct: boolean
    }
    if (typeof body.packId !== 'string' || !body.packId) return NextResponse.json({ error: 'packId required' }, { status: 400 })
    assertPackAccess(account, body.packId)
    if (typeof body.wordId !== 'string' || !body.wordId) return NextResponse.json({ error: 'wordId required' }, { status: 400 })
    // The item (a word, or a math problem) must belong to the (accessible) pack. One query covers both.
    const inPack = await prisma.pack.findFirst({
      where: {
        id: body.packId,
        OR: [{ words: { some: { id: body.wordId } } }, { problems: { some: { id: body.wordId } } }],
      },
      select: { id: true },
    })
    if (!inPack) return NextResponse.json({ error: 'wordId not in pack' }, { status: 400 })

    await prisma.answerEvent.create({
      data: {
        childId: child.id,
        packId: body.packId,
        itemId: body.wordId,
        correct: body.correct,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const locked = packLockedResponse(err)
    if (locked) return locked
    const authErr = authErrorResponse(err)
    if (authErr) return authErr
    console.error('[answers POST]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}

/**
 * GET /api/answers?packId=animals&limit=30
 * Returns the most recent wrong-answer itemIds for the active child in a pack.
 */
export async function GET(req: NextRequest) {
  const packId = req.nextUrl.searchParams.get('packId')
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '30', 10)

  if (!packId) {
    return NextResponse.json({ error: 'packId required' }, { status: 400 })
  }

  try {
    const { child } = await requireChild()
    const events = await prisma.answerEvent.findMany({
      where: { childId: child.id, packId, correct: false },
      orderBy: { answeredAt: 'desc' },
      take: limit,
      select: { itemId: true },
    })

    const seen = new Set<string>()
    const wordIds: string[] = []
    for (const e of events) {
      if (!seen.has(e.itemId)) {
        seen.add(e.itemId)
        wordIds.push(e.itemId)
      }
    }

    return NextResponse.json({ wordIds })
  } catch (err) {
    const authErr = authErrorResponse(err)
    if (authErr) return authErr
    console.error('[answers GET]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
