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

// Rotating press-edge colors by tile index (decorative rhythm — DESIGN.md)
const TILE_EDGES = ['shadow-tile-chinese', 'shadow-tile-math', 'shadow-tile-gold', 'shadow-tile-plum']

/** Renders a row of repeated emoji — e.g. 3 🍎 becomes 🍎🍎🍎 */
function EmojiGroup({ emoji, count }: { emoji: string; count: number }) {
  return (
    <div className="flex flex-wrap justify-center gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="font-emoji text-4xl leading-none select-none">
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
        <p className="text-sm font-extrabold uppercase tracking-widest text-ink-soft">How many?</p>
        <div className="bg-white rounded-3xl px-6 py-4 shadow-press-card">
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
      <p className="text-sm font-extrabold uppercase tracking-widest text-ink-soft">
        What is the answer?
      </p>
      <div className="bg-white rounded-3xl px-8 py-5 shadow-press-card flex items-center gap-4">
        <span className="text-6xl font-extrabold text-ink select-none tabular-nums">
          {problem.operand1}
        </span>
        <span className="text-5xl font-extrabold text-math select-none">{operatorSymbol}</span>
        <span className="text-6xl font-extrabold text-ink select-none tabular-nums">
          {problem.operand2}
        </span>
        <span className="text-5xl font-extrabold text-ink-soft select-none">=</span>
        <span className="text-6xl font-extrabold text-math-light select-none">?</span>
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

  /** Sunrise Playground tile look: white + own-hue edge; success fill + ✓; wrong fades, no red */
  function getButtonStyle(value: number, edgeClass: string): string {
    const isCorrect = value === question.correctAnswer
    if (answerState === 'idle') {
      return `bg-white ${edgeClass} pressable`
    }
    if (selected === value) {
      return answerState === 'correct'
        ? 'bg-success-bg shadow-press-success scale-105'
        : 'bg-canvas-mid shadow-none opacity-80'
    }
    // Show correct answer when wrong
    if (answerState === 'wrong' && isCorrect) {
      return 'bg-success-bg shadow-press-success scale-105'
    }
    return `bg-white ${edgeClass} opacity-60`
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Problem display */}
      <ProblemDisplay question={question} />

      {/* Wrong answer feedback — warm, no punishment */}
      <AnimatePresence>
        {answerState === 'wrong' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-white rounded-full px-5 py-2 shadow-press-chip text-ink font-extrabold text-sm text-center"
          >
            Almost! Keep going! 🌟
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4 number answer buttons in a 2x2 grid */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
        {question.options.map((value, index) => {
          const isCorrect = value === question.correctAnswer
          const edgeClass = TILE_EDGES[index % TILE_EDGES.length]
          const cardStyle = getButtonStyle(value, edgeClass)
          const isWrongPick = answerState === 'wrong' && selected === value
          return (
            <motion.button
              key={value}
              onClick={() => handleSelect(value)}
              disabled={answerState !== 'idle'}
              animate={isWrongPick ? { x: [-6, 6, -4, 4, 0] } : {}}
              transition={{ duration: 0.3 }}
              className={`relative rounded-3xl p-4 flex items-center justify-center transition-colors duration-200 cursor-pointer select-none ${cardStyle}`}
              style={{ minHeight: 100 }}
            >
              <span className="text-5xl font-extrabold text-ink tabular-nums">{value}</span>
              <AnimatePresence>
                {answerState !== 'idle' && isCorrect && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    className="absolute -top-2.5 -right-2.5 w-8 h-8 rounded-full bg-success text-white text-lg font-extrabold flex items-center justify-center"
                  >
                    ✓
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
