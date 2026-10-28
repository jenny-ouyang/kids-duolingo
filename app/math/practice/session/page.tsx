'use client'

import { Suspense, useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import ExerciseShell from '@/components/exercise/ExerciseShell'
import { useLessonFeedback } from '@/components/exercise/useLessonFeedback'
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
function PracticeCanvas({ children, lesson = false }: { children: React.ReactNode; lesson?: boolean }) {
  // A lesson starts at the top and leaves room under the tiles for the fixed Right band
  const layout = lesson ? 'justify-start pt-6 pb-64' : 'justify-center'
  return (
    <div className={`sunrise-canvas flex flex-col items-center p-4 ${layout}`}>
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
  const { mood, onFeedback, heartChipRef, flight, landed } = useLessonFeedback(currentIndex, heartsEarned < MAX_HEARTS)

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
        <p className="text-2xl font-extrabold text-ink-mid mt-4">Getting ready...</p>
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
        <p className="text-lg font-bold text-ink-mid mt-1">Let&apos;s try another one!</p>
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
    <PracticeCanvas lesson>
      <ExerciseShell
        current={currentIndex + 1}
        total={questions.length}
        hearts={Math.min(heartsEarned + (landed ? 1 : 0), MAX_HEARTS)}
        heartChipRef={heartChipRef}
        onClose={() => router.push('/math/topics')}
        closeLabel="Close the lesson and go back to the math topics"
        where={
          <>
            <span className="font-emoji" aria-hidden>{topicEmoji}</span> {topicName} · question {currentIndex + 1} of{' '}
            {questions.length}
          </>
        }
        mood={mood}
        buddySay={mood === 'listen' ? 'Let us count! 👀' : undefined}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.25 }}
          >
            <CountAndChoose
              question={currentQuestion}
              onAnswer={handleAnswer}
              position={{ n: currentIndex + 1, total: questions.length }}
              onFeedback={onFeedback}
            />
          </motion.div>
        </AnimatePresence>
      </ExerciseShell>
      {flight}
    </PracticeCanvas>
  )
}
