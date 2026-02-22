'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { speakChinese } from '@/lib/tts'
import { playCorrectSound, playWrongSound } from '@/lib/sounds'
import { Word, ExerciseQuestion } from '@/lib/types'

interface PictureChoiceProps {
  question: ExerciseQuestion
  onAnswer: (correct: boolean) => void
}

type AnswerState = 'idle' | 'correct' | 'wrong'

export const EMOJI_FALLBACKS: Record<string, string> = {
  cat: '🐱', dog: '🐶', fish: '🐟', bird: '🐦', rabbit: '🐰',
  duck: '🦆', bear: '🐻', elephant: '🐘', lion: '🦁', monkey: '🐵',
  red: '🔴', blue: '🔵', yellow: '🟡', green: '🟢', pink: '🩷',
  purple: '🟣', orange: '🟠', white: '⬜', black: '⬛', brown: '🟫',
  one: '1️⃣', two: '2️⃣', three: '3️⃣', four: '4️⃣', five: '5️⃣',
  six: '6️⃣', seven: '7️⃣', eight: '8️⃣', nine: '9️⃣', ten: '🔟',
  apple: '🍎', banana: '🍌', rice: '🍚', noodles: '🍜', water: '💧',
  milk: '🥛', egg: '🥚', cake: '🎂',
  mom: '👩', dad: '👨', grandma: '👵', grandpa: '👴',
  brother: '👦', sister: '👧', baby: '👶',
  hello: '👋', goodbye: '✌️', 'thank-you': '🙏', yes: '✅',
  no: '❌', 'good-morning': '🌅', 'good-night': '🌙', sorry: '😔',
}

// ─── Option Card variants ────────────────────────────────────────────────────

function PictureCard({
  word, state, isCorrect, onClick, disabled,
}: {
  word: Word; state: AnswerState; isCorrect: boolean; onClick: () => void; disabled: boolean
}) {
  const highlight =
    state !== 'idle' && isCorrect ? 'border-green-400 bg-green-50 scale-105' :
    state === 'wrong' ? 'border-red-300 bg-red-50' :
    'border-white/80 bg-white hover:border-blue-300 hover:bg-blue-50 active:scale-95'

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileTap={!disabled ? { scale: 0.94 } : {}}
      className={`relative rounded-3xl border-4 p-4 flex flex-col items-center justify-center gap-2 shadow-md transition-all duration-200 cursor-pointer select-none ${highlight}`}
      style={{ minHeight: 130 }}
    >
      <div className="text-6xl leading-none">{EMOJI_FALLBACKS[word.id] ?? '❓'}</div>
      <span className="text-sm font-semibold text-gray-500 capitalize">{word.english}</span>
      <AnimatePresence>
        {state !== 'idle' && isCorrect && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-3 -right-3 text-2xl">⭐</motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

function ChineseCard({
  word, state, isCorrect, onClick, disabled,
}: {
  word: Word; state: AnswerState; isCorrect: boolean; onClick: () => void; disabled: boolean
}) {
  const highlight =
    state !== 'idle' && isCorrect ? 'border-green-400 bg-green-50 scale-105' :
    state === 'wrong' ? 'border-red-300 bg-red-50' :
    'border-white/80 bg-white hover:border-blue-300 hover:bg-blue-50 active:scale-95'

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileTap={!disabled ? { scale: 0.94 } : {}}
      className={`relative rounded-3xl border-4 p-4 flex flex-col items-center justify-center gap-1 shadow-md transition-all duration-200 cursor-pointer select-none ${highlight}`}
      style={{ minHeight: 130 }}
    >
      <span className="text-4xl font-bold text-blue-700">{word.chinese}</span>
      <span className="text-base text-gray-400">{word.pinyin}</span>
      <AnimatePresence>
        {state !== 'idle' && isCorrect && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-3 -right-3 text-2xl">⭐</motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

// ─── Prompt variants ─────────────────────────────────────────────────────────

function AudioPrompt({ word }: { word: Word }) {
  return (
    <div className="text-center">
      <p className="text-xl font-bold text-gray-600 mb-2">Which one is</p>
      <button
        onClick={() => speakChinese(word.chinese)}
        className="inline-flex items-center gap-2 bg-white rounded-2xl px-6 py-3 shadow-md border-2 border-blue-200 hover:border-blue-400 transition-colors"
      >
        <span className="text-4xl font-bold text-blue-700">{word.chinese}</span>
        <span className="text-gray-400 text-lg">{word.pinyin}</span>
        <span className="text-2xl">🔊</span>
      </button>
    </div>
  )
}

function PicturePrompt({ word }: { word: Word }) {
  return (
    <div className="text-center flex flex-col items-center gap-2">
      <p className="text-xl font-bold text-gray-600">What is this in Chinese?</p>
      <div className="text-8xl leading-none">{EMOJI_FALLBACKS[word.id] ?? '❓'}</div>
    </div>
  )
}

function EnglishPrompt({ word }: { word: Word }) {
  return (
    <div className="text-center flex flex-col items-center gap-2">
      <p className="text-xl font-bold text-gray-600">How do you say this in Chinese?</p>
      <div className="bg-white rounded-2xl px-8 py-4 shadow-md border-2 border-blue-200">
        <span className="text-4xl font-extrabold text-blue-700 capitalize">{word.english}</span>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PictureChoice({ question, onAnswer }: PictureChoiceProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [answerState, setAnswerState] = useState<AnswerState>('idle')

  // Auto-play audio when question loads (for audio type) or on all types as reinforcement
  useEffect(() => {
    const timer = setTimeout(() => {
      if (question.type === 'audio_to_picture') {
        speakChinese(question.word.chinese)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [question.word.chinese, question.type])

  function handleSelect(wordId: string) {
    if (answerState !== 'idle') return
    setSelectedId(wordId)
    const correct = wordId === question.correctId
    setAnswerState(correct ? 'correct' : 'wrong')

    if (correct) {
      playCorrectSound()
      setTimeout(() => speakChinese(question.word.chinese), 150)
    } else {
      playWrongSound()
      // Speak the correct answer so Julian hears what it should be
      setTimeout(() => speakChinese(question.word.chinese), 500)
    }

    setTimeout(() => {
      onAnswer(correct)
      setSelectedId(null)
      setAnswerState('idle')
    }, correct ? 1100 : 1700)
  }

  const useChineseOptions =
    question.type === 'picture_to_chinese' || question.type === 'english_to_chinese'

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      {/* Prompt */}
      {question.type === 'audio_to_picture' && <AudioPrompt word={question.word} />}
      {question.type === 'picture_to_chinese' && <PicturePrompt word={question.word} />}
      {question.type === 'english_to_chinese' && <EnglishPrompt word={question.word} />}

      {/* Wrong-answer feedback */}
      <AnimatePresence>
        {answerState === 'wrong' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-orange-100 border-2 border-orange-300 rounded-2xl px-5 py-2 text-orange-700 font-semibold text-center text-sm"
          >
            Almost! Keep going! 🌟
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4 option cards */}
      <div className="grid grid-cols-2 gap-4 w-full">
        {question.options.map((word) => {
          const isCorrect = word.id === question.correctId
          const cardState =
            selectedId === word.id ? answerState :
            selectedId !== null && isCorrect && answerState === 'wrong' ? 'correct' :
            'idle'

          return useChineseOptions ? (
            <ChineseCard
              key={word.id}
              word={word}
              state={cardState}
              isCorrect={isCorrect}
              onClick={() => handleSelect(word.id)}
              disabled={answerState !== 'idle'}
            />
          ) : (
            <PictureCard
              key={word.id}
              word={word}
              state={cardState}
              isCorrect={isCorrect}
              onClick={() => handleSelect(word.id)}
              disabled={answerState !== 'idle'}
            />
          )
        })}
      </div>
    </div>
  )
}
