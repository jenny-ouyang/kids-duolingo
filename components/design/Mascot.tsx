'use client'

import { motion } from 'framer-motion'

/**
 * The panda guide (docs/design/DESIGN.md). Idle-bobs with a speech bubble.
 * Emoji rendering uses the emoji font stack for Windows/Android parity.
 */
export default function Mascot({
  say = '你好!',
  size = 74,
  className = '',
}: {
  say?: string | null
  size?: number
  className?: string
}) {
  return (
    <div className={`text-center relative z-10 ${className}`}>
      <span
        className="inline-block animate-bob font-emoji"
        style={{ fontSize: size, filter: 'drop-shadow(0 8px 14px #d9973c33)' }}
        role="img"
        aria-label="panda guide"
      >
        🐼
      </span>
      {say && (
        <span
          className="inline-block bg-white rounded-2xl rounded-bl px-3.5 py-1.5 font-bold text-sm relative -top-8 left-1.5"
          style={{ color: '#7A4F1D', boxShadow: '0 4px 0 #F5B93F' }}
        >
          {say}
        </span>
      )}
    </div>
  )
}

export type BuddyMood = 'idle' | 'yes' | 'listen'

/**
 * The small lesson panda (40 px) under the progress bar. It reacts to each
 * answer: a nod and 对了 on right, a head tilt and "Listen again" on wrong.
 * The motion is a rotate only, so Reduce Motion (MotionConfig) skips it and
 * the bubble words still carry the reaction.
 */
export function LessonBuddy({ mood, say }: { mood: BuddyMood; say?: string }) {
  const rotate = mood === 'yes' ? [0, 8, 0] : mood === 'listen' ? [0, -10, 0] : 0
  const bubble = say ?? (mood === 'yes' ? '对了!' : mood === 'listen' ? 'Listen again! 👂' : null)
  return (
    <div className="flex items-center gap-1.5 min-h-[48px]">
      <motion.span
        key={mood}
        role="img"
        aria-label="panda guide"
        className="inline-block font-emoji text-[40px] leading-none"
        animate={{ rotate }}
        transition={{ duration: mood === 'yes' ? 0.3 : 0.4, ease: 'easeInOut' }}
      >
        🐼
      </motion.span>
      {bubble && (
        <motion.span
          key={bubble}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          aria-live="polite"
          className={`inline-block bg-white rounded-2xl rounded-bl px-3 py-1 text-base font-bold ${
            mood === 'yes' ? 'font-hanzi text-lg' : ''
          }`}
          style={{ color: '#7A4F1D', boxShadow: '0 4px 0 #F5B93F' }}
        >
          {bubble}
        </motion.span>
      )}
    </div>
  )
}
