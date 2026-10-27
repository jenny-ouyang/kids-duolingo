import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getAuthContext, update, create, retrieve } = vi.hoisted(() => ({
  getAuthContext: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  retrieve: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getAuthContext,
  authErrorResponse: () => null,
}))

vi.mock('@/lib/db', () => ({
  prisma: { account: { update } },
}))

vi.mock('stripe', () => ({
  default: class {
    checkout = { sessions: { create, retrieve } }
  },
}))

import { POST } from './route'

const NEW_URL = 'https://checkout.stripe.com/c/cs_test_1'

function ctx(account: Record<string, unknown>) {
  getAuthContext.mockResolvedValue({ userId: 'u1', account: { id: 'u1', email: 'a@b.co', ...account } })
}

describe('stripe checkout guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PAYMENTS_ENABLED = 'true'
    process.env.STRIPE_SECRET_KEY = 'sk_test_x'
    process.env.STRIPE_PRICE_ID = 'price_x'
    create.mockResolvedValue({ id: 'cs_test_1', url: NEW_URL })
    update.mockResolvedValue({})
  })

  afterEach(() => {
    delete process.env.PAYMENTS_ENABLED
    delete process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_PRICE_ID
  })

  it('returns 404 when payments are off', async () => {
    process.env.PAYMENTS_ENABLED = 'false'
    ctx({ plan: 'free', isGuest: false })
    const res = await POST()
    expect(res.status).toBe(404)
    expect(create).not.toHaveBeenCalled()
  })

  it('returns 409 for a lifetime account', async () => {
    ctx({ plan: 'lifetime', isGuest: false })
    const res = await POST()
    expect(res.status).toBe(409)
    expect(create).not.toHaveBeenCalled()
  })

  it('returns 403 claim-first for a guest', async () => {
    ctx({ plan: 'free', isGuest: true })
    const res = await POST()
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'claim-first' })
    expect(create).not.toHaveBeenCalled()
  })

  it('creates a session with promo codes and expiry, and stores its id', async () => {
    ctx({ plan: 'free', isGuest: false, stripeCheckoutSessionId: null })
    const res = await POST()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: NEW_URL })
    expect(create).toHaveBeenCalledTimes(1)
    const arg = create.mock.calls[0][0]
    expect(arg.allow_promotion_codes).toBe(true)
    expect(typeof arg.expires_at).toBe('number')
    expect(update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { stripeCheckoutSessionId: 'cs_test_1' } })
  })

  it('reuses a stored session that is still open', async () => {
    ctx({ plan: 'free', isGuest: false, stripeCheckoutSessionId: 'cs_old' })
    retrieve.mockResolvedValue({ status: 'open', url: 'https://checkout.stripe.com/c/cs_old' })
    const res = await POST()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: 'https://checkout.stripe.com/c/cs_old' })
    expect(create).not.toHaveBeenCalled()
  })

  it('creates a new session when the stored one has expired', async () => {
    ctx({ plan: 'free', isGuest: false, stripeCheckoutSessionId: 'cs_old' })
    retrieve.mockResolvedValue({ status: 'expired' })
    const res = await POST()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: NEW_URL })
    expect(create).toHaveBeenCalledTimes(1)
  })
})
