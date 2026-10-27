import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/db'
import { getAuthContext, authErrorResponse } from '@/lib/auth'
import { paymentsEnabled, hasLifetime } from '@/lib/plan'

export const runtime = 'nodejs'

/**
 * POST /api/stripe/checkout
 * Creates a Stripe-hosted Checkout Session for the one-time lifetime unlock and
 * returns { url }. DORMANT by default: 404 unless PAYMENTS_ENABLED
 * is "true" AND Stripe env vars are configured.
 *
 * One open session per account: the session id is stored on the Account, and a
 * still-open session is reused instead of creating a second one. New sessions
 * expire after 30 minutes (Stripe's minimum). Promotion codes are allowed.
 *
 * Guests must claim the account (add an email) before buying — see the 403 below.
 */
export async function POST() {
  // Dormant: pretend this endpoint doesn't exist.
  const secretKey = process.env.STRIPE_SECRET_KEY
  const priceId = process.env.STRIPE_PRICE_ID
  if (!paymentsEnabled() || !secretKey || !priceId) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  try {
    const { userId, account } = await getAuthContext()
    if (hasLifetime(account)) {
      return NextResponse.json({ error: 'already unlocked' }, { status: 409 })
    }
    if (account.isGuest) {
      // Email is the only way to restore a web purchase on a new device
      // (spec 2026-10-13 §7 rule 6). The Parent Zone card asks for it first.
      return NextResponse.json({ error: 'claim-first' }, { status: 403 })
    }

    const stripe = new Stripe(secretKey)

    if (account.stripeCheckoutSessionId) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(account.stripeCheckoutSessionId)
        if (existing.status === 'open' && existing.url) {
          return NextResponse.json({ url: existing.url })
        }
      } catch {
        // Could not look up the old session: fall through and create a new one.
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: 'https://mandarineer.com/unlock/thanks',
      cancel_url: 'https://mandarineer.com/unlock',
      allow_promotion_codes: true,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      // The webhook reads this to know WHICH account to upgrade.
      client_reference_id: userId,
      ...(account.email ? { customer_email: account.email } : {}),
      metadata: {
        accountId: userId,
      },
    })

    await prisma.account.update({
      where: { id: userId },
      data: { stripeCheckoutSessionId: session.id },
    })

    if (!session.url) {
      return NextResponse.json({ error: 'no checkout url' }, { status: 500 })
    }
    return NextResponse.json({ url: session.url })
  } catch (err) {
    const authErr = authErrorResponse(err)
    if (authErr) return authErr
    console.error('[stripe checkout POST]', err)
    return NextResponse.json({ error: 'checkout error' }, { status: 500 })
  }
}
