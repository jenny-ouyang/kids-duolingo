import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext, authErrorResponse } from '@/lib/auth'
import { hasLifetime } from '@/lib/plan'
import { isFamilyShared, isValidLifetimeTransaction, verifyTransaction } from '@/lib/apple-verify'
import { dropAppleIfNoBasis, familyKey, purchasedKey } from '@/lib/apple-grants'

export const runtime = 'nodejs'

/**
 * POST /api/apple/verify { jws }
 * The iPhone app sends the StoreKit 2 signed transaction after Buy or
 * Restore Purchases. The JWS is verified offline against Apple's root
 * certificates (lib/apple-verify.ts); the account comes from getAuthContext()
 * only, never from the body. Guests may buy on the iPhone.
 *
 * Accepted: product com.mandarineer.app.lifetime, Non-Consumable, not revoked,
 * and not recorded in AppleRevocation (a JWS signed before a refund carries no
 * revocationDate, so the refund notification is the only record of it).
 *
 * - PURCHASED (the parent's own Apple ID): restore policy, spec §2. When the
 *   same Apple purchase is bound to another account, the unlock MOVES here:
 *   the old account loses the binding and, if its plan came from Apple and
 *   it has no other Apple basis, goes back to free. Stripe / manual plans stay.
 * - FAMILY_SHARED (Family Sharing is on, Jenny 2026-10-30): recorded in
 *   AppleFamilyGrant by the family member's own transactionId, so one JWS
 *   unlocks one account at a time (same move rule). appleOriginalTransactionId
 *   is NOT written: it is unique and the purchaser's account holds it.
 *
 * Idempotent: verifying the same purchase twice changes nothing. NOT gated on
 * PAYMENTS_ENABLED (same reason as the Stripe webhook): a verified Apple
 * purchase is always recorded, so a parent who paid is never left locked.
 */
export async function POST(req: Request) {
  try {
    const { userId, account } = await getAuthContext()

    const body = (await req.json().catch(() => null)) as { jws?: unknown } | null
    const jws = typeof body?.jws === 'string' ? body.jws : null
    if (!jws) {
      return NextResponse.json({ error: 'missing jws' }, { status: 400 })
    }

    let tx
    try {
      tx = await verifyTransaction(jws)
    } catch (err) {
      console.error('[apple verify] verification failed', err)
      return NextResponse.json({ error: 'invalid transaction' }, { status: 400 })
    }
    if (!isValidLifetimeTransaction(tx)) {
      console.log(`[apple verify] ${userId}: rejected ${tx.productId} ${tx.type}${tx.revocationDate ? ' (revoked)' : ''}`)
      return NextResponse.json({ error: 'not a valid lifetime purchase' }, { status: 400 })
    }
    const originalTransactionId = tx.originalTransactionId as string
    const environment = tx.environment ?? null
    const familyShared = isFamilyShared(tx)
    const transactionId = tx.transactionId

    if (familyShared && !transactionId) {
      return NextResponse.json({ error: 'not a valid lifetime purchase' }, { status: 400 })
    }

    const revocationKeys = [purchasedKey(originalTransactionId)]
    if (familyShared) revocationKeys.push(familyKey(transactionId as string))
    const revoked = await prisma.appleRevocation.findFirst({ where: { key: { in: revocationKeys } } })
    if (revoked) {
      console.log(`[apple verify] ${userId}: refused, ${revoked.key} was refunded or revoked`)
      return NextResponse.json({ error: 'refunded or revoked' }, { status: 400 })
    }

    if (familyShared) {
      const familyTxId = transactionId as string
      const moved = await prisma.$transaction(async (db) => {
        const grant = await db.appleFamilyGrant.findUnique({ where: { transactionId: familyTxId } })
        let from: string | null = null
        if (!grant) {
          await db.appleFamilyGrant.create({
            data: { transactionId: familyTxId, originalTransactionId, accountId: userId, environment },
          })
        } else if (grant.accountId !== userId) {
          from = grant.accountId
          await db.appleFamilyGrant.update({
            where: { transactionId: familyTxId },
            data: { accountId: userId, environment },
          })
          await dropAppleIfNoBasis(db, from)
        }
        if (!hasLifetime(account)) {
          await db.account.update({
            where: { id: userId },
            data: { plan: 'lifetime', planSource: 'apple', planGrantedAt: new Date(), appleEnvironment: environment },
          })
        }
        return from
      })
      console.log(`[apple verify] ${userId}: lifetime from a family-shared purchase${moved ? ' (moved)' : ''}`)
      return NextResponse.json({ lifetime: true })
    }

    // Already bound here: nothing to do.
    if (account.appleOriginalTransactionId === originalTransactionId && hasLifetime(account)) {
      return NextResponse.json({ lifetime: true })
    }
    // Already lifetime from Stripe or a manual grant: keep that source so its
    // refund rule still matches, and do not take the purchase from anyone.
    if (hasLifetime(account) && account.planSource !== 'apple') {
      return NextResponse.json({ lifetime: true })
    }

    const movedFrom = await prisma.$transaction(async (db) => {
      // Clear the old binding BEFORE writing the new one (the column is unique).
      const others = await db.account.findMany({
        where: { appleOriginalTransactionId: originalTransactionId, id: { not: userId } },
        select: { id: true },
      })
      if (others.length > 0) {
        await db.account.updateMany({
          where: { id: { in: others.map((o) => o.id) } },
          data: { appleOriginalTransactionId: null },
        })
        for (const o of others) await dropAppleIfNoBasis(db, o.id)
      }
      await db.account.update({
        where: { id: userId },
        data: {
          plan: 'lifetime',
          planSource: 'apple',
          planGrantedAt: new Date(),
          appleOriginalTransactionId: originalTransactionId,
          appleEnvironment: environment,
        },
      })
      return others.length
    })
    console.log(`[apple verify] ${userId}: lifetime from Apple${movedFrom ? ' (moved from another account)' : ''}`)
    return NextResponse.json({ lifetime: true })
  } catch (err) {
    const authErr = authErrorResponse(err)
    if (authErr) return authErr
    console.error('[apple verify POST]', err)
    return NextResponse.json({ error: 'verify error' }, { status: 500 })
  }
}
