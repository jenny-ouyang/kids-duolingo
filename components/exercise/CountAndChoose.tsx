'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { playCorrectSound, playWrongSound } from '@/lib/sounds'
import { hapticCorrect, hapticWrong } from '@/lib/haptics'
import { MathQuestion } from '@/lib/types'
import { speakChinese } from '@/lib/tts'
import { numberToChinese } from '@/lib/numbers-zh'
import { RightBand, NotQuiteBand, LessonFeedback } from './FeedbackBand'
import TenFrames from './TenFrames'

interface CountAndChooseProps {
  question: MathQuestion
  /** Called when the child presses Next after the right pick; true = right on the first try */
  onAnswer: (correct: boolean) => void
  position: { n: number; total: number }
  onFeedback?: (feedback: LessonFeedback) => void
}

/** Why a pick was not right, in words a 5-year-old can use */
function notQuiteReason(question: MathQuestion, picked: number): string {
  const { operand1: a, operand2: b, operator } = question.problem
  if (operator === 'count') return `Not ${picked}. Count them one by one with your finger.`
  const sum = operator === '+' ? `${a} + ${b}` : `${a} − ${b}`
  return picked < question.correctAnswer ? `${sum} is more than ${picked}.` : `${sum} is less than ${picked}.`
}

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
        <h1 className="text-[22px] font-extrabold text-ink leading-tight">How many?</h1>
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
      <p className="text-lg font-bold text-ink-mid">What is the answer?</p>
      <h1
        aria-label={`${problem.operand1} ${problem.operator === '+' ? 'plus' : 'minus'} ${problem.operand2} equals what?`}
        className="bg-white rounded-3xl px-8 py-5 shadow-press-card flex items-center gap-4"
      >
        <span className="text-6xl font-extrabold text-ink select-none tabular-nums">
          {problem.operand1}
        </span>
        <span className="text-5xl font-extrabold text-math select-none">{operatorSymbol}</span>
        <span className="text-6xl font-extrabold text-ink select-none tabular-nums">
          {problem.operand2}
        </span>
        <span className="text-5xl font-extrabold text-ink-mid select-none">=</span>
        <span className="text-6xl font-extrabold text-math-light select-none">?</span>
      </h1>
    </div>
  )
}

export default function CountAndChoose({ question, onAnswer, position, onFeedback }: CountAndChooseProps) {
  // Stay-until-right: wrong picks gray out and the problem waits for the correct
  // answer. Only the FIRST pick feeds the memory system (onAnswer).
  const [wrongPicks, setWrongPicks] = useState<number[]>([])
  const [lastWrongPick, setLastWrongPick] = useState<number | null>(null)
  const [solved, setSolved] = useState(false)

  function handleSelect(value: number, e: React.MouseEvent<HTMLButtonElement>) {
    if (solved || wrongPicks.includes(value)) return
    const correct = value === question.correctAnswer

    if (correct) {
      setSolved(true)
      playCorrectSound()
      hapticCorrect()
      setTimeout(() => speakChinese(numberToChinese(value)), 300)
      onFeedback?.({ mood: 'yes', earnsHeart: wrongPicks.length === 0, from: e.currentTarget.getBoundingClientRect() })
    } else {
      playWrongSound()
      hapticWrong()
      setWrongPicks((picks) => [...picks, value])
      setLastWrongPick(value)
      setTimeout(() => setLastWrongPick(null), 400)
      onFeedback?.({ mood: 'listen' })
    }
  }

  const { operand1: a, operand2: b, operator } = question.problem
  const answerText = operator === 'count' ? `${question.correctAnswer}` : `${a} ${operator === '+' ? '+' : '−'} ${b} = ${question.correctAnswer}`
  const lastWrong = wrongPicks[wrongPicks.length - 1]

  /** Sunrise Playground tile look: white + own-hue edge; success fill + ✓; wrong fades, no red */
  function getButtonStyle(value: number, edgeClass: string): string {
    const isCorrect = value === question.correctAnswer
    if (solved && isCorrect) {
      return 'bg-success-bg shadow-press-success scale-105'
    }
    if (wrongPicks.includes(value)) {
      return 'bg-canvas-mid shadow-none opacity-80'
    }
    if (solved) {
      return `bg-white ${edgeClass} opacity-60`
    }
    return `bg-white ${edgeClass} pressable`
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Problem display */}
      <ProblemDisplay question={question} />

      {/* 4 number answer buttons in a 2x2 grid */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
        {question.options.map((value, index) => {
          const isCorrect = value === question.correctAnswer
          const edgeClass = TILE_EDGES[index % TILE_EDGES.length]
          const cardStyle = getButtonStyle(value, edgeClass)
          const isWrongPick = lastWrongPick === value
          return (
            <motion.button
              key={value}
              onClick={(e) => handleSelect(value, e)}
              aria-label={wrongPicks.includes(value) ? `${value}, already tried` : undefined}
              disabled={solved || wrongPicks.includes(value)}
              animate={isWrongPick ? { x: [-6, 6, -4, 4, 0] } : {}}
              transition={{ duration: 0.3 }}
              className={`relative rounded-3xl p-4 flex items-center justify-center transition-colors duration-200 cursor-pointer select-none ${cardStyle}`}
              style={{ minHeight: 100 }}
            >
              <span className="text-5xl font-extrabold text-ink tabular-nums">{value}</span>
              <AnimatePresence>
                {solved && isCorrect && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    className="absolute -top-2.5 -right-2.5 w-8 h-8 rounded-full bg-go text-white text-lg font-extrabold flex items-center justify-center"
                  >
                    ✓
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          )
        })}
      </div>

      {/* Wrong pick: real help, not a cheer. The problem waits for the right number. */}
      {lastWrong !== undefined && !solved && (
        <NotQuiteBand reason={notQuiteReason(question, lastWrong)}>
          {operator === '+' && a + b <= 20 && (
            <>
              <p className="text-base font-bold text-ink">Let us count it together.</p>
              <TenFrames a={a} b={b} />
            </>
          )}
        </NotQuiteBand>
      )}

      <AnimatePresence>
        {solved && (
          <RightBand title={`Right! ${answerText}`} onNext={() => onAnswer(wrongPicks.length === 0)}>
            <div className="flex items-center gap-3">
              <span className="text-base font-bold text-ink-mid">
                {position.n} of {position.total} done
              </span>
              <button
                onClick={() => speakChinese(numberToChinese(question.correctAnswer))}
                aria-label={`Hear ${question.correctAnswer} in Chinese`}
                className="pressable ml-auto min-h-[48px] rounded-2xl bg-gold shadow-press-gold px-4 flex items-center gap-2 text-lg font-extrabold text-ink"
              >
                <span className="font-emoji">🔊</span>
                <span className="font-hanzi">{numberToChinese(question.correctAnswer)}</span>
              </button>
            </div>
          </RightBand>
        )}
      </AnimatePresence>
    </div>
  )
}
