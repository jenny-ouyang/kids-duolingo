import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { requireChild, wordFind, problemFind, chineseUpsert, mathUpsert } = vi.hoisted(() => ({
  requireChild: vi.fn(),
  wordFind: vi.fn(),
  problemFind: vi.fn(),
  chineseUpsert: vi.fn(),
  mathUpsert: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ requireChild, authErrorResponse: () => null }))
vi.mock('@/lib/db', () => ({
  prisma: {
    word: { findUnique: wordFind },
    mathProblem: { findUnique: problemFind },
    chineseProgress: { upsert: chineseUpsert },
    mathProgress: { upsert: mathUpsert },
  },
}))

import { POST } from './route'

const sm2 = { easiness: 2.5, interval: 1, repetitions: 1, nextReview: new Date().toISOString() }
const post = (body: Record<string, unknown>) =>
  POST(new Request('http://x/api/progress', { method: 'POST', body: JSON.stringify(body) }) as never)

describe('POST /api/progress pack gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PAYMENTS_ENABLED = 'true'
    requireChild.mockResolvedValue({ userId: 'u1', account: { plan: 'free' }, child: { id: 'c1' } })
  })
  afterEach(() => {
    delete process.env.PAYMENTS_ENABLED
  })

  it('returns 402 for a locked pack', async () => {
    const res = await post({ packId: 'food', wordId: 'food-apple', ...sm2 })
    expect(res.status).toBe(402)
    expect(chineseUpsert).not.toHaveBeenCalled()
  })

  it('returns 400 when a free packId carries a word of a locked pack', async () => {
    wordFind.mockResolvedValue({ packId: 'food' })
    const res = await post({ packId: 'animals', wordId: 'food-apple', ...sm2 })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'wordId not in pack' })
    expect(chineseUpsert).not.toHaveBeenCalled()
  })

  it('returns 400 for an unknown word', async () => {
    wordFind.mockResolvedValue(null)
    const res = await post({ packId: 'animals', wordId: 'nope', ...sm2 })
    expect(res.status).toBe(400)
    expect(chineseUpsert).not.toHaveBeenCalled()
  })

  it('saves a word of the same free pack', async () => {
    wordFind.mockResolvedValue({ packId: 'animals' })
    const res = await post({ packId: 'animals', wordId: 'animals-cat', ...sm2 })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(chineseUpsert).toHaveBeenCalledTimes(1)
  })

  it('checks math problems against the math table', async () => {
    problemFind.mockResolvedValue({ packId: 'math_add_10' })
    const bad = await post({ packId: 'math_add_singles', wordId: 'p-locked', subject: 'math', ...sm2 })
    expect(bad.status).toBe(400)
    expect(mathUpsert).not.toHaveBeenCalled()

    problemFind.mockResolvedValue({ packId: 'math_add_singles' })
    const ok = await post({ packId: 'math_add_singles', wordId: 'p-free', subject: 'math', ...sm2 })
    expect(ok.status).toBe(200)
    expect(mathUpsert).toHaveBeenCalledTimes(1)
    expect(wordFind).not.toHaveBeenCalled()
  })
})
