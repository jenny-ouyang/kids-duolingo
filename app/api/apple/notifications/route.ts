import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { APPLE_LIFETIME_PRODUCT_ID, isFamilyShared, verifyNotification, verifyTransaction } from '@/lib/apple-verify'

export const runtime = 'nodejs'

/**
 * POST /api/apple/notifications — App Store Server Notifications V2.
 * Body: { signedPayload }. NEVER trusts the body without verifying the
 * signature against Apple's root certificates (lib/apple-verify.ts).
 *
 * - REFUND or REVOKE for our product, PURCHASED (the buyer's own copy): the
 *   account bound to that originalTransactionId goes back to free and loses
 *   the Apple binding, but only when its plan came from Apple. A Stripe or
 *   manual plan is left alone.
 * - FAMILY_SHARED transactions are acknowledged and ignored. A REVOKE for a
 *   family member's copy carries the BUYER's originalTransactionId, so acting
 *   on it would lock out the parent who paid. What happens to family members
 *   after a refund is an open decision (checklist, Phase C).
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
  if (isFamilyShared(tx)) {
    console.log(`[apple notifications] ${type} for a family-shared copy: ignored (open decision)`)
    return NextResponse.json({ received: true })
  }

  try {
    const result = await prisma.account.updateMany({
      where: { appleOriginalTransactionId: tx.originalTransactionId, planSource: 'apple' },
      data: { plan: 'free', planSource: null, planGrantedAt: null, appleOriginalTransactionId: null },
    })
    console.log(`[apple notifications] ${type}: ${result.count} account(s) back to free`)
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[apple notifications POST]', err)
    return NextResponse.json({ error: 'notification handler error' }, { status: 500 })
  }
}
