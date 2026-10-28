'use client'

import { Suspense, useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import ExerciseShell from '@/components/exercise/ExerciseShell'
import PictureChoice from '@/components/exercise/PictureChoice'
import PinyinToggle from '@/components/exercise/PinyinToggle'
import { Hills, Sparkles } from '@/components/design/Scenery'
import { ExerciseQuestion, WordProgress } from '@/lib/types'
import { updateSM2 } from '@/lib/spaced-repetition'
import { apiFetch, fetchJsonCached } from '@/lib/api-fetch'
import { useLessonFeedback } from '@/components/exercise/useLessonFeedback'
import AskGrownUp from '@/components/kid/AskGrownUp'

const MAX_HEARTS = 5

interface SessionResponse {
  questions: ExerciseQuestion[]
  wordProgress: Record<string, WordProgress>
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

export default function PracticeSessionPage() {
  // useSearchParams needs a Suspense boundary under static export
  return (
    <Suspense fallback={null}>
      <PracticeSession />
    </Suspense>
  )
}

function PracticeSession() {
  const router = useRouter()
  const packId = useSearchParams().get('pack') ?? ''

  const [packName, setPackName] = useState('')
  const [questions, setQuestions] = useState<ExerciseQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  // Which question index the child revealed pinyin on. Derived, not reset by an
  // effect: moving to the next index hides pinyin in the same render.
  const [pinyinIndex, setPinyinIndex] = useState<number | null>(null)
  const showPinyin = pinyinIndex === currentIndex
  const [correctCount, setCorrectCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [transitioning, setTransitioning] = useState(false)

  const [heartsEarned, setHeartsEarned] = useState(0)
  const { mood, onFeedback, heartChipRef, flight, landed } = useLessonFeedback(currentIndex, heartsEarned < MAX_HEARTS)

  const wordProgressRef = useRef<Record<string, WordProgress>>({})
  const correctWordsRef = useRef<{ english: string; chinese: string; pinyin: string }[]>([])
  // Words right on the first try: the server picks this session's sticker from them
  const firstTryIdsRef = useRef<string[]>([])
  // Words missed on first try come back once more before the session ends
  const requeuedRef = useRef<Set<string>>(new Set())
  const currentIndexRef = useRef(0)
  currentIndexRef.current = currentIndex

  const loadSession = useCallback(async () => {
    try {
      const [sessionRes, packRes] = await Promise.all([
        fetchJsonCached<SessionResponse>(`/api/questions/${packId}`),
        fetchJsonCached<{ name?: string }>(`/api/packs/${packId}`),
      ])

      if (sessionRes.status === 402) {
        setLocked(true)
        setLoading(false)
        return
      }
      if (!sessionRes.ok || !sessionRes.data) throw new Error('Could not load session')
      const session = sessionRes.data
      wordProgressRef.current = session.wordProgress ?? {}
      setQuestions(session.questions ?? [])

      if (packRes.ok && packRes.data) {
        setPackName(packRes.data.name ?? '')
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
    apiFetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packId, wordId: itemId, ...updated }),
    }).catch(console.error)

    apiFetch('/api/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packId, wordId: itemId, correct }),
    }).catch(console.error)

    let newHeartsEarned = heartsEarned
    if (correct) {
      newHeartsEarned = Math.min(heartsEarned + 1, MAX_HEARTS)
      setHeartsEarned(newHeartsEarned)
      firstTryIdsRef.current.push(itemId)
      correctWordsRef.current.push({
        english: currentQuestion.word.english,
        chinese: currentQuestion.word.chinese,
        pinyin: currentQuestion.word.pinyin,
      })
    }

    const newCorrectCount = correct ? correctCount + 1 : correctCount
    if (correct) setCorrectCount(newCorrectCount)

    // Duolingo-style within-session repetition: a first-try miss re-queues the
    // word at the end of the session for one fresh attempt (once per word).
    let sessionQuestions = questions
    if (!correct && !requeuedRef.current.has(itemId)) {
      requeuedRef.current.add(itemId)
      sessionQuestions = [...questions, currentQuestion]
      setQuestions(sessionQuestions)
    }

    const isLast = currentIndex >= sessionQuestions.length - 1

    setTimeout(async () => {
      if (isLast) {
        // Wait (briefly) for the session save: its answer carries the new sticker.
        // Offline or slow, the reward screen simply shows no sticker.
        const save = apiFetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            heartsEarned: newHeartsEarned,
            tzOffsetMinutes: new Date().getTimezoneOffset(),
            packId,
            firstTryWordIds: firstTryIdsRef.current,
          }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((d: { sticker?: unknown } | null) => d?.sticker ?? null)
          .catch(() => null)
        const sticker = await Promise.race([save, new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500))])

        try {
          sessionStorage.setItem('lastSession', JSON.stringify({
            packId,
            packName,
            subject: 'chinese',
            correctWords: correctWordsRef.current,
            sticker,
          }))
        } catch { /* sessionStorage unavailable */ }

        router.push(
          `/celebrate?subject=chinese&pack=${packId}&correct=${newCorrectCount}&total=${sessionQuestions.length}&hearts=${newHeartsEarned}`
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

  if (locked) {
    return (
      <PracticeCanvas>
        <AskGrownUp onClose={() => router.push('/packs')} />
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
        <p className="text-lg font-bold text-ink-mid mt-1">Let&apos;s try another one!</p>
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
    <PracticeCanvas lesson>
      <ExerciseShell
        current={currentIndex + 1}
        total={questions.length}
        hearts={Math.min(heartsEarned + (landed ? 1 : 0), MAX_HEARTS)}
        heartChipRef={heartChipRef}
        onClose={() => router.push('/packs')}
        closeLabel="Close the lesson and go back to the packs"
        mood={mood}
        headerAction={
          <PinyinToggle
            on={showPinyin}
            onToggle={() => setPinyinIndex(showPinyin ? null : currentIndex)}
          />
        }
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.25 }}
          >
            <PictureChoice
              question={currentQuestion}
              onAnswer={handleAnswer}
              showPinyin={showPinyin}
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
