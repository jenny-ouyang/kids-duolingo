import { prisma } from '@/lib/db'

export interface NextPack {
  id: string
  name: string
  nameZh: string
  emoji: string
  learned: number
  wordCount: number
}

/** Client tz offset (Date#getTimezoneOffset minutes) from a query param; UTC when absent or invalid */
export function parseTz(raw: string | null): number {
  const n = Number(raw)
  return Number.isFinite(n) && Math.abs(n) <= 14 * 60 ? n : 0
}

/**
 * This week's play days per child, Monday first, in the child's timezone.
 * A missed day is just false: nothing resets (the app's no-streak-shaming rule).
 */
export async function getWeekDays(childIds: string[], tzOffsetMinutes: number): Promise<Record<string, boolean[]>> {
  const local = (d: Date) => new Date(d.getTime() - tzOffsetMinutes * 60_000)
  const now = local(new Date())
  const dayIndex = (now.getUTCDay() + 6) % 7 // Monday = 0
  const mondayLocal = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayIndex)
  const since = new Date(mondayLocal + tzOffsetMinutes * 60_000)

  const events = await prisma.answerEvent.findMany({
    where: { childId: { in: childIds }, answeredAt: { gte: since } },
    select: { childId: true, answeredAt: true },
  })
  const result: Record<string, boolean[]> = Object.fromEntries(childIds.map((id) => [id, Array(7).fill(false)]))
  for (const e of events) {
    const i = Math.floor((local(e.answeredAt).getTime() - mondayLocal) / 86_400_000)
    if (i >= 0 && i < 7) result[e.childId][i] = true
  }
  return result
}

/** Today's index in the Monday-first week, in the given timezone */
export function todayIndex(tzOffsetMinutes: number): number {
  const now = new Date(Date.now() - tzOffsetMinutes * 60_000)
  return (now.getUTCDay() + 6) % 7
}

/**
 * The pack each child should play next: the first word pack (in sortOrder) the
 * child has started and not finished, else the first one not started. Only a
 * suggestion — every pack stays open.
 */
export async function getNextPacks(childIds: string[]): Promise<Record<string, NextPack | null>> {
  const packs = await prisma.pack.findMany({
    where: { subject: 'chinese', words: { some: {} } },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true, nameZh: true, emoji: true, words: { select: { id: true } } },
  })
  const rows = await prisma.chineseProgress.findMany({
    where: { childId: { in: childIds }, repetitions: { gte: 1 } },
    select: { childId: true, packId: true },
  })
  const learned: Record<string, Record<string, number>> = {}
  for (const r of rows) {
    learned[r.childId] ??= {}
    learned[r.childId][r.packId] = (learned[r.childId][r.packId] ?? 0) + 1
  }

  const result: Record<string, NextPack | null> = {}
  for (const childId of childIds) {
    const counts = learned[childId] ?? {}
    const toPack = (p: (typeof packs)[number]): NextPack => ({
      id: p.id,
      name: p.name,
      nameZh: p.nameZh ?? '',
      emoji: p.emoji,
      learned: counts[p.id] ?? 0,
      wordCount: p.words.length,
    })
    const started = packs.find((p) => (counts[p.id] ?? 0) > 0 && (counts[p.id] ?? 0) < p.words.length)
    const fresh = packs.find((p) => !counts[p.id])
    const pick = started ?? fresh
    result[childId] = pick ? toPack(pick) : null
  }
  return result
}
