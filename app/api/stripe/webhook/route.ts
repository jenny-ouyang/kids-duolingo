import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/db'
import { FOUNDING_PERIOD } from '@/lib/plan'

export const runtime = 'nodejs'

/** The founder promotion code (spec 2026-10-13 §1); compared case-insensitively */
const FOUNDER_CODE = 'FOUNDER'

/**
 * POST /api/stripe/webhook
 * Stripe webhook endpoint. NEVER trusts the body without a verified signature
 * (constructEvent over the raw text body).
 * - checkout.session.completed: the buyer's Account becomes lifetime, with
 *   planSource 'stripe', the session and payment intent ids, and isFounder
 *   when the FOUNDER promotion code was applied (detected by code, never by
 *   amount — spec 2026-10-13 §5).
 * - charge.refunded (full refund only): a Stripe-sourced plan goes back to
 *   free. isFounder is kept. A partial refund, or a plan from Apple or a
 *   manual grant, is left alone.
 *
 * Idempotent: a second delivery finds the plan already set and changes
 * nothing, so Stripe retries and duplicates are safe. Intentionally NOT gated on
 * PAYMENTS_ENABLED — a purchase completed moments before the flag
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
    event = new Stripe(secretKey).webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    console.error('[stripe webhook] signature verification failed', err)
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  try {
    const stripe = new Stripe(secretKey)

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const accountId = session.client_reference_id

      if (!accountId) {
        // Our checkout route always sets client_reference_id; log and ack so
        // Stripe doesn't retry a session we can't ever attribute.
        console.error('[stripe webhook] completed session without client_reference_id', session.id)
        return NextResponse.json({ received: true })
      }
      if (session.payment_status !== 'paid') {
        console.log(`[stripe webhook] ${accountId}: session ${session.id} not paid (${session.payment_status})`)
        return NextResponse.json({ received: true })
      }

      // The event body does not carry the promotion code's text; read it back.
      const full = await stripe.checkout.sessions.retrieve(session.id, { expand: ['discounts.promotion_code'] })
      const isFounder = (full.discounts ?? []).some(
        (d) => typeof d.promotion_code === 'object' && d.promotion_code?.code?.toUpperCase() === FOUNDER_CODE
      )
      const paymentIntentId =
        typeof full.payment_intent === 'string' ? full.payment_intent : full.payment_intent?.id ?? null

      // updateMany: no-throw if the account row is gone, no-op if already lifetime.
      const result = await prisma.account.updateMany({
        where: { id: accountId, plan: { not: 'lifetime' } },
        data: {
          plan: 'lifetime',
          planSource: 'stripe',
          planGrantedAt: new Date(),
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
          ...(isFounder || FOUNDING_PERIOD ? { isFounder: true } : {}),
        },
      })
      if (result.count === 0) {
        console.log(`[stripe webhook] ${accountId}: already lifetime or missing (session ${session.id})`)
      } else {
        console.log(`[stripe webhook] ${accountId}: upgraded to lifetime (session ${session.id}${isFounder ? ', founder' : ''})`)
      }
    }

    if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge
      const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
      // Full refund only: a partial refund keeps the unlock
      if (!paymentIntentId || !charge.refunded || charge.amount_refunded < charge.amount) {
        return NextResponse.json({ received: true })
      }
      const result = await prisma.account.updateMany({
        where: { stripePaymentIntentId: paymentIntentId, planSource: 'stripe' },
        data: { plan: 'free', planSource: null, planGrantedAt: null },
      })
      console.log(`[stripe webhook] refund ${paymentIntentId}: ${result.count} account(s) back to free`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    // 500 so Stripe retries — the signature was valid, the DB write failed.
    console.error('[stripe webhook POST]', err)
    return NextResponse.json({ error: 'webhook handler error' }, { status: 500 })
  }
}
