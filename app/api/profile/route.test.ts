import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { requireChild, childUpdate, wordFindMany, stickerFindMany, stickerCreateMany } = vi.hoisted(() => ({
  requireChild: vi.fn(),
  childUpdate: vi.fn(),
  wordFindMany: vi.fn(),
  stickerFindMany: vi.fn(),
  stickerCreateMany: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ requireChild, authErrorResponse: () => null }))
vi.mock('@/lib/learning-path', () => ({}))
vi.mock('@/lib/db', () => ({
  prisma: {
    child: { update: childUpdate },
    word: { findMany: wordFindMany },
    sticker: { findMany: stickerFindMany, createMany: stickerCreateMany },
  },
}))

import { POST } from './route'

const post = (body: Record<string, unknown>) =>
  POST(new Request('http://x/api/profile', { method: 'POST', body: JSON.stringify(body) }) as never)

describe('POST /api/profile sticker gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PAYMENTS_ENABLED = 'true'
    requireChild.mockResolvedValue({
      userId: 'u1',
      account: { plan: 'free' },
      child: { id: 'c1', streak: 0, lastPracticed: null },
    })
    childUpdate.mockResolvedValue({ totalHearts: 5, streak: 1 })
    stickerFindMany.mockResolvedValue([])
    stickerCreateMany.mockResolvedValue({ count: 1 })
  })
  afterEach(() => {
    delete process.env.PAYMENTS_ENABLED
  })

  it('returns 402 for a locked pack and writes nothing', async () => {
    const res = await post({ heartsEarned: 3, packId: 'food', firstTryWordIds: ['food-apple'] })
    expect(res.status).toBe(402)
    expect(await res.json()).toEqual({ error: 'locked', packId: 'food' })
    expect(childUpdate).not.toHaveBeenCalled()
    expect(wordFindMany).not.toHaveBeenCalled()
  })

  it('awards a sticker for a free pack', async () => {
    wordFindMany.mockResolvedValue([
      { id: 'animals-cat', chinese: '猫', pinyin: 'māo', english: 'cat', image: '/cat.png' },
    ])
    const res = await post({ heartsEarned: 3, packId: 'animals', firstTryWordIds: ['animals-cat'] })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sticker).toMatchObject({ wordId: 'animals-cat', packId: 'animals' })
  })

  it('still saves a math session that sends no packId', async () => {
    const res = await post({ heartsEarned: 2 })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ totalHearts: 5, streak: 1, sticker: null })
  })
})
