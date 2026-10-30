/**
 * Plan / payments — the single switch point for the payment layer.
 *
 * The switch is SERVER-SIDE ONLY: process.env.PAYMENTS_ENABLED === 'true'.
 * Never read it on the client — the iOS bundle is a static export and would
 * freeze the value at build time. Clients learn the state from the API
 * (`locked` on each pack in GET /api/packs, `paymentsEnabled` in GET /api/account).
 *
 * This module must stay safe to import from client components: no Prisma,
 * no next/server.
 */

/**
 * Founding period (Jenny, 2026-10-30): the home page sells $9.99 as the
 * founding price with every future pack and upgrade included. Every lifetime
 * purchase made while this is true gets isFounder, so the promise holds for
 * every buyer, not only FOUNDER-code buyers. Set false when the price goes up.
 */
export const FOUNDING_PERIOD = true

/** One-time purchase price shown in the Parent Zone (Stripe is the source of truth via STRIPE_PRICE_ID). */
export const LIFETIME_PRICE_DISPLAY = '$9.99'

/**
 * The free tier (spec 2026-10-13 §1): three Chinese packs, one math topic, and
 * the `sentences` practice mode (its CONTENT is filtered per source pack in
 * /api/sentences/all; the mode itself is always reachable).
 */
export const FREE_PACK_IDS = ['animals', 'colors', 'numbers', 'math_add_singles', 'sentences'] as const

const FREE_SET: ReadonlySet<string> = new Set(FREE_PACK_IDS)

export function isPackFree(packId: string): boolean {
  return FREE_SET.has(packId)
}

/** True when the account has purchased the one-time lifetime unlock. */
export function hasLifetime(account: { plan: string }): boolean {
  return account.plan === 'lifetime'
}

/** Server-side switch. Read at call time so tests and Vercel env changes take effect without a rebuild. */
export function paymentsEnabled(): boolean {
  return process.env.PAYMENTS_ENABLED === 'true'
}

/**
 * THE access rule. Every gated route and the pack list go through here.
 * Payments off → everything is open (today's behaviour).
 */
export function canAccessPack(account: { plan: string }, packId: string): boolean {
  if (!paymentsEnabled()) return true
  if (isPackFree(packId)) return true
  return hasLifetime(account)
}
