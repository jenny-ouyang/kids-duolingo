import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/db'
import { getAuthContext, authErrorResponse } from '@/lib/auth'
import { PAYMENTS_ENABLED, hasLifetime } from '@/lib/plan'

export const runtime = 'nodejs'

/**
 * POST /api/stripe/checkout
 * Creates a Stripe-hosted Checkout Session for the one-time lifetime unlock and
 * returns { url }. DORMANT by default: 404 unless NEXT_PUBLIC_PAYMENTS_ENABLED
 * is "true" AND Stripe env vars are configured.
 *
 * Guests CAN buy — their Account row persists and the purchase lands on it; a
 * metadata flag records that the buyer was still a guest at purchase time.
 */
export async function POST() {
  // Dormant: pretend this endpoint doesn't exist.
  const secretKey = process.env.STRIPE_SECRET_KEY
  const priceId = process.env.STRIPE_PRICE_ID
  if (!PAYMENTS_ENABLED || !secretKey || !priceId) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  try {
    const { userId } = await getAuthContext()

    const account = await prisma.account.findUnique({ where: { id: userId } })
    if (!account) {
      // getAuthContext provisions the row, so this should never happen.
      return NextResponse.json({ error: 'account not found' }, { status: 500 })
    }
    if (hasLifetime(account)) {
      return NextResponse.json({ error: 'already unlocked' }, { status: 409 })
    }

    const stripe = new Stripe(secretKey)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: 'https://mandarineer.com/unlock/thanks',
      cancel_url: 'https://mandarineer.com/unlock',
      // The webhook reads this to know WHICH account to upgrade.
      client_reference_id: userId,
      ...(account.email ? { customer_email: account.email } : {}),
      metadata: {
        accountId: userId,
        wasGuestAtPurchase: account.isGuest ? 'true' : 'false',
      },
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
