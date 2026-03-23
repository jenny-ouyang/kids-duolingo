'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import KidLayout from '@/components/layout/KidLayout'
import ExerciseShell from '@/components/exercise/ExerciseShell'
import SentenceBuild from '@/components/exercise/SentenceBuild'
import { SentenceQuestion } from '@/lib/types'

const MAX_HEARTS = 5

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
      const res = await fetch('/api/sentences/all')
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
      <KidLayout>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="text-6xl"
        >
          💬
        </motion.div>
      </KidLayout>
    )
  }

  if (questions.length === 0) {
    return (
      <KidLayout>
        <p className="text-xl text-gray-500">No sentences available.</p>
        <button onClick={() => router.push('/packs')} className="mt-6 bg-blue-500 text-white rounded-2xl px-8 py-4 text-xl font-bold">
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
              <span className="text-2xl">💬</span>
              <span className="text-xl font-bold text-gray-600">Simple Sentences</span>
            </div>
          </div>

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
              <SentenceBuild question={currentQuestion} onAnswer={handleAnswer} />
            </motion.div>
          </AnimatePresence>
        </ExerciseShell>
      </div>
    </KidLayout>
  )
}
