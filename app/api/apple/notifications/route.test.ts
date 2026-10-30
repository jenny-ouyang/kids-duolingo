import { beforeEach, describe, expect, it, vi } from 'vitest'

const { updateMany, decodeTx, decodeNotification } = vi.hoisted(() => ({
  updateMany: vi.fn(),
  decodeTx: vi.fn(),
  decodeNotification: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { account: { updateMany } },
}))

// The verifier is stubbed at the library boundary.
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
      verifyAndDecodeNotification(payload: string) {
        return decodeNotification(this.environment, payload)
      }
    },
  }
})

import { VerificationException, VerificationStatus } from '@apple/app-store-server-library'
import { POST } from './route'

const tx = (extra: Record<string, unknown> = {}) => ({
  productId: 'com.mandarineer.app.lifetime',
  type: 'Non-Consumable',
  originalTransactionId: '2000000123',
  inAppOwnershipType: 'PURCHASED',
  ...extra,
})

const notification = (notificationType: string) => ({
  notificationType,
  data: { signedTransactionInfo: 'eyJ.tx' },
})

function deliver(body: unknown = { signedPayload: 'eyJ.payload' }) {
  return POST(
    new Request('https://mandarineer.com/api/apple/notifications', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  )
}

describe('POST /api/apple/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateMany.mockResolvedValue({ count: 1 })
    decodeTx.mockResolvedValue(tx())
  })

  it('rejects a payload that fails verification, with no write', async () => {
    decodeNotification.mockRejectedValue(new VerificationException(VerificationStatus.VERIFICATION_FAILURE))
    const res = await deliver()
    expect(res.status).toBe(400)
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('REFUND for our product: an Apple-sourced account goes back to free and is unbound', async () => {
    decodeNotification.mockResolvedValue(notification('REFUND'))
    const res = await deliver()
    expect(res.status).toBe(200)
    expect(updateMany).toHaveBeenCalledWith({
      where: { appleOriginalTransactionId: '2000000123', planSource: 'apple' },
      data: { plan: 'free', planSource: null, planGrantedAt: null, appleOriginalTransactionId: null },
    })
  })

  it('REVOKE for the buyer copy is handled like REFUND', async () => {
    decodeNotification.mockResolvedValue(notification('REVOKE'))
    await deliver()
    expect(updateMany).toHaveBeenCalledTimes(1)
  })

  it('REFUND for a Stripe-sourced account is a no-op (the write only matches planSource apple)', async () => {
    updateMany.mockResolvedValue({ count: 0 })
    decodeNotification.mockResolvedValue(notification('REFUND'))
    const res = await deliver()
    expect(res.status).toBe(200)
    expect(updateMany.mock.calls[0][0].where.planSource).toBe('apple')
  })

  it('REVOKE for a family-shared copy does not touch the buyer account', async () => {
    decodeNotification.mockResolvedValue(notification('REVOKE'))
    decodeTx.mockResolvedValue(tx({ inAppOwnershipType: 'FAMILY_SHARED' }))
    const res = await deliver()
    expect(res.status).toBe(200)
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('REFUND for another product is ignored', async () => {
    decodeNotification.mockResolvedValue(notification('REFUND'))
    decodeTx.mockResolvedValue(tx({ productId: 'com.other.thing' }))
    expect((await deliver()).status).toBe(200)
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('TEST and other types are acknowledged and ignored', async () => {
    for (const type of ['TEST', 'CONSUMPTION_REQUEST', 'ONE_TIME_CHARGE']) {
      decodeNotification.mockResolvedValue({ notificationType: type, data: {} })
      expect((await deliver()).status).toBe(200)
    }
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('falls back to the Sandbox verifier for a sandbox notification', async () => {
    decodeNotification.mockImplementation(async (env: string) => {
      if (env === 'Production') throw new VerificationException(VerificationStatus.INVALID_ENVIRONMENT)
      return notification('REFUND')
    })
    expect((await deliver()).status).toBe(200)
    expect(updateMany).toHaveBeenCalledTimes(1)
  })

  it('a DB failure returns 500 so Apple retries', async () => {
    decodeNotification.mockResolvedValue(notification('REFUND'))
    updateMany.mockRejectedValue(new Error('db down'))
    expect((await deliver()).status).toBe(500)
  })

  it('rejects a body without signedPayload', async () => {
    expect((await deliver({})).status).toBe(400)
  })
})
