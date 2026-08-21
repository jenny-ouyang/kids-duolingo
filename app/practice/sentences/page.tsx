'use client'

import { apiFetch } from '@/lib/api-fetch'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import ExerciseShell from '@/components/exercise/ExerciseShell'
import SentenceBuild from '@/components/exercise/SentenceBuild'
import { Hills, Sparkles } from '@/components/design/Scenery'
import { SentenceQuestion } from '@/lib/types'

const MAX_HEARTS = 5

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

export default function SentencesPractice() {
  const router = useRouter()

  const [questions, setQuestions] = useState<SentenceQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [transitioning, setTransitioning] = useState(false)
  const [heartsEarned, setHeartsEarned] = useState(0)
  const [heartPulse, setHeartPulse] = useState(false)

  const correctWordsRef = useRef<{ english: string; chinese: string; pinyin: string }[]>([])

  const loadSession = useCallback(async () => {
    try {
      const res = await apiFetch('/api/sentences/all')
      if (!res.ok) throw new Error('Could not load sentences')
      const data = await res.json()
      setQuestions(data.sentences ?? [])
      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  function handleAnswer(correct: boolean) {
    if (transitioning) return
    setTransitioning(true)

    const currentQuestion = questions[currentIndex]

    let newHeartsEarned = heartsEarned
    if (correct) {
      newHeartsEarned = Math.min(heartsEarned + 1, MAX_HEARTS)
      setHeartsEarned(newHeartsEarned)
      setHeartPulse(true)
      setTimeout(() => setHeartPulse(false), 600)
      correctWordsRef.current.push({
        english: currentQuestion.sentence.english,
        chinese: currentQuestion.sentence.chinese.join(''),
        pinyin: currentQuestion.sentence.pinyin,
      })
    }

    const newCorrectCount = correct ? correctCount + 1 : correctCount
    setCorrectCount(newCorrectCount)

    setTimeout(() => {
      if (currentIndex + 1 >= questions.length) {
        try {
          sessionStorage.setItem('lastSession', JSON.stringify({
            packId: 'sentences',
            packName: 'Simple Sentences',
            subject: 'chinese',
            correctWords: correctWordsRef.current,
          }))
        } catch { /* sessionStorage unavailable */ }

        router.push(
          `/celebrate?subject=chinese&pack=sentences&correct=${newCorrectCount}&total=${questions.length}&hearts=${newHeartsEarned}`
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
          💬
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
          No sentences here yet!
        </p>
        <p className="text-lg font-bold text-ink-soft mt-1">Let&apos;s pick another pack!</p>
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
              <span className="font-emoji text-2xl">💬</span>
              <span className="text-xl font-extrabold text-ink">Simple Sentences</span>
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
              {/* key forces a clean remount per question — SentenceBuild seeds
                  its tile bank from props once, so reuse shows stale tiles */}
              <SentenceBuild key={currentQuestion.sentence.id} question={currentQuestion} onAnswer={handleAnswer} />
            </motion.div>
          </AnimatePresence>
        </ExerciseShell>
      </div>
    </PracticeCanvas>
  )
}
