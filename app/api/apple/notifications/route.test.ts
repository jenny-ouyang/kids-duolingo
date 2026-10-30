import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeFakeAppleDb } from '@/lib/test/fake-apple-db'

const { decodeTx, decodeNotification, fake } = vi.hoisted(() => ({
  decodeTx: vi.fn(),
  decodeNotification: vi.fn(),
  fake: { current: null as ReturnType<typeof makeFakeAppleDb> | null, fail: false },
}))

vi.mock('@/lib/db', () => ({
  get prisma() {
    const p = fake.current!.prisma
    return fake.fail
      ? {
          ...p,
          $transaction: async () => {
            throw new Error('db down')
          },
        }
      : p
  },
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

fake.current = makeFakeAppleDb()
const db = fake.current

const tx = (extra: Record<string, unknown> = {}) => ({
  productId: 'com.mandarineer.app.lifetime',
  type: 'Non-Consumable',
  transactionId: '2000000123',
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
    db.reset()
    fake.fail = false
    decodeTx.mockResolvedValue(tx())
    db.addAccount({ id: 'buyer', plan: 'lifetime', planSource: 'apple', appleOriginalTransactionId: '2000000123' })
  })

  it('rejects a payload that fails verification, with no write', async () => {
    decodeNotification.mockRejectedValue(new VerificationException(VerificationStatus.VERIFICATION_FAILURE))
    expect((await deliver()).status).toBe(400)
    expect(db.get('buyer').plan).toBe('lifetime')
    expect(db.revocations).toHaveLength(0)
  })

  it('REFUND for our product: the Apple-sourced buyer goes back to free, unbound, and is recorded', async () => {
    decodeNotification.mockResolvedValue(notification('REFUND'))
    expect((await deliver()).status).toBe(200)
    expect(db.get('buyer')).toMatchObject({ plan: 'free', planSource: null, appleOriginalTransactionId: null })
    expect(db.revocations).toEqual([expect.objectContaining({ key: 'purchased:2000000123', notificationType: 'REFUND' })])
  })

  it('REVOKE for the buyer copy is handled like REFUND', async () => {
    decodeNotification.mockResolvedValue(notification('REVOKE'))
    await deliver()
    expect(db.get('buyer').plan).toBe('free')
  })

  it('a second delivery of the same REFUND is a no-op', async () => {
    decodeNotification.mockResolvedValue(notification('REFUND'))
    await deliver()
    expect((await deliver()).status).toBe(200)
    expect(db.revocations).toHaveLength(1)
  })

  it('REFUND for a Stripe-sourced account keeps the Stripe plan', async () => {
    db.reset()
    db.addAccount({ id: 's1', plan: 'lifetime', planSource: 'stripe', appleOriginalTransactionId: '2000000123' })
    decodeNotification.mockResolvedValue(notification('REFUND'))
    expect((await deliver()).status).toBe(200)
    expect(db.get('s1')).toMatchObject({ plan: 'lifetime', planSource: 'stripe' })
  })

  it('REVOKE for a family-shared copy carrying the buyer id does not touch the buyer', async () => {
    decodeNotification.mockResolvedValue(notification('REVOKE'))
    decodeTx.mockResolvedValue(tx({ inAppOwnershipType: 'FAMILY_SHARED', transactionId: '3000000001' }))
    expect((await deliver()).status).toBe(200)
    expect(db.get('buyer')).toMatchObject({ plan: 'lifetime', appleOriginalTransactionId: '2000000123' })
    expect(db.revocations.map((r) => r.key)).toEqual(['family:3000000001'])
  })

  it('REFUND for another product is ignored', async () => {
    decodeNotification.mockResolvedValue(notification('REFUND'))
    decodeTx.mockResolvedValue(tx({ productId: 'com.other.thing' }))
    expect((await deliver()).status).toBe(200)
    expect(db.get('buyer').plan).toBe('lifetime')
    expect(db.revocations).toHaveLength(0)
  })

  it('TEST and other types are acknowledged and ignored', async () => {
    for (const type of ['TEST', 'CONSUMPTION_REQUEST', 'ONE_TIME_CHARGE']) {
      decodeNotification.mockResolvedValue({ notificationType: type, data: {} })
      expect((await deliver()).status).toBe(200)
    }
    expect(db.get('buyer').plan).toBe('lifetime')
  })

  it('falls back to the Sandbox verifier for a sandbox notification', async () => {
    decodeNotification.mockImplementation(async (env: string) => {
      if (env === 'Production') throw new VerificationException(VerificationStatus.INVALID_ENVIRONMENT)
      return notification('REFUND')
    })
    expect((await deliver()).status).toBe(200)
    expect(db.get('buyer').plan).toBe('free')
  })

  it('a DB failure returns 500 so Apple retries', async () => {
    decodeNotification.mockResolvedValue(notification('REFUND'))
    fake.fail = true
    expect((await deliver()).status).toBe(500)
  })

  it('rejects a body without signedPayload', async () => {
    expect((await deliver({})).status).toBe(400)
  })
})
