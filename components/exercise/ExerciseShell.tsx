'use client'

import { Ref } from 'react'
import { motion } from 'framer-motion'
import { LessonBuddy, BuddyMood } from '@/components/design/Mascot'

interface ExerciseShellProps {
  current: number
  total: number
  /** Hearts earned in this lesson so far (shown in the chip, the heart flight target) */
  hearts: number
  heartChipRef?: Ref<HTMLSpanElement>
  onClose: () => void
  closeLabel: string
  /** "Where am I" line, e.g. the pack name */
  where: React.ReactNode
  /** Optional control on the where row (e.g. the pinyin toggle) */
  headerAction?: React.ReactNode
  mood: BuddyMood
  /** Overrides the panda's default bubble for the current mood */
  buddySay?: string
  children: React.ReactNode
}

/**
 * Lesson frame: one top row (✕, progress bar with the 🏮, hearts earned), the
 * where line with the pīn toggle, and the small panda that reacts to answers.
 * The question count lives in the right band ("Right! 2 of 8").
 */
export default function ExerciseShell({
  current,
  total,
  hearts,
  heartChipRef,
  onClose,
  closeLabel,
  where,
  headerAction,
  mood,
  buddySay,
  children,
}: ExerciseShellProps) {
  const progress = ((current - 1) / total) * 100

  return (
    <div className="w-full max-w-md flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button
          onClick={onClose}
          aria-label={closeLabel}
          className="pressable bg-white rounded-2xl w-14 h-14 shrink-0 flex items-center justify-center text-2xl font-extrabold text-ink shadow-press-chip"
        >
          ✕
        </button>
        {/* Progress bar — white track, gold→coral fill, 🏮 riding the tip */}
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={current - 1}
          aria-label={`${current - 1} of ${total} done`}
          className="flex-1 bg-white rounded-full h-5 shadow-press-card"
        >
          <motion.div
            className="relative h-full rounded-full bg-gradient-to-r from-gold to-chinese min-w-[24px]"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <span aria-hidden className="font-emoji absolute -right-2 -top-3.5 text-2xl leading-none select-none">
              🏮
            </span>
          </motion.div>
        </div>
        <span
          ref={heartChipRef}
          aria-label={`${hearts} heart${hearts === 1 ? '' : 's'} earned in this lesson`}
          className="shrink-0 bg-white rounded-full px-3 py-1.5 shadow-press-chip flex items-center gap-1 text-lg font-extrabold text-ink tabular-nums"
        >
          <span className="font-emoji" aria-hidden>❤️</span>
          {hearts}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 min-h-[44px]">
        <p className="text-base font-bold text-ink-mid truncate">{where}</p>
        {headerAction}
      </div>

      <LessonBuddy mood={mood} say={buddySay} />

      {children}
    </div>
  )
}
