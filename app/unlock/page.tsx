'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { fetchJsonWithAuthRetry } from '@/lib/api-fetch'
import { PAYMENTS_ENABLED, LIFETIME_PRICE_DISPLAY } from '@/lib/plan'

/* Calm variant of Sunrise Playground (parent-facing): same palette, warm ink,
   press physics — no mascot, no hills, no sparkles (per DESIGN.md). */

const INCLUDED = [
  { emoji: '📚', text: 'All 13 Chinese vocabulary packs' },
  { emoji: '💬', text: 'Sentence building practice' },
  { emoji: '➕', text: 'Every math topic' },
  { emoji: '🎁', text: 'All future packs and features' },
  { emoji: '👧', text: 'Every child in your family' },
  { emoji: '♾️', text: 'Forever — pay once, keep it always' },
]

function Header() {
  return (
    <div className="flex items-center gap-4">
      <Link
        href="/parent"
        aria-label="Back to the parent zone"
        className="pressable bg-white rounded-2xl w-14 h-14 flex items-center justify-center text-2xl text-ink shadow-press-chip flex-shrink-0"
      >
        ←
      </Link>
      <div>
        <h1 className="text-[27px] font-extrabold text-ink leading-tight">Unlock everything</h1>
        <p className="text-ink-soft text-sm font-bold">One purchase for the whole family</p>
      </div>
    </div>
  )
}

function FreeEarlyAccess() {
  return (
    <div className="min-h-screen bg-canvas-top">
      <div className="max-w-2xl mx-auto p-6 flex flex-col gap-8">
        <Header />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[26px] p-8 shadow-press-card text-center"
        >
          <div className="font-emoji text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-extrabold text-ink">
            Everything is free during early access!
          </h2>
          <p className="text-ink-soft text-sm font-bold mt-2 max-w-md mx-auto">
            All packs, sentences, and math topics are open for every family right now.
            Nothing to buy — go practice!
          </p>
          <Link
            href="/"
            className="pressable inline-flex items-center justify-center min-h-[56px] bg-success text-white rounded-2xl px-8 mt-6 text-[15px] font-extrabold shadow-press-success"
          >
            Back to the app
          </Link>
        </motion.div>
      </div>
    </div>
  )
}

export default function UnlockPage() {
  const [buying, setBuying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!PAYMENTS_ENABLED) return <FreeEarlyAccess />

  async function handleBuy() {
    if (buying) return
    setBuying(true)
    setError(null)
    const { ok, data } = await fetchJsonWithAuthRetry<{ url?: string; error?: string }>(
      '/api/stripe/checkout',
      { method: 'POST' }
    )
    if (ok && data?.url) {
      window.location.assign(data.url)
      return
    }
    setError(
      data?.error === 'already unlocked'
        ? 'Good news — this family already has everything unlocked!'
        : "We couldn't start the checkout. Please try again in a moment."
    )
    setBuying(false)
  }

  return (
    <div className="min-h-screen bg-canvas-top">
      <div className="max-w-2xl mx-auto p-6 flex flex-col gap-8">
        <Header />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[26px] p-6 sm:p-8 shadow-press-card flex flex-col gap-6"
        >
          <div>
            <h2 className="text-lg font-extrabold text-ink">What&apos;s included</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {INCLUDED.map((item) => (
                <li key={item.text} className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-2xl bg-success-bg flex items-center justify-center flex-shrink-0">
                    <span className="font-emoji text-lg leading-none">{item.emoji}</span>
                  </span>
                  <span className="text-[15px] font-bold text-ink">{item.text}</span>
                  <span aria-hidden className="ml-auto text-success font-extrabold">
                    ✓
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {error && (
            <div className="bg-chip-track rounded-2xl px-4 py-3 text-ink text-sm font-bold">
              {error}
            </div>
          )}

          <div className="flex flex-col items-center gap-3">
            <button
              onClick={handleBuy}
              disabled={buying}
              className="pressable w-full min-h-[64px] bg-success text-white rounded-[22px] px-6 text-lg font-extrabold shadow-press-success disabled:opacity-50"
            >
              {buying ? 'Opening checkout…' : `Unlock everything — ${LIFETIME_PRICE_DISPLAY}`}
            </button>
            <p className="text-ink-soft text-sm font-bold">
              One-time purchase · No subscription
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
