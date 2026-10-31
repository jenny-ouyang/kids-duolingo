import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireChild, authErrorResponse } from '@/lib/auth'
import { canAccessPack } from '@/lib/plan'

/**
 * GET /api/stickers
 * The active child's sticker book: one page per pack that has a sticker, with
 * every word of the pack (collected or not) and the newest sticker's word id.
 */
export async function GET() {
  try {
    const { account, child } = await requireChild()
    // A page lists every word of its pack, so only packs this account can open get a page
    const stickers = (
      await prisma.sticker.findMany({
        where: { childId: child.id },
        orderBy: { createdAt: 'desc' },
        select: { wordId: true, packId: true },
      })
    ).filter((s) => canAccessPack(account, s.packId))
    if (stickers.length === 0) return NextResponse.json({ newestWordId: null, pages: [] })

    const collected = new Set(stickers.map((s) => s.wordId))
    const packIds = Array.from(new Set(stickers.map((s) => s.packId)))
    const packs = await prisma.pack.findMany({
      where: { id: { in: packIds } },
      orderBy: { sortOrder: 'asc' },
      include: { words: { orderBy: { sortOrder: 'asc' } } },
    })

    return NextResponse.json({
      newestWordId: stickers[0].wordId,
      pages: packs.map((p) => ({
        id: p.id,
        name: p.name,
        nameZh: p.nameZh ?? '',
        emoji: p.emoji,
        count: p.words.filter((w) => collected.has(w.id)).length,
        words: p.words.map((w) => ({
          id: w.id,
          chinese: w.chinese,
          english: w.english,
          image: w.image,
          collected: collected.has(w.id),
        })),
      })),
    })
  } catch (err) {
    const authErr = authErrorResponse(err)
    if (authErr) return authErr
    console.error('[stickers GET]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
