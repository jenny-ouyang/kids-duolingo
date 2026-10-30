import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { APPLE_LIFETIME_PRODUCT_ID, isFamilyShared, verifyNotification, verifyTransaction } from '@/lib/apple-verify'
import { dropAppleIfNoBasis, familyKey, lockPurchase, purchasedKey } from '@/lib/apple-grants'

export const runtime = 'nodejs'

/**
 * POST /api/apple/notifications — App Store Server Notifications V2.
 * Body: { signedPayload }. NEVER trusts the body without verifying the
 * signature against Apple's root certificates (lib/apple-verify.ts).
 *
 * Every REFUND / REVOKE for our product is recorded in AppleRevocation so
 * /api/apple/verify refuses the old signed transaction (a JWS signed before
 * a refund carries no revocationDate).
 * - PURCHASED (the buyer's own copy): the buyer account loses the Apple
 *   binding, every family-shared copy of that purchase is ended, and each
 *   affected account goes back to free if its plan came from Apple and it has
 *   no other Apple basis. Stripe / manual plans are never touched.
 * - FAMILY_SHARED: only the grant with that notification's transactionId
 *   ends. No fan-out by originalTransactionId and no 'purchased:' record:
 *   the id may be the buyer's, and other family members keep their copies.
 * Both routes take pg_advisory_xact_lock on the originalTransactionId first
 * (lib/apple-grants.ts lockPurchase), so verify and a refund never interleave.
 * - TEST and every other type: acknowledged (200) and ignored.
 *
 * A DB failure returns 500 so Apple retries. Idempotent: a second delivery
 * finds nothing left to change.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { signedPayload?: unknown } | null
  const signedPayload = typeof body?.signedPayload === 'string' ? body.signedPayload : null
  if (!signedPayload) {
    return NextResponse.json({ error: 'missing signedPayload' }, { status: 400 })
  }

  let notification
  try {
    notification = await verifyNotification(signedPayload)
  } catch (err) {
    console.error('[apple notifications] verification failed', err)
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  const type = notification.notificationType
  if (type !== 'REFUND' && type !== 'REVOKE') {
    console.log(`[apple notifications] ${type ?? 'unknown'}: acknowledged`)
    return NextResponse.json({ received: true })
  }

  const signedTx = notification.data?.signedTransactionInfo
  if (!signedTx) {
    console.error(`[apple notifications] ${type} without signedTransactionInfo`)
    return NextResponse.json({ received: true })
  }

  let tx
  try {
    tx = await verifyTransaction(signedTx)
  } catch (err) {
    console.error(`[apple notifications] ${type}: transaction verification failed`, err)
    return NextResponse.json({ error: 'invalid transaction' }, { status: 400 })
  }

  if (tx.productId !== APPLE_LIFETIME_PRODUCT_ID || !tx.originalTransactionId) {
    return NextResponse.json({ received: true })
  }
  const otid = tx.originalTransactionId
  const familyTxId = isFamilyShared(tx) ? tx.transactionId : undefined
  if (isFamilyShared(tx) && !familyTxId) {
    return NextResponse.json({ received: true })
  }

  try {
    const downgraded = await prisma.$transaction(async (db) => {
      const affected = new Set<string>()
      // Same lock as /api/apple/verify, taken before anything is recorded.
      await lockPurchase(db, otid)
      if (familyTxId) {
        // One family member's copy: end ONLY the grant with this transactionId.
        // Never fan out by originalTransactionId and never record it as
        // revoked: it may be the buyer's, and other members keep their copies.
        await db.appleRevocation.upsert({
          where: { key: familyKey(familyTxId) },
          create: { key: familyKey(familyTxId), notificationType: type },
          update: {},
        })
        const grant = await db.appleFamilyGrant.findUnique({ where: { transactionId: familyTxId } })
        if (grant) {
          await db.appleFamilyGrant.deleteMany({ where: { transactionId: familyTxId } })
          affected.add(grant.accountId)
        }
      } else {
        // The buyer's own purchase: record it so the old JWS cannot be
        // replayed, unbind the buyer, and end every family-shared copy of it.
        await db.appleRevocation.upsert({
          where: { key: purchasedKey(otid) },
          create: { key: purchasedKey(otid), notificationType: type },
          update: {},
        })
        const bound = await db.account.findMany({ where: { appleOriginalTransactionId: otid }, select: { id: true } })
        await db.account.updateMany({ where: { appleOriginalTransactionId: otid }, data: { appleOriginalTransactionId: null } })
        bound.forEach((a) => affected.add(a.id))
        const grants = await db.appleFamilyGrant.findMany({
          where: { originalTransactionId: otid },
          select: { transactionId: true, accountId: true },
        })
        for (const g of grants) {
          await db.appleRevocation.upsert({
            where: { key: familyKey(g.transactionId) },
            create: { key: familyKey(g.transactionId), notificationType: type },
            update: {},
          })
        }
        await db.appleFamilyGrant.deleteMany({ where: { originalTransactionId: otid } })
        grants.forEach((g) => affected.add(g.accountId))
      }
      let count = 0
      for (const id of Array.from(affected)) if (await dropAppleIfNoBasis(db, id)) count++
      return count
    })
    console.log(`[apple notifications] ${type}${familyTxId ? ' (family copy)' : ''}: ${downgraded} account(s) back to free`)
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[apple notifications POST]', err)
    return NextResponse.json({ error: 'notification handler error' }, { status: 500 })
  }
}
