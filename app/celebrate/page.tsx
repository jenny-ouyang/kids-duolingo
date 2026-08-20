'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import Confetti from '@/components/celebration/Confetti'
import Mascot from '@/components/design/Mascot'
import { Hills, Sparkles } from '@/components/design/Scenery'
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
  const isMath = subject === 'math'

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
      className="font-emoji text-5xl"
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
        className="relative z-10 flex flex-col items-center gap-5 text-center px-4"
      >
        {/* Panda guide celebrates */}
        <Mascot say="太棒了!" size={76} />

        {/* Varied heading */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-3xl sm:text-4xl font-extrabold text-ink"
        >
          {enc.heading}
        </motion.h1>

        {/* Chinese praise phrase — teaches through encouragement */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <button
            onClick={() => speakChinese(enc.chinesePhrase)}
            className="pressable bg-white rounded-3xl px-7 py-4 shadow-press-card flex flex-col items-center gap-1 cursor-pointer"
          >
            <span className="font-hanzi text-4xl text-ink border-b-[6px] border-gold pb-0.5">
              {enc.chinesePhrase}
            </span>
            <span className="text-base font-bold text-chinese">{enc.chinesePinyin}</span>
            <span className="text-sm font-bold text-ink-soft">
              {enc.chineseMeaning} <span className="font-emoji">🔊</span>
            </span>
          </button>
        </motion.div>

        {/* Score */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-xl font-bold text-ink-soft"
        >
          {enc.subMessage}
        </motion.p>

        {/* Stars */}
        <div className="flex gap-2">{starRow}</div>

        {/* Hearts earned — chip rule */}
        {heartsEarned > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, type: 'spring', stiffness: 250 }}
            className="bg-white rounded-full px-6 py-3 shadow-press-chip flex items-center gap-3"
          >
            <span className="font-emoji text-3xl">❤️</span>
            <span className="text-xl font-extrabold text-ink">
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
            className="bg-white rounded-2xl px-5 py-3 shadow-press-card max-w-sm"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="font-emoji text-xl">💡</span>
              <span className="font-extrabold text-ink">Word Spotlight</span>
            </div>
            <p className="text-ink text-sm font-semibold text-left">{enc.spotlightWord.message}</p>
          </motion.div>
        )}

        {/* Real-life mission */}
        {enc.mission && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="bg-white rounded-2xl px-5 py-3 shadow-press-card max-w-sm"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="font-emoji text-xl">🎯</span>
              <span className="font-extrabold text-ink">Today&apos;s Mission</span>
            </div>
            <p className="text-ink text-sm font-semibold text-left">{enc.mission}</p>
          </motion.div>
        )}

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4 }}
          className="flex flex-col gap-4 mt-2 w-full max-w-xs"
        >
          <button
            onClick={() => router.push(playAgainHref)}
            className={`pressable min-h-[56px] text-white font-extrabold text-xl rounded-3xl py-4 px-8 ${
              isMath ? 'bg-math shadow-press-math' : 'bg-chinese shadow-press-chinese'
            }`}
          >
            Play Again 🔄
          </button>
          <button
            onClick={() => router.push(backHref)}
            className="pressable min-h-[56px] bg-white text-ink font-extrabold text-lg rounded-3xl py-3 px-8 shadow-press-card"
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
    <div className="sunrise-canvas flex flex-col items-center justify-center p-4 py-10">
      <Hills />
      <Sparkles />
      <Suspense fallback={<div className="font-emoji text-4xl animate-spin relative z-10">🌟</div>}>
        <CelebrationContent />
      </Suspense>
    </div>
  )
}
