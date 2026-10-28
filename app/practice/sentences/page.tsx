'use client'

import { apiFetch } from '@/lib/api-fetch'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import ExerciseShell from '@/components/exercise/ExerciseShell'
import { useLessonFeedback } from '@/components/exercise/useLessonFeedback'
import SentenceBuild from '@/components/exercise/SentenceBuild'
import PinyinToggle from '@/components/exercise/PinyinToggle'
import { Hills, Sparkles } from '@/components/design/Scenery'
import { SentenceQuestion } from '@/lib/types'

const MAX_HEARTS = 5

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

export default function SentencesPractice() {
  const router = useRouter()

  const [questions, setQuestions] = useState<SentenceQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  // Which question index the child revealed pinyin on. Derived, not reset by an
  // effect: moving to the next index hides pinyin in the same render.
  const [pinyinIndex, setPinyinIndex] = useState<number | null>(null)
  const showPinyin = pinyinIndex === currentIndex
  const [correctCount, setCorrectCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [transitioning, setTransitioning] = useState(false)
  const [heartsEarned, setHeartsEarned] = useState(0)
  const { mood, onFeedback, heartChipRef, flight, landed } = useLessonFeedback(currentIndex, heartsEarned < MAX_HEARTS)

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
        <p className="text-2xl font-extrabold text-ink-mid mt-4">Getting ready...</p>
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
        <p className="text-lg font-bold text-ink-mid mt-1">Let&apos;s pick another pack!</p>
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
            {/* key forces a clean remount per question — SentenceBuild seeds
                its tile bank from props once, so reuse shows stale tiles */}
            <SentenceBuild
              key={currentQuestion.sentence.id}
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
