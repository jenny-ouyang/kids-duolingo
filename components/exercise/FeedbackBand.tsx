'use client'

import { ReactNode, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

/**
 * After-answer feedback shared by every lesson (picture, sentence, math).
 * Right: a teal sheet fixed to the bottom, in thumb reach, with the answer and
 * a Next button — the child moves on when ready, never on a timer.
 * Not quite: a white card in the flow under the tiles, so it never covers the
 * tile the child still has to find. Wrong is never red (DESIGN.md).
 */
export function RightBand({
  title,
  children,
  onNext,
  nextLabel = 'Next',
}: {
  title: string
  children?: ReactNode
  onNext: () => void
  nextLabel?: string
}) {
  const nextRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <motion.section
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: 48 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className="fixed inset-x-0 bottom-0 z-30 bg-success-bg rounded-t-[26px] shadow-[0_-4px_0_#BFE9D8]"
    >
      <div className="mx-auto w-full max-w-md flex flex-col gap-3 px-4 pt-4 pb-[max(22px,env(safe-area-inset-bottom))]">
        <h2 className="flex items-center gap-2 text-[22px] font-extrabold text-success-edge">
          <span
            aria-hidden
            className="w-[30px] h-[30px] rounded-full bg-go text-white text-lg flex items-center justify-center"
          >
            ✓
          </span>
          {title}
        </h2>
        {children}
        <button
          ref={nextRef}
          onClick={onNext}
          className="pressable w-full min-h-[60px] rounded-[22px] bg-go text-white text-xl font-extrabold shadow-press-go"
        >
          {nextLabel}
        </button>
      </div>
    </motion.section>
  )
}

export function NotQuiteBand({ reason, children }: { reason: string; children?: ReactNode }) {
  return (
    <motion.section
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full bg-white rounded-[22px] shadow-press-card px-4 py-3.5 flex flex-col gap-2.5"
    >
      <h2 className="text-[22px] font-extrabold text-ink">
        Not quite <span className="font-emoji">👂</span>
      </h2>
      <p className="text-base font-bold text-ink-mid">{reason}</p>
      {children}
    </motion.section>
  )
}

/** Big gold 🔊 button used inside the bands (gold is decoration; the label says what it does) */
export function SayAgainButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="pressable min-h-[56px] rounded-[18px] bg-gold text-ink shadow-press-gold px-5 flex items-center justify-center gap-2 text-xl font-extrabold"
    >
      <span className="font-emoji">🔊</span>
      {children}
    </button>
  )
}

/** Answer row for the right band: hanzi, pinyin, English, and a small 🔊 */
export function AnswerRow({
  chinese,
  pinyin,
  english,
  onSpeak,
}: {
  chinese: string
  pinyin?: string
  english?: string
  onSpeak?: () => void
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="font-hanzi text-[30px] leading-none text-ink">{chinese}</span>
      {pinyin && <span className="font-pinyin text-lg font-bold text-chinese-edge">{pinyin}</span>}
      {english && <span className="text-base font-bold text-ink-mid">{english}</span>}
      {onSpeak && (
        <button
          onClick={onSpeak}
          aria-label={`Hear ${chinese} again`}
          className="pressable ml-auto min-w-[56px] min-h-[48px] rounded-2xl bg-gold shadow-press-gold flex items-center justify-center"
        >
          <span className="font-emoji text-xl">🔊</span>
        </button>
      )}
    </div>
  )
}

/** What a lesson tells its page after a tap: the panda's reaction and, on a heart, where it flies from */
export interface LessonFeedback {
  mood: 'yes' | 'listen'
  earnsHeart?: boolean
  from?: DOMRect
}
