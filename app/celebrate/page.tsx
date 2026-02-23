'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import KidLayout from '@/components/layout/KidLayout'
import Confetti from '@/components/celebration/Confetti'
import { speakChinese } from '@/lib/tts'
import { playCelebrationSound, playStarSound } from '@/lib/sounds'

function CelebrationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const subject = searchParams.get('subject') ?? 'chinese'
  const packId = searchParams.get('pack') ?? 'animals'
  const correct = Number(searchParams.get('correct') ?? 0)
  const total = Number(searchParams.get('total') ?? 8)
  const heartsEarned = Number(searchParams.get('hearts') ?? 0)

  const backHref = subject === 'math' ? '/math/topics' : '/packs'
  const playAgainHref = subject === 'math' ? `/math/practice/${packId}` : `/practice/${packId}`

  const allCorrect = correct === total
  const stars = correct <= 2 ? 1 : correct <= 5 ? 2 : correct <= 7 ? 3 : 4

  useEffect(() => {
    playCelebrationSound()

    Array.from({ length: stars }).forEach((_, i) => {
      playStarSound(300 + i * 150)
    })

    setTimeout(() => {
      speakChinese(allCorrect ? '太棒了！' : '很好！继续努力！')
    }, 1200)
  }, [allCorrect, stars])

  const starRow = Array.from({ length: stars }, (_, i) => (
    <motion.span
      key={i}
      initial={{ scale: 0, rotate: -30 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ delay: 0.3 + i * 0.15, type: 'spring', stiffness: 300 }}
      className="text-5xl"
    >
      ⭐
    </motion.span>
  ))

  return (
    <>
      <Confetti count={allCorrect ? 80 : 40} />

      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
        className="flex flex-col items-center gap-6 text-center"
      >
        <motion.div
          animate={{ rotate: [0, -10, 10, -10, 0] }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-8xl"
        >
          {allCorrect ? '🏆' : '🎉'}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-4xl font-extrabold text-blue-700"
        >
          {allCorrect ? 'Perfect!' : 'Great job, Julian!'}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-2xl font-semibold text-gray-500"
        >
          {correct} out of {total} ✨
        </motion.p>

        <div className="flex gap-2">{starRow}</div>

        {/* Hearts earned this session */}
        {heartsEarned > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, type: 'spring', stiffness: 250 }}
            className="bg-red-50 border-2 border-red-200 rounded-3xl px-6 py-3 flex items-center gap-3"
          >
            <span className="text-3xl">❤️</span>
            <span className="text-xl font-bold text-red-500">
              +{heartsEarned} heart{heartsEarned !== 1 ? 's' : ''} earned!
            </span>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="flex flex-col gap-3 mt-4 w-full max-w-xs"
        >
          <button
            onClick={() => router.push(playAgainHref)}
            className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white font-extrabold text-xl rounded-3xl py-4 px-8 shadow-lg hover:scale-105 active:scale-95 transition-transform"
          >
            Play Again 🔄
          </button>
          <button
            onClick={() => router.push(backHref)}
            className="bg-white border-2 border-blue-300 text-blue-600 font-bold text-lg rounded-3xl py-3 px-8 hover:bg-blue-50 transition-colors"
          >
            {subject === 'math' ? 'Pick Another Topic' : 'Pick Another Pack'}
          </button>
        </motion.div>
      </motion.div>
    </>
  )
}

export default function CelebratePage() {
  return (
    <KidLayout>
      <Suspense fallback={<div className="text-4xl animate-spin">🌟</div>}>
        <CelebrationContent />
      </Suspense>
    </KidLayout>
  )
}
