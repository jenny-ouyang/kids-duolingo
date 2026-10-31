import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { requireChild, packFindFirst, answerCreate } = vi.hoisted(() => ({
  requireChild: vi.fn(),
  packFindFirst: vi.fn(),
  answerCreate: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ requireChild, authErrorResponse: () => null }))
vi.mock('@/lib/db', () => ({
  prisma: {
    pack: { findFirst: packFindFirst },
    answerEvent: { create: answerCreate },
  },
}))

import { POST } from './route'

const post = (body: Record<string, unknown>) =>
  POST(new Request('http://x/api/answers', { method: 'POST', body: JSON.stringify(body) }) as never)

describe('POST /api/answers pack gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PAYMENTS_ENABLED = 'true'
    requireChild.mockResolvedValue({ userId: 'u1', account: { plan: 'free' }, child: { id: 'c1' } })
  })
  afterEach(() => {
    delete process.env.PAYMENTS_ENABLED
  })

  it('returns 402 for a locked pack', async () => {
    const res = await post({ packId: 'food', wordId: 'food-apple', correct: true })
    expect(res.status).toBe(402)
    expect(answerCreate).not.toHaveBeenCalled()
  })

  it('returns 400 when the item is not in the pack', async () => {
    packFindFirst.mockResolvedValue(null)
    const res = await post({ packId: 'animals', wordId: 'food-apple', correct: false })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'wordId not in pack' })
    expect(packFindFirst.mock.calls[0][0].where.id).toBe('animals')
    expect(answerCreate).not.toHaveBeenCalled()
  })

  it('records an item of the pack', async () => {
    packFindFirst.mockResolvedValue({ id: 'animals' })
    const res = await post({ packId: 'animals', wordId: 'animals-cat', correct: true })
    expect(res.status).toBe(200)
    expect(answerCreate).toHaveBeenCalledTimes(1)
  })
})
