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
      {/* Progress bar */}
      <div className="w-full bg-white/60 rounded-full h-5 shadow-inner overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-orange-400"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* Question counter */}
      <div className="text-center text-lg font-bold text-blue-400 tracking-wide">
        {current} / {total}
      </div>

      {children}
    </div>
  )
}
