import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getAuthContext, updateMany, update, $transaction, decodeTx } = vi.hoisted(() => ({
  getAuthContext: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  $transaction: vi.fn(),
  decodeTx: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getAuthContext,
  authErrorResponse: () => null,
}))

vi.mock('@/lib/db', () => ({
  prisma: { account: { updateMany, update }, $transaction },
}))

// The verifier is stubbed at the library boundary: decodeTx(environment, jws)
// stands in for Apple's signature check and returns the decoded payload.
vi.mock('@apple/app-store-server-library', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@apple/app-store-server-library')>()
  return {
    ...actual,
    SignedDataVerifier: class {
      constructor(
        _roots: Buffer[],
        _online: boolean,
        private environment: string
      ) {}
      verifyAndDecodeTransaction(jws: string) {
        return decodeTx(this.environment, jws)
      }
    },
  }
})

import { VerificationException, VerificationStatus } from '@apple/app-store-server-library'
import { POST } from './route'

const validTx = (extra: Record<string, unknown> = {}) => ({
  productId: 'com.mandarineer.app.lifetime',
  type: 'Non-Consumable',
  originalTransactionId: '2000000123',
  inAppOwnershipType: 'PURCHASED',
  environment: 'Sandbox',
  ...extra,
})

function ctx(account: Record<string, unknown> = {}) {
  getAuthContext.mockResolvedValue({
    userId: 'u1',
    account: { id: 'u1', plan: 'free', planSource: null, appleOriginalTransactionId: null, ...account },
  })
}

function verify(body: unknown = { jws: 'eyJ.sandbox.jws' }) {
  return POST(
    new Request('https://mandarineer.com/api/apple/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  )
}

describe('POST /api/apple/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ctx()
    updateMany.mockResolvedValue({ count: 0 })
    update.mockResolvedValue({})
    $transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops))
    decodeTx.mockResolvedValue(validTx())
  })

  it('a valid purchase unlocks the account and binds the Apple purchase', async () => {
    const res = await verify()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ lifetime: true })
    expect(update).toHaveBeenCalledTimes(1)
    const arg = update.mock.calls[0][0]
    expect(arg.where).toEqual({ id: 'u1' })
    expect(arg.data).toMatchObject({
      plan: 'lifetime',
      planSource: 'apple',
      appleOriginalTransactionId: '2000000123',
    })
    expect(arg.data.planGrantedAt).toBeInstanceOf(Date)
  })

  it('falls back to the Sandbox verifier when Production says wrong environment', async () => {
    decodeTx.mockImplementation(async (env: string) => {
      if (env === 'Production') throw new VerificationException(VerificationStatus.INVALID_ENVIRONMENT)
      return validTx()
    })
    const res = await verify()
    expect(res.status).toBe(200)
    expect(decodeTx.mock.calls.map((c) => c[0])).toEqual(['Production', 'Sandbox'])
  })

  it('rejects a JWS that fails verification, with no write', async () => {
    decodeTx.mockRejectedValue(new VerificationException(VerificationStatus.VERIFICATION_FAILURE))
    const res = await verify()
    expect(res.status).toBe(400)
    expect(decodeTx).toHaveBeenCalledTimes(1) // no Sandbox retry for a bad signature
    expect(update).not.toHaveBeenCalled()
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('rejects a wrong product id', async () => {
    decodeTx.mockResolvedValue(validTx({ productId: 'com.other.app.lifetime' }))
    const res = await verify()
    expect(res.status).toBe(400)
    expect(update).not.toHaveBeenCalled()
  })

  it('rejects a product that is not non-consumable', async () => {
    decodeTx.mockResolvedValue(validTx({ type: 'Consumable' }))
    expect((await verify()).status).toBe(400)
    expect(update).not.toHaveBeenCalled()
  })

  it('rejects a revoked transaction', async () => {
    decodeTx.mockResolvedValue(validTx({ revocationDate: 1761800000000 }))
    const res = await verify()
    expect(res.status).toBe(400)
    expect(update).not.toHaveBeenCalled()
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('rejects a missing jws', async () => {
    expect((await verify({})).status).toBe(400)
    expect(decodeTx).not.toHaveBeenCalled()
  })

  it('move on restore: the old account loses the binding (and an Apple plan) before this one gets it', async () => {
    updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 })
    const res = await verify()
    expect(res.status).toBe(200)
    expect($transaction).toHaveBeenCalledTimes(1)
    const ops = $transaction.mock.calls[0][0]
    expect(ops).toHaveLength(3)
    // 1: an Apple-sourced old account goes back to free and is unbound
    expect(updateMany.mock.calls[0][0]).toEqual({
      where: { appleOriginalTransactionId: '2000000123', id: { not: 'u1' }, planSource: 'apple' },
      data: { plan: 'free', planSource: null, planGrantedAt: null, appleOriginalTransactionId: null },
    })
    // 2: any other old account (Stripe / manual plan) only loses the binding, keeps its plan
    expect(updateMany.mock.calls[1][0]).toEqual({
      where: { appleOriginalTransactionId: '2000000123', id: { not: 'u1' } },
      data: { appleOriginalTransactionId: null },
    })
    // 3: then the current account is bound (unique column cleared first)
    expect(update.mock.calls[0][0].data.appleOriginalTransactionId).toBe('2000000123')
  })

  it('verifying the same purchase twice on the same account changes nothing', async () => {
    ctx({ plan: 'lifetime', planSource: 'apple', appleOriginalTransactionId: '2000000123' })
    const res = await verify()
    expect(res.status).toBe(200)
    expect($transaction).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('a Stripe lifetime account keeps its Stripe source and does not take the Apple purchase', async () => {
    ctx({ plan: 'lifetime', planSource: 'stripe' })
    const res = await verify()
    expect(res.status).toBe(200)
    expect($transaction).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('family shared: unlocks without the move rule and without writing the Apple id', async () => {
    decodeTx.mockResolvedValue(validTx({ inAppOwnershipType: 'FAMILY_SHARED' }))
    updateMany.mockResolvedValue({ count: 1 })
    const res = await verify()
    expect(res.status).toBe(200)
    expect($transaction).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(updateMany).toHaveBeenCalledTimes(1)
    const arg = updateMany.mock.calls[0][0]
    expect(arg.where).toEqual({ id: 'u1', plan: { not: 'lifetime' } })
    expect(arg.data).toMatchObject({ plan: 'lifetime', planSource: 'apple' })
    expect(arg.data).not.toHaveProperty('appleOriginalTransactionId')
  })

  it('family shared on an account that is already lifetime: no write', async () => {
    ctx({ plan: 'lifetime', planSource: 'stripe' })
    decodeTx.mockResolvedValue(validTx({ inAppOwnershipType: 'FAMILY_SHARED' }))
    expect((await verify()).status).toBe(200)
    expect(updateMany).not.toHaveBeenCalled()
  })
})
