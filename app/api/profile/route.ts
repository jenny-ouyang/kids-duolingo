import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const CHILD = 'julian'

/**
 * GET /api/profile
 * Returns Julian's profile (totalHearts, streak, lastPracticed).
 * Creates the profile row if it doesn't exist yet.
 */
export async function GET() {
  try {
    const profile = await prisma.childProfile.upsert({
      where: { name: CHILD },
      create: { name: CHILD, totalHearts: 0, streak: 0 },
      update: {},
    })

    return NextResponse.json({
      name: profile.name,
      totalHearts: profile.totalHearts,
      streak: profile.streak,
      lastPracticed: profile.lastPracticed?.toISOString() ?? null,
    })
  } catch (err) {
    console.error('[profile GET]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}

/**
 * POST /api/profile
 * Body: { heartsEarned, practiceCompleted }
 * Adds hearts and updates streak + lastPracticed.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      heartsEarned: number
    }

    const now = new Date()
    const existing = await prisma.childProfile.findUnique({ where: { name: CHILD } })

    // Streak logic: increment if practiced today or yesterday, reset otherwise
    let newStreak = 1
    if (existing?.lastPracticed) {
      const last = existing.lastPracticed
      const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays === 0) newStreak = existing.streak      // same day — keep streak
      else if (diffDays === 1) newStreak = existing.streak + 1  // consecutive day
      else newStreak = 1                                     // gap — reset
    }

    const profile = await prisma.childProfile.upsert({
      where: { name: CHILD },
      create: {
        name: CHILD,
        totalHearts: body.heartsEarned,
        streak: 1,
        lastPracticed: now,
      },
      update: {
        totalHearts: { increment: body.heartsEarned },
        streak: newStreak,
        lastPracticed: now,
      },
    })

    return NextResponse.json({
      totalHearts: profile.totalHearts,
      streak: profile.streak,
    })
  } catch (err) {
    console.error('[profile POST]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
