import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { updateMany, constructEvent, retrieve } = vi.hoisted(() => ({
  updateMany: vi.fn(),
  constructEvent: vi.fn(),
  retrieve: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { account: { updateMany } },
}))

// Signature verification is stubbed at the library boundary: constructEvent returns the event
vi.mock('stripe', () => ({
  default: class {
    webhooks = { constructEvent }
    checkout = { sessions: { retrieve } }
  },
}))

import { POST } from './route'

function deliver(event: unknown) {
  constructEvent.mockReturnValue(event)
  return POST(
    new Request('https://mandarineer.com/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=x' },
      body: '{}',
    }) as never
  )
}

const completed = (extra: Record<string, unknown> = {}) => ({
  type: 'checkout.session.completed',
  data: { object: { id: 'cs_1', client_reference_id: 'acct_u1', payment_status: 'paid', ...extra } },
})

const refunded = (charge: Record<string, unknown>) => ({
  type: 'charge.refunded',
  data: { object: { payment_intent: 'pi_1', amount: 999, amount_refunded: 999, refunded: true, ...charge } },
})

describe('stripe webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_SECRET_KEY = 'sk_test_x'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_x'
    updateMany.mockResolvedValue({ count: 1 })
  })

  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_WEBHOOK_SECRET
  })

  it('is inert (404) without Stripe configured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    const res = await deliver(completed())
    expect(res.status).toBe(404)
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('rejects a bad signature', async () => {
    constructEvent.mockImplementation(() => {
      throw new Error('bad sig')
    })
    const res = await POST(
      new Request('https://mandarineer.com/api/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 'bad' },
        body: '{}',
      }) as never
    )
    expect(res.status).toBe(400)
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('unlocks with the stripe source and ids, and founder during the founding period even without the code', async () => {
    retrieve.mockResolvedValue({ discounts: [], payment_intent: 'pi_1' })
    const res = await deliver(completed())
    expect(res.status).toBe(200)
    const arg = updateMany.mock.calls[0][0]
    expect(arg.where).toEqual({ id: 'acct_u1', plan: { not: 'lifetime' } })
    expect(arg.data).toMatchObject({
      plan: 'lifetime',
      planSource: 'stripe',
      stripeCheckoutSessionId: 'cs_1',
      stripePaymentIntentId: 'pi_1',
    })
    expect(arg.data.isFounder).toBe(true) // FOUNDING_PERIOD: the home page promises future packs to every founding buyer
  })

  it('marks a founder when the FOUNDER promotion code was applied', async () => {
    retrieve.mockResolvedValue({ discounts: [{ promotion_code: { code: 'founder' } }], payment_intent: { id: 'pi_2' } })
    await deliver(completed())
    expect(updateMany.mock.calls[0][0].data).toMatchObject({ isFounder: true, stripePaymentIntentId: 'pi_2' })
  })

  it('does not unlock an unpaid session', async () => {
    await deliver(completed({ payment_status: 'unpaid' }))
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('a full refund puts a stripe-sourced plan back to free and keeps isFounder', async () => {
    await deliver(refunded({}))
    const arg = updateMany.mock.calls[0][0]
    expect(arg.where).toEqual({ stripePaymentIntentId: 'pi_1', planSource: 'stripe' })
    expect(arg.data).toEqual({ plan: 'free', planSource: null, planGrantedAt: null })
  })

  it('a partial refund changes nothing', async () => {
    await deliver(refunded({ amount_refunded: 500, refunded: false }))
    expect(updateMany).not.toHaveBeenCalled()
  })
})
