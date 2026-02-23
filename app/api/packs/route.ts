import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const CHILD = 'julian'

/**
 * GET /api/packs              → Chinese packs (backward compatible, no change needed on client)
 * GET /api/packs?subject=math → Math topics
 *
 * Returns all packs for the given subject with mastery percentage per pack.
 */
export async function GET(req: NextRequest) {
  const subject = req.nextUrl.searchParams.get('subject') ?? 'chinese'

  try {
    const packs = await prisma.pack.findMany({
      where: { subject },
      include: { words: { orderBy: { sortOrder: 'asc' } }, problems: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    })

    // Fetch progress for mastery calculation — subject-specific tables
    const packIds = packs.map((p) => p.id)

    const masteryByPack: Record<string, number> = {}

    if (subject === 'chinese') {
      const rows = await prisma.chineseProgress.findMany({
        where: { childName: CHILD, packId: { in: packIds } },
        select: { packId: true, wordId: true, repetitions: true },
      })
      const progressByPack: Record<string, Record<string, number>> = {}
      for (const r of rows) {
        if (!progressByPack[r.packId]) progressByPack[r.packId] = {}
        progressByPack[r.packId][r.wordId] = r.repetitions
      }
      for (const pack of packs) {
        const pp = progressByPack[pack.id] ?? {}
        const practiced = pack.words.filter((w) => (pp[w.id] ?? 0) >= 1).length
        masteryByPack[pack.id] = pack.words.length > 0
          ? Math.round((practiced / pack.words.length) * 100)
          : 0
      }
    } else if (subject === 'math') {
      const rows = await prisma.mathProgress.findMany({
        where: { childName: CHILD, packId: { in: packIds } },
        select: { packId: true, problemId: true, repetitions: true },
      })
      const progressByPack: Record<string, Record<string, number>> = {}
      for (const r of rows) {
        if (!progressByPack[r.packId]) progressByPack[r.packId] = {}
        progressByPack[r.packId][r.problemId] = r.repetitions
      }
      for (const pack of packs) {
        const pp = progressByPack[pack.id] ?? {}
        const practiced = pack.problems.filter((p) => (pp[p.id] ?? 0) >= 1).length
        masteryByPack[pack.id] = pack.problems.length > 0
          ? Math.round((practiced / pack.problems.length) * 100)
          : 0
      }
    }

    const result = packs.map((pack) => ({
      id: pack.id,
      subject: pack.subject,
      name: pack.name,
      nameZh: pack.nameZh ?? '',
      emoji: pack.emoji,
      color: pack.color,
      wordCount: subject === 'chinese' ? pack.words.length : pack.problems.length,
      masteryPct: masteryByPack[pack.id] ?? 0,
    }))

    return NextResponse.json(result)
  } catch (err) {
    console.error('[packs GET]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
