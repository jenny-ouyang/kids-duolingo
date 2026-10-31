import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireChild, authErrorResponse } from '@/lib/auth'
import { assertPackAccess, packLockedResponse } from '@/lib/pack-gate'
import { getWeekDays, getNextPacks, parseTz, todayIndex } from '@/lib/learning-path'

/**
 * GET /api/profile?tz={getTimezoneOffset()}
 * Returns the active child's profile (name, avatar, totalHearts, streak, lastPracticed),
 * plus this week's play days (Monday first), today's index, and the suggested next pack.
 */
export async function GET(req: NextRequest) {
  try {
    const { child, account } = await requireChild()
    const tz = parseTz(req.nextUrl.searchParams.get('tz'))
    const [weekDays, nextPacks, stickerCount] = await Promise.all([
      getWeekDays([child.id], tz),
      getNextPacks([child.id], account),
      prisma.sticker.count({ where: { childId: child.id } }),
    ])

    return NextResponse.json({
      id: child.id,
      name: child.name,
      avatar: child.avatar,
      totalHearts: child.totalHearts,
      streak: child.streak,
      lastPracticed: child.lastPracticed?.toISOString() ?? null,
      weekDays: weekDays[child.id],
      today: todayIndex(tz),
      nextPack: nextPacks[child.id],
      stickerCount,
    })
  } catch (err) {
    const authErr = authErrorResponse(err)
    if (authErr) return authErr
    console.error('[profile GET]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}

/**
 * POST /api/profile
 * Body: { heartsEarned }
 * Adds hearts and updates streak + lastPracticed for the active child.
 */
export async function POST(req: NextRequest) {
  try {
    const { account, child } = await requireChild()
    const body = await req.json() as {
      heartsEarned: number
      tzOffsetMinutes?: number
      /** Word session only: the pack, and the words right on the first try (sticker candidates) */
      packId?: string
      firstTryWordIds?: string[]
    }
    // A sticker shows a word of the pack, so a locked pack gets nothing (and no
    // write happens). Math sessions send no packId and skip this.
    if (typeof body.packId === 'string') assertPackAccess(account, body.packId)

    const now = new Date()

    // Streak compares CALENDAR days (in the child's timezone when the client sends
    // its offset, UTC otherwise) — elapsed-hours math broke evening→morning streaks.
    const tz = typeof body.tzOffsetMinutes === 'number' && Math.abs(body.tzOffsetMinutes) <= 14 * 60
      ? body.tzOffsetMinutes
      : 0
    const dayNumber = (d: Date) => Math.floor((d.getTime() - tz * 60_000) / 86_400_000)

    let newStreak = 1
    if (child.lastPracticed) {
      const diffDays = dayNumber(now) - dayNumber(child.lastPracticed)
      if (diffDays === 0) newStreak = child.streak           // same calendar day — keep streak
      else if (diffDays === 1) newStreak = child.streak + 1  // consecutive day
      else newStreak = 1                                     // gap — reset
    }

    const updated = await prisma.child.update({
      where: { id: child.id },
      data: {
        totalHearts: { increment: body.heartsEarned },
        streak: newStreak,
        lastPracticed: now,
      },
    })

    const sticker = await awardSticker(child.id, body.packId, body.firstTryWordIds)

    return NextResponse.json({
      totalHearts: updated.totalHearts,
      streak: updated.streak,
      sticker,
    })
  } catch (err) {
    const locked = packLockedResponse(err)
    if (locked) return locked
    const authErr = authErrorResponse(err)
    if (authErr) return authErr
    console.error('[profile POST]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}

/**
 * One word sticker per finished word session (6-C): a word the child got right
 * on the first try this session, from this pack, not already in the book.
 * The candidate list comes from the client, so it is checked against the pack.
 */
async function awardSticker(childId: string, packId: unknown, wordIds: unknown) {
  if (typeof packId !== 'string' || !Array.isArray(wordIds)) return null
  const ids = wordIds.filter((id): id is string => typeof id === 'string').slice(0, 50)
  if (ids.length === 0) return null

  const [words, owned] = await Promise.all([
    prisma.word.findMany({ where: { packId, id: { in: ids } } }),
    prisma.sticker.findMany({ where: { childId, wordId: { in: ids } }, select: { wordId: true } }),
  ])
  const ownedIds = new Set(owned.map((s) => s.wordId))
  const fresh = words.filter((w) => !ownedIds.has(w.id))
  if (fresh.length === 0) return null

  const word = fresh[Math.floor(Math.random() * fresh.length)]
  // A double submit can race; the unique (childId, wordId) index keeps one row
  await prisma.sticker.createMany({ data: [{ childId, wordId: word.id, packId }], skipDuplicates: true })
  return { wordId: word.id, chinese: word.chinese, pinyin: word.pinyin, english: word.english, image: word.image, packId }
}
