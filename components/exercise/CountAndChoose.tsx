'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { playCorrectSound, playWrongSound } from '@/lib/sounds'
import { MathQuestion } from '@/lib/types'

interface CountAndChooseProps {
  question: MathQuestion
  onAnswer: (correct: boolean) => void
}

type AnswerState = 'idle' | 'correct' | 'wrong'

/** Renders a row of repeated emoji — e.g. 3 🍎 becomes 🍎🍎🍎 */
function EmojiGroup({ emoji, count }: { emoji: string; count: number }) {
  return (
    <div className="flex flex-wrap justify-center gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="text-4xl leading-none select-none">
          {emoji}
        </span>
      ))}
    </div>
  )
}

/** The visual problem display — adapts for count vs. arithmetic */
function ProblemDisplay({ question }: { question: MathQuestion }) {
  const { problem } = question

  // Counting: show objects to count — the only case where emoji groups make sense
  if (problem.operator === 'count') {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-xl font-bold text-gray-600">How many?</p>
        <div className="bg-white rounded-3xl px-6 py-4 shadow-md border-2 border-blue-100">
          <EmojiGroup emoji={problem.emoji} count={problem.operand1} />
        </div>
      </div>
    )
  }

  // Addition / subtraction: show a clean numeric equation.
  // Showing emoji objects here would let the child just count them — that's
  // counting, not arithmetic. The equation forces recall of the actual fact.
  const operatorSymbol = problem.operator === '+' ? '+' : '−'

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-xl font-bold text-gray-600">What is the answer?</p>
      <div className="bg-white rounded-3xl px-8 py-5 shadow-md border-2 border-blue-100 flex items-center gap-4">
        <span className="text-6xl font-extrabold text-gray-700 select-none tabular-nums">
          {problem.operand1}
        </span>
        <span className="text-5xl font-extrabold text-blue-500 select-none">{operatorSymbol}</span>
        <span className="text-6xl font-extrabold text-gray-700 select-none tabular-nums">
          {problem.operand2}
        </span>
        <span className="text-5xl font-extrabold text-gray-300 select-none">=</span>
        <span className="text-6xl font-extrabold text-blue-300 select-none">?</span>
      </div>
    </div>
  )
}

export default function CountAndChoose({ question, onAnswer }: CountAndChooseProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const [answerState, setAnswerState] = useState<AnswerState>('idle')

  function handleSelect(value: number) {
    if (answerState !== 'idle') return
    setSelected(value)
    const correct = value === question.correctAnswer
    setAnswerState(correct ? 'correct' : 'wrong')

    if (correct) {
      playCorrectSound()
    } else {
      playWrongSound()
    }

    setTimeout(() => {
      onAnswer(correct)
      setSelected(null)
      setAnswerState('idle')
    }, correct ? 1100 : 1700)
  }

  function getButtonStyle(value: number): string {
    const isCorrect = value === question.correctAnswer
    if (answerState === 'idle') {
      return 'bg-white border-white/80 hover:border-blue-300 hover:bg-blue-50 active:scale-95'
    }
    if (selected === value) {
      return answerState === 'correct'
        ? 'bg-green-50 border-green-400 scale-105'
        : 'bg-red-50 border-red-300'
    }
    // Show correct answer when wrong
    if (answerState === 'wrong' && isCorrect) {
      return 'bg-green-50 border-green-400 scale-105'
    }
    return 'bg-white border-white/80 opacity-60'
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Problem display */}
      <ProblemDisplay question={question} />

      {/* Wrong answer feedback */}
      <AnimatePresence>
        {answerState === 'wrong' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-orange-100 border-2 border-orange-300 rounded-2xl px-5 py-2 text-orange-700 font-semibold text-sm text-center"
          >
            Almost! Keep going! 🌟
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4 number answer buttons in a 2x2 grid */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
        {question.options.map((value) => {
          const isCorrect = value === question.correctAnswer
          const cardStyle = getButtonStyle(value)
          return (
            <motion.button
              key={value}
              onClick={() => handleSelect(value)}
              disabled={answerState !== 'idle'}
              whileTap={answerState === 'idle' ? { scale: 0.94 } : {}}
              className={`relative rounded-3xl border-4 p-4 flex items-center justify-center shadow-md transition-all duration-200 cursor-pointer select-none ${cardStyle}`}
              style={{ minHeight: 100 }}
            >
              <span className="text-5xl font-extrabold text-blue-700">{value}</span>
              <AnimatePresence>
                {answerState !== 'idle' && isCorrect && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-3 -right-3 text-2xl"
                  >
                    ⭐
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
