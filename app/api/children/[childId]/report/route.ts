import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext, authErrorResponse } from '@/lib/auth'

const WOBBLY_LIMIT = 8
const WOBBLY_EASINESS_THRESHOLD = 2.3
const MASTERED_REPETITIONS = 3
/** How many recent answer events we scan to find each item's latest outcome. */
const RECENT_EVENTS_SCAN = 400

/**
 * GET /api/children/[childId]/report
 *
 * Parent-facing progress report for one child. The childId comes from the URL,
 * so ownership is verified explicitly against the authenticated account —
 * a childId that isn't the account's returns 404 (indistinguishable from
 * "doesn't exist", so ids can't be probed).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { childId: string } }
) {
  const { childId } = params

  try {
    const { userId } = await getAuthContext()
    const child = await prisma.child.findFirst({
      where: { id: childId, accountId: userId },
      select: {
        id: true,
        name: true,
        avatar: true,
        totalHearts: true,
        streak: true,
        lastPracticed: true,
      },
    })
    if (!child) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000)

    const [
      packs,
      chineseStarted,
      chineseMastered,
      mathStarted,
      mathMastered,
      chineseProgress,
      recentEvents,
      answers7d,
      correct7d,
    ] = await Promise.all([
      prisma.pack.findMany({
        orderBy: [{ subject: 'asc' }, { sortOrder: 'asc' }],
        select: {
          id: true,
          subject: true,
          name: true,
          nameZh: true,
          emoji: true,
          _count: { select: { words: true, problems: true } },
        },
      }),
      prisma.chineseProgress.groupBy({
        by: ['packId'],
        where: { childId },
        _count: { _all: true },
      }),
      prisma.chineseProgress.groupBy({
        by: ['packId'],
        where: { childId, repetitions: { gte: MASTERED_REPETITIONS } },
        _count: { _all: true },
      }),
      prisma.mathProgress.groupBy({
        by: ['packId'],
        where: { childId },
        _count: { _all: true },
      }),
      prisma.mathProgress.groupBy({
        by: ['packId'],
        where: { childId, repetitions: { gte: MASTERED_REPETITIONS } },
        _count: { _all: true },
      }),
      // Every Chinese word this child has touched — the wobbly candidates.
      prisma.chineseProgress.findMany({
        where: { childId },
        select: {
          wordId: true,
          easiness: true,
          word: {
            select: {
              english: true,
              chinese: true,
              pinyin: true,
              pack: { select: { name: true } },
            },
          },
        },
      }),
      // Newest-first slice of answer history: first occurrence per item = latest outcome.
      prisma.answerEvent.findMany({
        where: { childId },
        orderBy: { answeredAt: 'desc' },
        take: RECENT_EVENTS_SCAN,
        select: { itemId: true, correct: true },
      }),
      prisma.answerEvent.count({
        where: { childId, answeredAt: { gte: sevenDaysAgo } },
      }),
      prisma.answerEvent.count({
        where: { childId, answeredAt: { gte: sevenDaysAgo }, correct: true },
      }),
    ])

    const toCountMap = (rows: { packId: string; _count: { _all: number } }[]) =>
      new Map(rows.map((r) => [r.packId, r._count._all]))
    const chineseStartedBy = toCountMap(chineseStarted)
    const chineseMasteredBy = toCountMap(chineseMastered)
    const mathStartedBy = toCountMap(mathStarted)
    const mathMasteredBy = toCountMap(mathMastered)

    const packRows = packs
      .map((pack) => {
        const isMath = pack.subject === 'math'
        const totalWords = isMath ? pack._count.problems : pack._count.words
        return {
          packId: pack.id,
          name: pack.name,
          nameZh: pack.nameZh,
          emoji: pack.emoji,
          subject: pack.subject,
          totalWords,
          started: (isMath ? mathStartedBy : chineseStartedBy).get(pack.id) ?? 0,
          mastered: (isMath ? mathMasteredBy : chineseMasteredBy).get(pack.id) ?? 0,
        }
      })
      // Sentence-only or empty packs have nothing to report on
      .filter((p) => p.totalWords > 0)

    // Latest outcome per item: events are newest-first, keep the first seen.
    const latestOutcome = new Map<string, boolean>()
    for (const event of recentEvents) {
      if (!latestOutcome.has(event.itemId)) {
        latestOutcome.set(event.itemId, event.correct)
      }
    }

    const wobbly = chineseProgress
      .map((row) => {
        const lastWrong = latestOutcome.get(row.wordId) === false
        return { row, lastWrong }
      })
      .filter(
        ({ row, lastWrong }) =>
          row.easiness < WOBBLY_EASINESS_THRESHOLD || lastWrong
      )
      // Weakest first: low easiness sorts up; a wrong last answer weighs it down further.
      .sort(
        (a, b) =>
          a.row.easiness - (a.lastWrong ? 0.4 : 0) -
          (b.row.easiness - (b.lastWrong ? 0.4 : 0))
      )
      .slice(0, WOBBLY_LIMIT)
      .map(({ row }) => ({
        wordId: row.wordId,
        english: row.word.english,
        chinese: row.word.chinese,
        pinyin: row.word.pinyin,
        packName: row.word.pack.name,
      }))

    // "Words" totals are Chinese vocabulary; math has its own per-pack rows.
    const sum = (rows: { _count: { _all: number } }[]) =>
      rows.reduce((acc, r) => acc + r._count._all, 0)

    return NextResponse.json({
      child,
      packs: packRows,
      wobbly,
      totals: {
        wordsStarted: sum(chineseStarted),
        wordsMastered: sum(chineseMastered),
        answers7d,
        correct7d,
      },
    })
  } catch (err) {
    const authErr = authErrorResponse(err)
    if (authErr) return authErr
    console.error('[child report GET]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
