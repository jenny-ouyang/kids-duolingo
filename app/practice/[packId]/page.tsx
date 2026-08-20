'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import ExerciseShell from '@/components/exercise/ExerciseShell'
import PictureChoice from '@/components/exercise/PictureChoice'
import { Hills, Sparkles } from '@/components/design/Scenery'
import { ExerciseQuestion, WordProgress } from '@/lib/types'
import { updateSM2 } from '@/lib/spaced-repetition'
import { fetchJsonWithAuthRetry } from '@/lib/api-fetch'

const MAX_HEARTS = 5

interface SessionResponse {
  questions: ExerciseQuestion[]
  wordProgress: Record<string, WordProgress>
}

/** Sunrise Playground screen wrapper — scenery behind, content above (z-10) */
function PracticeCanvas({ children }: { children: React.ReactNode }) {
  return (
    <div className="sunrise-canvas flex flex-col items-center justify-center p-4">
      <Hills />
      <Sparkles positions="sparse" />
      <div className="relative z-10 w-full flex flex-col items-center">{children}</div>
    </div>
  )
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
  const correctWordsRef = useRef<{ english: string; chinese: string; pinyin: string }[]>([])
  const currentIndexRef = useRef(0)
  currentIndexRef.current = currentIndex

  const loadSession = useCallback(async () => {
    try {
      const [sessionRes, packRes] = await Promise.all([
        fetchJsonWithAuthRetry<SessionResponse>(`/api/questions/${packId}`),
        fetchJsonWithAuthRetry<{ name?: string; emoji?: string }>(`/api/packs/${packId}`),
      ])

      if (!sessionRes.ok || !sessionRes.data) throw new Error('Could not load session')
      const session = sessionRes.data
      wordProgressRef.current = session.wordProgress ?? {}
      setQuestions(session.questions ?? [])

      if (packRes.ok && packRes.data) {
        setPackName(packRes.data.name ?? '')
        setPackEmoji(packRes.data.emoji ?? '📦')
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
    const itemId = currentQuestion.word.id

    const existing = wordProgressRef.current[itemId] ?? {
      easiness: 2.5, interval: 1, repetitions: 0, nextReview: new Date().toISOString()
    }
    const updated = updateSM2(existing, correct ? 3 : 1)
    wordProgressRef.current[itemId] = updated

    // Save to DB — fire-and-forget, never blocks the UI
    fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packId, wordId: itemId, ...updated }),
    }).catch(console.error)

    fetch('/api/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packId, wordId: itemId, correct }),
    }).catch(console.error)

    let newHeartsEarned = heartsEarned
    if (correct) {
      newHeartsEarned = Math.min(heartsEarned + 1, MAX_HEARTS)
      setHeartsEarned(newHeartsEarned)
      setHeartPulse(true)
      setTimeout(() => setHeartPulse(false), 600)
      correctWordsRef.current.push({
        english: currentQuestion.word.english,
        chinese: currentQuestion.word.chinese,
        pinyin: currentQuestion.word.pinyin,
      })
    }

    const newCorrectCount = correct ? correctCount + 1 : correctCount
    if (correct) setCorrectCount(newCorrectCount)

    const isLast = currentIndex >= questions.length - 1

    setTimeout(() => {
      if (isLast) {
        fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ heartsEarned: newHeartsEarned, tzOffsetMinutes: new Date().getTimezoneOffset() }),
        }).catch(console.error)

        try {
          sessionStorage.setItem('lastSession', JSON.stringify({
            packId,
            packName,
            subject: 'chinese',
            correctWords: correctWordsRef.current,
          }))
        } catch { /* sessionStorage unavailable */ }

        router.push(
          `/celebrate?subject=chinese&pack=${packId}&correct=${newCorrectCount}&total=${questions.length}&hearts=${newHeartsEarned}`
        )
      } else {
        setCurrentIndex((i) => i + 1)
        setTransitioning(false)
      }
    }, 200)
  }

  if (loading) {
    return (
      <PracticeCanvas>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="font-emoji text-6xl"
        >
          🌟
        </motion.div>
        <p className="text-2xl font-extrabold text-ink-soft mt-4">Getting ready...</p>
      </PracticeCanvas>
    )
  }

  if (questions.length === 0) {
    return (
      <PracticeCanvas>
        <span className="font-emoji text-6xl" aria-hidden>🐼</span>
        <p className="text-2xl font-extrabold text-ink mt-4 text-center">
          Oops! This pack is taking a nap.
        </p>
        <p className="text-lg font-bold text-ink-soft mt-1">Let&apos;s try another one!</p>
        <button
          onClick={() => router.push('/packs')}
          className="pressable mt-6 min-h-[56px] bg-chinese text-white rounded-3xl px-8 py-4 text-xl font-extrabold shadow-press-chinese"
        >
          Go Back
        </button>
      </PracticeCanvas>
    )
  }

  const currentQuestion = questions[currentIndex]

  return (
    <PracticeCanvas>
      <div className="w-full max-w-2xl flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/packs')}
              className="pressable bg-white rounded-2xl w-14 h-14 flex items-center justify-center text-2xl text-ink shadow-press-chip"
              aria-label="Back to packs"
            >
              ←
            </button>
            <div className="flex items-center gap-2">
              <span className="font-emoji text-2xl">{packEmoji}</span>
              <span className="text-xl font-extrabold text-ink">{packName}</span>
            </div>
          </div>

          {/* Hearts chip */}
          <div className="flex items-center gap-1 bg-white rounded-full px-3 py-1.5 shadow-press-chip">
            {Array.from({ length: MAX_HEARTS }).map((_, i) => (
              <motion.span
                key={i}
                animate={heartPulse && i === heartsEarned - 1 ? { scale: [1, 1.5, 1] } : {}}
                transition={{ duration: 0.4 }}
                className="font-emoji text-2xl select-none"
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
    </PracticeCanvas>
  )
}
