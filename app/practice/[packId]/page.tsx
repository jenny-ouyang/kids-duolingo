'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import KidLayout from '@/components/layout/KidLayout'
import ExerciseShell from '@/components/exercise/ExerciseShell'
import PictureChoice from '@/components/exercise/PictureChoice'
import { ExerciseQuestion, WordProgress } from '@/lib/types'
import { updateSM2 } from '@/lib/spaced-repetition'

const MAX_HEARTS = 5

interface SessionResponse {
  questions: ExerciseQuestion[]
  wordProgress: Record<string, WordProgress>
}

export default function PracticeSession() {
  const router = useRouter()
  const params = useParams()
  const packId = params.packId as string

  const [packName, setPackName] = useState('')
  const [packEmoji, setPackEmoji] = useState('📦')
  const [questions, setQuestions] = useState<ExerciseQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [transitioning, setTransitioning] = useState(false)

  const [heartsEarned, setHeartsEarned] = useState(0)
  const [heartPulse, setHeartPulse] = useState(false)

  const wordProgressRef = useRef<Record<string, WordProgress>>({})
  const currentIndexRef = useRef(0)
  currentIndexRef.current = currentIndex

  const loadSession = useCallback(async () => {
    try {
      // One request gets everything: pack info, pre-generated questions, word progress.
      // Zero AI calls.
      const [sessionRes, packRes] = await Promise.all([
        fetch(`/api/questions/${packId}`),
        fetch(`/api/packs/${packId}`),
      ])

      if (!sessionRes.ok) throw new Error('Could not load session')
      const session: SessionResponse = await sessionRes.json()
      wordProgressRef.current = session.wordProgress ?? {}
      setQuestions(session.questions)

      if (packRes.ok) {
        const packData = await packRes.json()
        setPackName(packData.name ?? '')
        setPackEmoji(packData.emoji ?? '📦')
      }

      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }, [packId])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  async function handleAnswer(correct: boolean) {
    if (questions.length === 0 || transitioning) return
    setTransitioning(true)

    const currentQuestion = questions[currentIndex]
    const wordId = currentQuestion.word.id

    const existing = wordProgressRef.current[wordId] ?? {
      easiness: 2.5, interval: 1, repetitions: 0, nextReview: new Date().toISOString()
    }
    const updated = updateSM2(existing, correct ? 3 : 1)
    wordProgressRef.current[wordId] = updated

    // Save to DB — fire-and-forget, never blocks the UI
    fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packId, wordId, ...updated }),
    }).catch(console.error)

    fetch('/api/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packId, wordId, correct }),
    }).catch(console.error)

    let newHeartsEarned = heartsEarned
    if (correct) {
      newHeartsEarned = Math.min(heartsEarned + 1, MAX_HEARTS)
      setHeartsEarned(newHeartsEarned)
      setHeartPulse(true)
      setTimeout(() => setHeartPulse(false), 600)
    }

    const newCorrectCount = correct ? correctCount + 1 : correctCount
    if (correct) setCorrectCount(newCorrectCount)

    const isLast = currentIndex >= questions.length - 1

    setTimeout(() => {
      if (isLast) {
        fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ heartsEarned: newHeartsEarned }),
        }).catch(console.error)

        router.push(
          `/celebrate?pack=${packId}&correct=${newCorrectCount}&total=${questions.length}&hearts=${newHeartsEarned}`
        )
      } else {
        setCurrentIndex((i) => i + 1)
        setTransitioning(false)
      }
    }, 200)
  }

  if (loading) {
    return (
      <KidLayout>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="text-6xl"
        >
          🌟
        </motion.div>
        <p className="text-2xl font-bold text-blue-500 mt-4">Getting ready...</p>
      </KidLayout>
    )
  }

  if (questions.length === 0) {
    return (
      <KidLayout>
        <p className="text-2xl font-bold text-red-400">Oops! Could not load this pack.</p>
        <button
          onClick={() => router.push('/packs')}
          className="mt-6 bg-blue-500 text-white rounded-2xl px-8 py-4 text-xl font-bold"
        >
          Go Back
        </button>
      </KidLayout>
    )
  }

  const currentQuestion = questions[currentIndex]

  return (
    <KidLayout>
      <div className="w-full max-w-2xl flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/packs')}
              className="bg-white/70 rounded-2xl px-4 py-2 text-2xl shadow-sm hover:bg-white transition-colors"
            >
              ←
            </button>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{packEmoji}</span>
              <span className="text-xl font-bold text-gray-600">{packName}</span>
            </div>
          </div>

          {/* Hearts row */}
          <div className="flex items-center gap-1">
            {Array.from({ length: MAX_HEARTS }).map((_, i) => (
              <motion.span
                key={i}
                animate={heartPulse && i === heartsEarned - 1 ? { scale: [1, 1.5, 1] } : {}}
                transition={{ duration: 0.4 }}
                className="text-2xl select-none"
              >
                {i < heartsEarned ? '❤️' : '🤍'}
              </motion.span>
            ))}
          </div>
        </div>

        <ExerciseShell current={currentIndex + 1} total={questions.length}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.25 }}
            >
              <PictureChoice question={currentQuestion} onAnswer={handleAnswer} />
            </motion.div>
          </AnimatePresence>
        </ExerciseShell>
      </div>
    </KidLayout>
  )
}
