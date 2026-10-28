'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

/**
 * Shown when a child taps a locked pack or a session route answers 402.
 * No price, no buy button, no external link — the only way forward is the
 * Parent Zone, which sits behind the grown-ups gate (spec 2026-10-13 §4).
 */
export default function AskGrownUp({ onClose }: { onClose?: () => void }) {
  const router = useRouter()
  return (
    <motion.div
      role="dialog"
      aria-label="Ask a grown-up to unlock"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-sm bg-white rounded-[26px] p-6 shadow-press-card flex flex-col items-center text-center gap-3"
    >
      <span className="font-emoji text-6xl" aria-hidden>🐼</span>
      <p className="text-2xl font-extrabold text-ink leading-tight">
        Ask a grown-up to unlock <span className="font-emoji">🔒</span>
      </p>
      <p className="text-base font-bold text-ink-mid">It&apos;s waiting for you!</p>
      <button
        onClick={() => router.push('/parent')}
        className="pressable w-full min-h-[56px] bg-go text-white rounded-2xl px-6 text-lg font-extrabold shadow-press-go mt-2"
      >
        Grown-ups
      </button>
      {onClose && (
        <button
          onClick={onClose}
          className="pressable w-full min-h-[48px] bg-canvas-top text-ink-mid rounded-2xl px-6 text-base font-extrabold shadow-press-chip"
        >
          Back
        </button>
      )}
    </motion.div>
  )
}
