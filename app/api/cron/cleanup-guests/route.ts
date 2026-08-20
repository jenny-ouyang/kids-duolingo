import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const RETENTION_DAYS = 90

/**
 * GET /api/cron/cleanup-guests — Vercel Cron (vercel.json), daily.
 * Deletes guest accounts whose family hasn't practiced in RETENTION_DAYS
 * (or that never created a child and are RETENTION_DAYS old). Cascades wipe
 * children + progress. Claimed accounts are never touched.
 * Auth: Authorization: Bearer <CRON_SECRET> (Vercel sends it automatically).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)

  const stale = await prisma.account.findMany({
    where: {
      isGuest: true,
      createdAt: { lt: cutoff },
      children: { none: { lastPracticed: { gte: cutoff } } },
    },
    select: { id: true },
    take: 200, // batch — cron runs daily, backlog drains quickly
  })

  let deleted = 0
  for (const { id } of stale) {
    await prisma.account.delete({ where: { id } })
    // Best-effort auth-user removal via raw SQL (postgres role owns auth schema)
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM auth.users WHERE id = $1::uuid AND is_anonymous = true`, id
      )
    } catch { /* auth row may already be gone */ }
    deleted++
  }

  return NextResponse.json({ ok: true, deleted, cutoff: cutoff.toISOString() })
}
