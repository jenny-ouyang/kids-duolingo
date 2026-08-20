import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * POST /api/stripe/webhook
 * Stripe webhook endpoint. NEVER trusts the body without a verified signature
 * (constructEvent over the raw text body). On checkout.session.completed it
 * flips the buyer's Account.plan to "lifetime".
 *
 * Idempotent: setting plan="lifetime" twice is a no-op, so Stripe retries and
 * duplicate deliveries are safe. Intentionally NOT gated on
 * NEXT_PUBLIC_PAYMENTS_ENABLED — a purchase completed moments before the flag
 * flipped off must still be recorded; without STRIPE_WEBHOOK_SECRET the route
 * is inert (404).
 */
export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secretKey || !webhookSecret) {
    // Dormant: Stripe isn't configured, pretend this endpoint doesn't exist.
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'missing signature' }, { status: 400 })
  }

  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    const stripe = new Stripe(secretKey)
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    console.error('[stripe webhook] signature verification failed', err)
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const accountId = session.client_reference_id

      if (!accountId) {
        // Our checkout route always sets client_reference_id; log and ack so
        // Stripe doesn't retry a session we can't ever attribute.
        console.error('[stripe webhook] completed session without client_reference_id', session.id)
        return NextResponse.json({ received: true })
      }

      // updateMany: no-throw if the account row is gone, no-op if already lifetime.
      const result = await prisma.account.updateMany({
        where: { id: accountId, plan: { not: 'lifetime' } },
        data: { plan: 'lifetime' },
      })
      if (result.count === 0) {
        console.log(`[stripe webhook] ${accountId}: already lifetime or missing (session ${session.id})`)
      } else {
        console.log(`[stripe webhook] ${accountId}: upgraded to lifetime (session ${session.id})`)
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    // 500 so Stripe retries — the signature was valid, the DB write failed.
    console.error('[stripe webhook POST]', err)
    return NextResponse.json({ error: 'webhook handler error' }, { status: 500 })
  }
}
