'use client'

import { Suspense, useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import ExerciseShell from '@/components/exercise/ExerciseShell'
import CountAndChoose from '@/components/exercise/CountAndChoose'
import { Hills, Sparkles } from '@/components/design/Scenery'
import { MathQuestion, BaseProgress } from '@/lib/types'
import { updateSM2 } from '@/lib/spaced-repetition'
import { apiFetch, fetchJsonCached } from '@/lib/api-fetch'

const MAX_HEARTS = 5

interface MathSessionResponse {
  questions: MathQuestion[]
  progress: Record<string, BaseProgress>
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

export default function MathPracticeSessionPage() {
  // useSearchParams needs a Suspense boundary under static export
  return (
    <Suspense fallback={null}>
      <MathPracticeSession />
    </Suspense>
  )
}

function MathPracticeSession() {
  const router = useRouter()
  const topicId = useSearchParams().get('topic') ?? ''

  const [topicName, setTopicName] = useState('')
  const [topicEmoji, setTopicEmoji] = useState('➕')
  const [questions, setQuestions] = useState<MathQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [transitioning, setTransitioning] = useState(false)

  const [heartsEarned, setHeartsEarned] = useState(0)
  const [heartPulse, setHeartPulse] = useState(false)

  const progressRef = useRef<Record<string, BaseProgress>>({})
  // Problems missed on first try come back once more before the session ends
  const requeuedRef = useRef<Set<string>>(new Set())

  const loadSession = useCallback(async () => {
    try {
      const [sessionRes, packRes] = await Promise.all([
        fetchJsonCached<MathSessionResponse>(`/api/math/questions/${topicId}`),
        fetchJsonCached<{ name?: string; emoji?: string }>(`/api/packs/${topicId}`),
      ])

      if (!sessionRes.ok || !sessionRes.data) throw new Error('Could not load session')
      const session = sessionRes.data
      progressRef.current = session.progress ?? {}
      setQuestions(session.questions ?? [])

      if (packRes.ok && packRes.data) {
        setTopicName(packRes.data.name ?? '')
        setTopicEmoji(packRes.data.emoji ?? '➕')
      }

      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  async function handleAnswer(correct: boolean) {
    if (questions.length === 0 || transitioning) return
    setTransitioning(true)

    const currentQuestion = questions[currentIndex]
    const problemId = currentQuestion.problem.id

    const existing = progressRef.current[problemId] ?? {
      easiness: 2.5, interval: 1, repetitions: 0, nextReview: new Date().toISOString(),
    }
    const updated = updateSM2(existing, correct ? 3 : 1)
    progressRef.current[problemId] = updated

    // Fire-and-forget — never blocks UI
    apiFetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packId: topicId, wordId: problemId, subject: 'math', ...updated }),
    }).catch(console.error)

    apiFetch('/api/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packId: topicId, wordId: problemId, correct }),
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

    // Duolingo-style within-session repetition: a first-try miss re-queues the
    // problem at the end of the session for one fresh attempt (once per problem).
    let sessionQuestions = questions
    if (!correct && !requeuedRef.current.has(problemId)) {
      requeuedRef.current.add(problemId)
      sessionQuestions = [...questions, currentQuestion]
      setQuestions(sessionQuestions)
    }

    const isLast = currentIndex >= sessionQuestions.length - 1

    setTimeout(() => {
      if (isLast) {
        apiFetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ heartsEarned: newHeartsEarned, tzOffsetMinutes: new Date().getTimezoneOffset() }),
        }).catch(console.error)

        router.push(
          `/celebrate?subject=math&pack=${topicId}&correct=${newCorrectCount}&total=${sessionQuestions.length}&hearts=${newHeartsEarned}`
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
          Oops! This topic is taking a nap.
        </p>
        <p className="text-lg font-bold text-ink-soft mt-1">Let&apos;s try another one!</p>
        <button
          onClick={() => router.push('/math/topics')}
          className="pressable mt-6 min-h-[56px] bg-math text-white rounded-3xl px-8 py-4 text-xl font-extrabold shadow-press-math"
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
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/math/topics')}
              className="pressable bg-white rounded-2xl w-14 h-14 flex items-center justify-center text-2xl text-ink shadow-press-chip"
              aria-label="Back to topics"
            >
              ←
            </button>
            <div className="flex items-center gap-2">
              <span className="font-emoji text-2xl">{topicEmoji}</span>
              <span className="text-xl font-extrabold text-ink">{topicName}</span>
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
              <CountAndChoose question={currentQuestion} onAnswer={handleAnswer} />
            </motion.div>
          </AnimatePresence>
        </ExerciseShell>
      </div>
    </PracticeCanvas>
  )
}
