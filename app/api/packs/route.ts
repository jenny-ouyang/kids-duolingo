import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const CHILD = 'julian'

/**
 * GET /api/packs
 * Returns all packs with their word list and Julian's mastery percentage,
 * in a single DB query. No separate /api/progress calls needed on the client.
 */
export async function GET() {
  try {
    const [packs, allProgress] = await Promise.all([
      prisma.pack.findMany({
        include: { words: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.wordProgress.findMany({
        where: { childName: CHILD },
        select: { packId: true, wordId: true, repetitions: true },
      }),
    ])

    // Group progress by packId for fast lookup
    const progressByPack: Record<string, Record<string, number>> = {}
    for (const p of allProgress) {
      if (!progressByPack[p.packId]) progressByPack[p.packId] = {}
      progressByPack[p.packId][p.wordId] = p.repetitions
    }

    const result = packs.map((pack) => {
      const packProgress = progressByPack[pack.id] ?? {}
      const practiced = pack.words.filter(
        (w) => (packProgress[w.id] ?? 0) >= 1
      ).length
      const masteryPct = pack.words.length > 0
        ? Math.round((practiced / pack.words.length) * 100)
        : 0

      return {
        id: pack.id,
        name: pack.name,
        nameZh: pack.nameZh,
        emoji: pack.emoji,
        color: pack.color,
        wordCount: pack.words.length,
        wordIds: pack.words.map((w) => w.id),
        masteryPct,
      }
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[packs GET]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
