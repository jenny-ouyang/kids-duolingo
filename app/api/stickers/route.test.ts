import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { requireChild, stickerFindMany, packFindMany } = vi.hoisted(() => ({
  requireChild: vi.fn(),
  stickerFindMany: vi.fn(),
  packFindMany: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ requireChild, authErrorResponse: () => null }))
vi.mock('@/lib/db', () => ({
  prisma: {
    sticker: { findMany: stickerFindMany },
    pack: { findMany: packFindMany },
  },
}))

import { GET } from './route'

describe('GET /api/stickers pack gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PAYMENTS_ENABLED = 'true'
    stickerFindMany.mockResolvedValue([
      { wordId: 'food-apple', packId: 'food' },
      { wordId: 'animals-cat', packId: 'animals' },
    ])
    packFindMany.mockResolvedValue([])
  })
  afterEach(() => {
    delete process.env.PAYMENTS_ENABLED
  })

  it('leaves out locked packs for a free account', async () => {
    requireChild.mockResolvedValue({ account: { plan: 'free' }, child: { id: 'c1' } })
    const res = await GET()
    expect(packFindMany.mock.calls[0][0].where.id.in).toEqual(['animals'])
    expect((await res.json()).newestWordId).toBe('animals-cat')
  })

  it('returns an empty book when every sticker is in a locked pack', async () => {
    requireChild.mockResolvedValue({ account: { plan: 'free' }, child: { id: 'c1' } })
    stickerFindMany.mockResolvedValue([{ wordId: 'food-apple', packId: 'food' }])
    const res = await GET()
    expect(await res.json()).toEqual({ newestWordId: null, pages: [] })
    expect(packFindMany).not.toHaveBeenCalled()
  })

  it('keeps every pack for a lifetime account', async () => {
    requireChild.mockResolvedValue({ account: { plan: 'lifetime' }, child: { id: 'c1' } })
    const res = await GET()
    expect(packFindMany.mock.calls[0][0].where.id.in).toEqual(['food', 'animals'])
    expect((await res.json()).newestWordId).toBe('food-apple')
  })
})
