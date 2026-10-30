/**
 * Apple grant bookkeeping shared by /api/apple/verify and
 * /api/apple/notifications. Server only.
 *
 * An account's Apple unlock rests on one of two bases:
 * - Account.appleOriginalTransactionId: the parent's own purchase (PURCHASED);
 * - AppleFamilyGrant rows: family-shared copies, one per family transactionId.
 * When the last basis goes, an Apple-sourced plan goes back to free.
 */
import type { Prisma } from '@/lib/generated/prisma'

export type Db = Prisma.TransactionClient

/** Revocation keys (AppleRevocation.key). */
export const purchasedKey = (originalTransactionId: string) => `purchased:${originalTransactionId}`
export const familyKey = (transactionId: string) => `family:${transactionId}`

/** Downgrades an Apple-sourced account that has no Apple basis left. Stripe / manual plans are never touched. */
export async function dropAppleIfNoBasis(db: Db, accountId: string): Promise<boolean> {
  const acct = await db.account.findUnique({
    where: { id: accountId },
    select: { planSource: true, appleOriginalTransactionId: true, _count: { select: { appleFamilyGrants: true } } },
  })
  if (!acct || acct.planSource !== 'apple' || acct.appleOriginalTransactionId || acct._count.appleFamilyGrants > 0) {
    return false
  }
  await db.account.update({
    where: { id: accountId },
    data: { plan: 'free', planSource: null, planGrantedAt: null, appleEnvironment: null },
  })
  return true
}
