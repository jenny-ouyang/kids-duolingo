import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getAuthContext, childFindFirst, progressFindMany } = vi.hoisted(() => ({
  getAuthContext: vi.fn(),
  childFindFirst: vi.fn(),
  progressFindMany: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ getAuthContext, authErrorResponse: () => null }))
vi.mock('@/lib/learning-path', () => ({
  getWeekDays: async () => ({ c1: Array(7).fill(false) }),
  getNextPacks: async () => ({ c1: null }),
  parseTz: () => 0,
  todayIndex: () => 0,
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    child: { findFirst: childFindFirst },
    pack: { findMany: async () => [] },
    chineseProgress: { groupBy: async () => [], findMany: progressFindMany },
    mathProgress: { groupBy: async () => [] },
    answerEvent: { findMany: async () => [], count: async () => 0 },
  },
}))

import { GET } from './route'

const word = (id: string, packId: string) => ({
  wordId: id,
  easiness: 1.5,
  word: { packId, english: id, chinese: '字', pinyin: 'zì', pack: { name: packId } },
})

describe('GET /api/children/[childId]/report wobbly gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PAYMENTS_ENABLED = 'true'
    childFindFirst.mockResolvedValue({ id: 'c1', name: 'Kid', avatar: 'a', totalHearts: 0, streak: 0, lastPracticed: null })
    // The second row is the forged case: stored under a free packId, but the word lives in a locked pack.
    progressFindMany.mockResolvedValue([word('animals-cat', 'animals'), word('food-apple', 'food')])
  })
  afterEach(() => {
    delete process.env.PAYMENTS_ENABLED
  })

  const run = () =>
    GET({ nextUrl: new URL('http://x/api/children/c1/report') } as never, { params: { childId: 'c1' } })

  it('leaves out words of locked packs for a free account', async () => {
    getAuthContext.mockResolvedValue({ userId: 'u1', account: { plan: 'free' } })
    const body = await (await run()).json()
    expect(body.wobbly.map((w: { wordId: string }) => w.wordId)).toEqual(['animals-cat'])
  })

  it('keeps every word for a lifetime account', async () => {
    getAuthContext.mockResolvedValue({ userId: 'u1', account: { plan: 'lifetime' } })
    const body = await (await run()).json()
    expect(body.wobbly.map((w: { wordId: string }) => w.wordId).sort()).toEqual(['animals-cat', 'food-apple'])
  })
})
