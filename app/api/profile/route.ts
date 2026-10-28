import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireChild, authErrorResponse } from '@/lib/auth'
import { getWeekDays, getNextPacks, parseTz, todayIndex } from '@/lib/learning-path'

/**
 * GET /api/profile?tz={getTimezoneOffset()}
 * Returns the active child's profile (name, avatar, totalHearts, streak, lastPracticed),
 * plus this week's play days (Monday first), today's index, and the suggested next pack.
 */
export async function GET(req: NextRequest) {
  try {
    const { child } = await requireChild()
    const tz = parseTz(req.nextUrl.searchParams.get('tz'))
    const [weekDays, nextPacks, stickerCount] = await Promise.all([
      getWeekDays([child.id], tz),
      getNextPacks([child.id]),
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
    const { child } = await requireChild()
    const body = await req.json() as {
      heartsEarned: number
      tzOffsetMinutes?: number
    }

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

    return NextResponse.json({
      totalHearts: updated.totalHearts,
      streak: updated.streak,
    })
  } catch (err) {
    const authErr = authErrorResponse(err)
    if (authErr) return authErr
    console.error('[profile POST]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
