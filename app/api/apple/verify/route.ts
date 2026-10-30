import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext, authErrorResponse } from '@/lib/auth'
import { hasLifetime } from '@/lib/plan'
import { isFamilyShared, isValidLifetimeTransaction, verifyTransaction } from '@/lib/apple-verify'

export const runtime = 'nodejs'

/**
 * POST /api/apple/verify { jws }
 * The iPhone app sends the StoreKit 2 signed transaction after Buy or
 * Restore Purchases. The JWS is verified offline against Apple's root
 * certificates (lib/apple-verify.ts); the account comes from getAuthContext()
 * only, never from the body. Guests may buy on the iPhone.
 *
 * Accepted: product com.mandarineer.app.lifetime, Non-Consumable, not revoked.
 *
 * - PURCHASED (the parent's own Apple ID): restore policy, spec §2. When the
 *   same Apple purchase is bound to another account, the unlock MOVES here:
 *   the old account loses the binding and, if its plan came from Apple, goes
 *   back to free. A plan from Stripe or a manual grant is kept.
 * - FAMILY_SHARED (Family Sharing is on, Jenny 2026-10-30): the account gets
 *   lifetime, but nothing moves and appleOriginalTransactionId is NOT written,
 *   because it is unique and the purchaser's account holds it.
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

    if (isFamilyShared(tx)) {
      if (hasLifetime(account)) return NextResponse.json({ lifetime: true })
      await prisma.account.updateMany({
        where: { id: userId, plan: { not: 'lifetime' } },
        data: { plan: 'lifetime', planSource: 'apple', planGrantedAt: new Date() },
      })
      console.log(`[apple verify] ${userId}: lifetime from a family-shared purchase`)
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

    // Clear the old binding BEFORE writing the new one (the column is unique).
    const [downgraded, unbound] = await prisma.$transaction([
      prisma.account.updateMany({
        where: { appleOriginalTransactionId: originalTransactionId, id: { not: userId }, planSource: 'apple' },
        data: { plan: 'free', planSource: null, planGrantedAt: null, appleOriginalTransactionId: null },
      }),
      prisma.account.updateMany({
        where: { appleOriginalTransactionId: originalTransactionId, id: { not: userId } },
        data: { appleOriginalTransactionId: null },
      }),
      prisma.account.update({
        where: { id: userId },
        data: {
          plan: 'lifetime',
          planSource: 'apple',
          planGrantedAt: new Date(),
          appleOriginalTransactionId: originalTransactionId,
        },
      }),
    ])
    const moved = downgraded.count + unbound.count > 0
    console.log(`[apple verify] ${userId}: lifetime from Apple${moved ? ' (moved from another account)' : ''}`)
    return NextResponse.json({ lifetime: true })
  } catch (err) {
    const authErr = authErrorResponse(err)
    if (authErr) return authErr
    console.error('[apple verify POST]', err)
    return NextResponse.json({ error: 'verify error' }, { status: 500 })
  }
}
