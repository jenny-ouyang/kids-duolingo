import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { APPLE_LIFETIME_PRODUCT_ID, isFamilyShared, verifyNotification, verifyTransaction } from '@/lib/apple-verify'
import { dropAppleIfNoBasis, familyKey, purchasedKey } from '@/lib/apple-grants'

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
 * - FAMILY_SHARED: only that family member's grant ends. The buyer's binding
 *   is never touched, because the notification may carry the buyer's
 *   originalTransactionId.
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
      if (familyTxId) {
        // A family member's copy. Never touch the buyer's binding: the
        // notification may carry the buyer's originalTransactionId.
        await db.appleRevocation.upsert({
          where: { key: familyKey(familyTxId) },
          create: { key: familyKey(familyTxId), notificationType: type },
          update: {},
        })
        const otidIsBuyers = (await db.account.count({ where: { appleOriginalTransactionId: otid } })) > 0
        const grants = await db.appleFamilyGrant.findMany({
          where: otidIsBuyers ? { transactionId: familyTxId } : { OR: [{ transactionId: familyTxId }, { originalTransactionId: otid }] },
          select: { transactionId: true, accountId: true },
        })
        for (const g of grants) {
          if (g.transactionId === familyTxId) continue
          await db.appleRevocation.upsert({
            where: { key: familyKey(g.transactionId) },
            create: { key: familyKey(g.transactionId), notificationType: type },
            update: {},
          })
        }
        await db.appleFamilyGrant.deleteMany({ where: { transactionId: { in: grants.map((g) => g.transactionId) } } })
        grants.forEach((g) => affected.add(g.accountId))
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
