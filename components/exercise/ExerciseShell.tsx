'use client'

import { motion } from 'framer-motion'

interface ExerciseShellProps {
  current: number
  total: number
  children: React.ReactNode
}

export default function ExerciseShell({ current, total, children }: ExerciseShellProps) {
  const progress = (current / total) * 100

  return (
    <div className="w-full max-w-2xl flex flex-col gap-6">
      {/* Progress bar — white track, gold→coral fill, 🏮 riding the tip */}
      <div className="w-full bg-white rounded-full h-5 shadow-press-card">
        <motion.div
          className="relative h-full rounded-full bg-gradient-to-r from-gold to-chinese min-w-[24px]"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <span
            aria-hidden
            className="font-emoji absolute -right-2 -top-3.5 text-2xl leading-none select-none"
          >
            🏮
          </span>
        </motion.div>
      </div>

      {/* Question counter chip */}
      <div className="self-center bg-white rounded-full px-5 py-1.5 shadow-press-chip text-sm font-extrabold text-ink tracking-wide">
        {current} / {total}
      </div>

      {children}
    </div>
  )
}
