import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeFakeAppleDb } from '@/lib/test/fake-apple-db'

const { getAuthContext, decodeTx, decodeNotification, fake } = vi.hoisted(() => ({
  getAuthContext: vi.fn(),
  decodeTx: vi.fn(),
  decodeNotification: vi.fn(),
  fake: { current: null as ReturnType<typeof makeFakeAppleDb> | null },
}))

vi.mock('@/lib/auth', () => ({
  getAuthContext,
  authErrorResponse: () => null,
}))

vi.mock('@/lib/db', () => ({
  get prisma() {
    return fake.current!.prisma
  },
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
      verifyAndDecodeNotification(payload: string) {
        return decodeNotification(this.environment, payload)
      }
    },
  }
})

import { VerificationException, VerificationStatus } from '@apple/app-store-server-library'
import { POST } from './route'
import { POST as NOTIFY } from '../notifications/route'

fake.current = makeFakeAppleDb()
const db = fake.current

const validTx = (extra: Record<string, unknown> = {}) => ({
  productId: 'com.mandarineer.app.lifetime',
  type: 'Non-Consumable',
  transactionId: '2000000123',
  originalTransactionId: '2000000123',
  inAppOwnershipType: 'PURCHASED',
  environment: 'Sandbox',
  ...extra,
})

const familyTx = (transactionId: string, extra: Record<string, unknown> = {}) =>
  validTx({ inAppOwnershipType: 'FAMILY_SHARED', transactionId, ...extra })

/** Signs in as `id` (the account row is read fresh, as getAuthContext does). */
function as(id: string) {
  if (!db.accounts.some((a) => a.id === id)) db.addAccount({ id })
  getAuthContext.mockImplementation(async () => ({ userId: id, account: { ...db.get(id) } }))
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

async function verifyTx(payload: Record<string, unknown>) {
  decodeTx.mockResolvedValue(payload)
  return verify()
}

async function notify(type: string, payload: Record<string, unknown>) {
  decodeNotification.mockResolvedValue({ notificationType: type, data: { signedTransactionInfo: 'eyJ.tx' } })
  decodeTx.mockResolvedValue(payload)
  return NOTIFY(
    new Request('https://mandarineer.com/api/apple/notifications', {
      method: 'POST',
      body: JSON.stringify({ signedPayload: 'eyJ.payload' }),
    })
  )
}

describe('POST /api/apple/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.reset()
    as('u1')
    decodeTx.mockResolvedValue(validTx())
  })

  it('a valid purchase unlocks the account, binds the purchase, stores the environment', async () => {
    const res = await verify()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ lifetime: true })
    expect(db.get('u1')).toMatchObject({
      plan: 'lifetime',
      planSource: 'apple',
      appleOriginalTransactionId: '2000000123',
      appleEnvironment: 'Sandbox',
    })
    expect(db.get('u1').planGrantedAt).toBeInstanceOf(Date)
  })

  it('falls back to the Sandbox verifier when Production says wrong environment', async () => {
    decodeTx.mockImplementation(async (env: string) => {
      if (env === 'Production') throw new VerificationException(VerificationStatus.INVALID_ENVIRONMENT)
      return validTx()
    })
    expect((await verify()).status).toBe(200)
    expect(decodeTx.mock.calls.map((c) => c[0])).toEqual(['Production', 'Sandbox'])
  })

  it('rejects a JWS that fails verification, with no write', async () => {
    decodeTx.mockRejectedValue(new VerificationException(VerificationStatus.VERIFICATION_FAILURE))
    expect((await verify()).status).toBe(400)
    expect(decodeTx).toHaveBeenCalledTimes(1) // no Sandbox retry for a bad signature
    expect(db.get('u1').plan).toBe('free')
  })

  it.each([
    ['a wrong product id', { productId: 'com.other.app.lifetime' }],
    ['a product that is not non-consumable', { type: 'Consumable' }],
    ['a revoked transaction', { revocationDate: 1761800000000 }],
  ])('rejects %s', async (_name, extra) => {
    expect((await verifyTx(validTx(extra))).status).toBe(400)
    expect(db.get('u1').plan).toBe('free')
  })

  it('rejects a missing jws', async () => {
    expect((await verify({})).status).toBe(400)
    expect(decodeTx).not.toHaveBeenCalled()
  })

  it('move on restore: the old Apple account goes back to free, this one gets the purchase', async () => {
    await verify()
    as('u2')
    expect((await verify()).status).toBe(200)
    expect(db.get('u1')).toMatchObject({ plan: 'free', planSource: null, appleOriginalTransactionId: null })
    expect(db.get('u2')).toMatchObject({ plan: 'lifetime', planSource: 'apple', appleOriginalTransactionId: '2000000123' })
  })

  it('move on restore: an old account with a Stripe plan keeps its plan, loses only the binding', async () => {
    db.addAccount({ id: 'old', plan: 'lifetime', planSource: 'stripe', appleOriginalTransactionId: '2000000123' })
    expect((await verify()).status).toBe(200)
    expect(db.get('old')).toMatchObject({ plan: 'lifetime', planSource: 'stripe', appleOriginalTransactionId: null })
    expect(db.get('u1').appleOriginalTransactionId).toBe('2000000123')
  })

  it('verifying the same purchase twice on the same account changes nothing', async () => {
    await verify()
    const grantedAt = db.get('u1').planGrantedAt
    as('u1')
    expect((await verify()).status).toBe(200)
    expect(db.get('u1').planGrantedAt).toBe(grantedAt)
  })

  it('a Stripe lifetime account keeps its Stripe source and does not take the Apple purchase', async () => {
    db.addAccount({ id: 's1', plan: 'lifetime', planSource: 'stripe' })
    as('s1')
    expect((await verify()).status).toBe(200)
    expect(db.get('s1')).toMatchObject({ planSource: 'stripe', appleOriginalTransactionId: null })
  })

  describe('refund replay (security review item 1)', () => {
    it('after a REFUND, the old JWS is refused and the account stays free', async () => {
      await verify()
      expect((await notify('REFUND', validTx())).status).toBe(200)
      expect(db.get('u1').plan).toBe('free')
      as('u1')
      expect((await verifyTx(validTx())).status).toBe(400)
      expect(db.get('u1').plan).toBe('free')
      // ...and from any other account too
      as('u9')
      expect((await verifyTx(validTx())).status).toBe(400)
      expect(db.get('u9').plan).toBe('free')
    })

    it('a REFUND that arrives before the app ever verified still blocks the JWS', async () => {
      await notify('REFUND', validTx())
      expect((await verifyTx(validTx())).status).toBe(400)
    })

    it('the revocation check runs inside the grant transaction, after the purchase lock (race fix)', async () => {
      await verify()
      expect(db.log).toEqual(['tx:begin', 'lock:2000000123', 'revocation:check', 'tx:end'])
      db.log.length = 0
      as('u2')
      await verifyTx(familyTx('3000000001'))
      expect(db.log).toEqual(['tx:begin', 'lock:2000000123', 'revocation:check', 'tx:end'])
    })

    it('a refund recorded after the request started but before the locked check is honoured', async () => {
      // The refund commits while verify is still decoding the JWS.
      decodeTx.mockImplementation(async () => {
        db.revocations.push({ key: 'purchased:2000000123', notificationType: 'REFUND' })
        return validTx()
      })
      expect((await verify()).status).toBe(400)
      expect(db.get('u1').plan).toBe('free')
    })

    it('a new purchase after a refund (new originalTransactionId) is accepted', async () => {
      await notify('REFUND', validTx())
      expect((await verifyTx(validTx({ transactionId: '2000000999', originalTransactionId: '2000000999' }))).status).toBe(200)
      expect(db.get('u1').plan).toBe('lifetime')
    })
  })

  describe('family sharing (security review item 2)', () => {
    it('unlocks without the move rule on the buyer and without writing the Apple id', async () => {
      db.addAccount({ id: 'buyer', plan: 'lifetime', planSource: 'apple', appleOriginalTransactionId: '2000000123' })
      expect((await verifyTx(familyTx('3000000001'))).status).toBe(200)
      expect(db.get('u1')).toMatchObject({ plan: 'lifetime', planSource: 'apple', appleOriginalTransactionId: null })
      expect(db.get('buyer')).toMatchObject({ plan: 'lifetime', appleOriginalTransactionId: '2000000123' })
      expect(db.grants).toEqual([
        expect.objectContaining({ transactionId: '3000000001', originalTransactionId: '2000000123', accountId: 'u1' }),
      ])
    })

    it('the same family JWS on a second account moves the grant: one JWS, one account', async () => {
      await verifyTx(familyTx('3000000001'))
      as('u2')
      expect((await verifyTx(familyTx('3000000001'))).status).toBe(200)
      expect(db.get('u2').plan).toBe('lifetime')
      expect(db.get('u1').plan).toBe('free')
      expect(db.grants).toHaveLength(1)
      expect(db.grants[0].accountId).toBe('u2')
    })

    it('a moved family grant does not downgrade an account with its own purchase', async () => {
      db.addAccount({ id: 'u3', plan: 'lifetime', planSource: 'apple', appleOriginalTransactionId: '5000000001' })
      as('u3')
      await verifyTx(familyTx('3000000001'))
      as('u2')
      await verifyTx(familyTx('3000000001'))
      expect(db.get('u3').plan).toBe('lifetime')
    })

    it('two family members (two transactionIds) both stay unlocked', async () => {
      await verifyTx(familyTx('3000000001'))
      as('u2')
      await verifyTx(familyTx('3000000002'))
      expect(db.get('u1').plan).toBe('lifetime')
      expect(db.get('u2').plan).toBe('lifetime')
    })

    it('a family member on a Stripe lifetime account is recorded, plan source unchanged', async () => {
      db.addAccount({ id: 's1', plan: 'lifetime', planSource: 'stripe' })
      as('s1')
      expect((await verifyTx(familyTx('3000000001'))).status).toBe(200)
      expect(db.get('s1').planSource).toBe('stripe')
    })

    it("the buyer's REFUND ends every family grant and blocks their JWS", async () => {
      db.addAccount({ id: 'buyer', plan: 'lifetime', planSource: 'apple', appleOriginalTransactionId: '2000000123' })
      await verifyTx(familyTx('3000000001'))
      as('u2')
      await verifyTx(familyTx('3000000002'))

      await notify('REFUND', validTx())
      expect(db.get('buyer').plan).toBe('free')
      expect(db.get('u1').plan).toBe('free')
      expect(db.get('u2').plan).toBe('free')
      expect(db.grants).toHaveLength(0)

      as('u1')
      expect((await verifyTx(familyTx('3000000001'))).status).toBe(400)
      expect(db.get('u1').plan).toBe('free')
    })

    it("a family member's REVOKE does not fan out to other members sharing the same originalTransactionId", async () => {
      // No buyer account bound here, so the old fan-out rule would have hit u2 too.
      await verifyTx(familyTx('3000000001'))
      as('u2')
      await verifyTx(familyTx('3000000002'))
      await notify('REVOKE', familyTx('3000000001'))
      expect(db.get('u1').plan).toBe('free')
      expect(db.get('u2').plan).toBe('lifetime')
      expect(db.revocations.map((r) => r.key)).toEqual(['family:3000000001'])
      // u2 can still re-verify its own copy
      as('u2')
      expect((await verifyTx(familyTx('3000000002'))).status).toBe(200)
    })

    it("a family member's REVOKE ends only that grant and never touches the buyer", async () => {
      db.addAccount({ id: 'buyer', plan: 'lifetime', planSource: 'apple', appleOriginalTransactionId: '2000000123' })
      await verifyTx(familyTx('3000000001'))
      as('u2')
      await verifyTx(familyTx('3000000002'))

      await notify('REVOKE', familyTx('3000000001'))
      expect(db.get('buyer')).toMatchObject({ plan: 'lifetime', appleOriginalTransactionId: '2000000123' })
      expect(db.get('u1').plan).toBe('free')
      expect(db.get('u2').plan).toBe('lifetime')

      as('u1')
      expect((await verifyTx(familyTx('3000000001'))).status).toBe(400)
      // the buyer's own JWS still works
      as('buyer')
      expect((await verifyTx(validTx())).status).toBe(200)
    })
  })
})
