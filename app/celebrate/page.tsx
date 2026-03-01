'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import KidLayout from '@/components/layout/KidLayout'
import Confetti from '@/components/celebration/Confetti'
import { speakChinese } from '@/lib/tts'
import { playCelebrationSound, playStarSound } from '@/lib/sounds'
import { getEncouragement, SessionData, Encouragement } from '@/lib/encouragement'

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

  const [enc, setEnc] = useState<Encouragement | null>(null)

  useEffect(() => {
    let sessionData: SessionData = {
      packId,
      packName: packId,
      subject,
      correctWords: [],
    }
    try {
      const raw = sessionStorage.getItem('lastSession')
      if (raw) {
        const parsed = JSON.parse(raw) as SessionData
        sessionData = { ...sessionData, ...parsed }
        sessionStorage.removeItem('lastSession')
      }
    } catch { /* sessionStorage unavailable */ }

    const encouragement = getEncouragement({
      ...sessionData,
      correct,
      total,
      hearts: heartsEarned,
    })
    setEnc(encouragement)

    playCelebrationSound()
    Array.from({ length: stars }).forEach((_, i) => {
      playStarSound(300 + i * 150)
    })

    setTimeout(() => {
      speakChinese(encouragement.chinesePhrase)
    }, 1200)
  }, [packId, subject, correct, total, heartsEarned, stars])

  if (!enc) return null

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
        className="flex flex-col items-center gap-5 text-center px-4"
      >
        {/* Big animated emoji */}
        <motion.div
          animate={{ rotate: [0, -10, 10, -10, 0] }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-8xl"
        >
          {enc.emoji}
        </motion.div>

        {/* Varied heading */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-3xl sm:text-4xl font-extrabold text-blue-700"
        >
          {enc.heading}
        </motion.h1>

        {/* Chinese praise phrase — teaches through encouragement */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-white/80 rounded-2xl px-6 py-3 shadow-sm border border-blue-100"
        >
          <button
            onClick={() => speakChinese(enc.chinesePhrase)}
            className="flex flex-col items-center gap-1 cursor-pointer"
          >
            <span className="text-3xl font-bold text-blue-700">{enc.chinesePhrase}</span>
            <span className="text-sm text-gray-400">{enc.chinesePinyin}</span>
            <span className="text-sm text-gray-500 italic">{enc.chineseMeaning} 🔊</span>
          </button>
        </motion.div>

        {/* Score */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-xl font-semibold text-gray-500"
        >
          {enc.subMessage}
        </motion.p>

        {/* Stars */}
        <div className="flex gap-2">{starRow}</div>

        {/* Hearts earned */}
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

        {/* Word spotlight — highlights a specific word Julian mastered */}
        {enc.spotlightWord && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
            className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-2xl px-5 py-3 max-w-sm"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">💡</span>
              <span className="font-bold text-amber-700">Word Spotlight</span>
            </div>
            <p className="text-gray-700 text-sm">{enc.spotlightWord.message}</p>
          </motion.div>
        )}

        {/* Real-life mission */}
        {enc.mission && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl px-5 py-3 max-w-sm"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🎯</span>
              <span className="font-bold text-emerald-700">Today&apos;s Mission</span>
            </div>
            <p className="text-gray-700 text-sm">{enc.mission}</p>
          </motion.div>
        )}

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4 }}
          className="flex flex-col gap-3 mt-2 w-full max-w-xs"
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
