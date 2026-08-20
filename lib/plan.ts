/**
 * Plan / payments — the single switch point for the (currently DORMANT) payment layer.
 *
 * While NEXT_PUBLIC_PAYMENTS_ENABLED is unset or anything other than the string
 * "true", nothing payment-related is user-visible: the /unlock page shows a
 * free-early-access state and /api/stripe/checkout returns 404.
 *
 * NOTE: gating of pack CONTENT is NOT enforced yet. Everything stays free until
 * this flag flips AND a future gating pass wires FREE_PACK_IDS /
 * FREE_MATH_TOPIC_NOTE into the question routes. Do not gate content anywhere
 * else — when that pass happens, it should import these consts from here.
 */

/** Safe on both server and client — NEXT_PUBLIC_ vars are inlined at build time. */
export const PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true'

/** One-time purchase price shown on /unlock (Stripe is the source of truth via STRIPE_PRICE_ID). */
export const LIFETIME_PRICE_DISPLAY = '$9.99'

/**
 * The generous free tier (launch-plan D3): these Chinese packs stay free forever.
 * NOT enforced yet — see the file comment above.
 */
export const FREE_PACK_IDS = ['animals', 'colors', 'numbers'] as const

/**
 * Free math tier note (launch-plan D3): math ships as a free SAMPLER — a taste of
 * each topic rather than whole topics locked away. The exact sampler shape is
 * decided in the future gating pass; recorded here so the decision lives at the
 * single switch point. NOT enforced yet.
 */
export const FREE_MATH_TOPIC_NOTE =
  'Math free tier is a sampler across topics, not a pack list — defined in the gating pass.'

/** True when the account has purchased the one-time lifetime unlock. */
export function hasLifetime(account: { plan: string }): boolean {
  return account.plan === 'lifetime'
}
