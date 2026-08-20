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
  // Animals
  cat: '🐱', dog: '🐶', fish: '🐟', bird: '🐦', rabbit: '🐰',
  duck: '🦆', bear: '🐻', elephant: '🐘', lion: '🦁', monkey: '🐵',
  // Colors
  red: '🔴', blue: '🔵', yellow: '🟡', green: '🟢', pink: '🩷',
  purple: '🟣', orange: '🟠', white: '⬜', black: '⬛', brown: '🟫',
  // Numbers
  one: '1️⃣', two: '2️⃣', three: '3️⃣', four: '4️⃣', five: '5️⃣',
  six: '6️⃣', seven: '7️⃣', eight: '8️⃣', nine: '9️⃣', ten: '🔟',
  // Food
  apple: '🍎', banana: '🍌', rice: '🍚', noodles: '🍜', water: '💧',
  milk: '🥛', egg: '🥚', cake: '🎂',
  // Family
  mom: '👩', dad: '👨', grandma: '👵', grandpa: '👴',
  'maternal-grandma': '👵', 'maternal-grandpa': '👴',
  brother: '👦', 'younger-brother': '👦', sister: '👧', 'younger-sister': '👧',
  baby: '👶', uncle: '👨‍🦱', aunt: '👩‍🦱', family: '👨‍👩‍👧‍👦',
  // Greetings
  hello: '👋', goodbye: '✌️', 'thank-you': '🙏', yes: '✅',
  no: '❌', 'good-morning': '🌅', 'good-night': '🌙', sorry: '😔',
  // Pronouns
  'i-me': '🙋', you: '👉', 'he-him': '👦', 'she-her': '👧',
  'we-us': '👨‍👩‍👧‍👦', 'you-all': '👥', 'they-them': '👫',
  this: '👇', that: '👆', who: '🤔', what: '❓', where: '🗺️',
  // Actions
  eat: '😋', drink: '🥤', sleep: '😴', run: '🏃', walk: '🚶',
  jump: '🤸', play: '🎮', read: '📖', write: '✍️', draw: '🎨',
  sing: '🎤', dance: '💃', sit: '🪑', stand: '🧍', look: '👀',
  listen: '👂', talk: '💬', go: '➡️', come: '🫶', want: '🙏',
  have: '🤲', give: '🎁', help: '🤝', love: '❤️', like: '👍',
  // Feelings
  happy: '😊', sad: '😢', angry: '😠', scared: '😨', tired: '😫',
  hungry: '🤤', thirsty: '🥵', sick: '🤒', 'cold-feeling': '🥶',
  'hot-feeling': '🥵', excited: '🤩', okay: '🙂',
  // Describing words
  big: '🐘', small: '🐜', many: '🔢', few: '☝️', fast: '⚡',
  slow: '🐢', good: '👍', not: '🚫', very: '💯', also: '➕',
  together: '🤝', up: '⬆️', down: '⬇️', again: '🔄',
}

// Rotating press-edge colors by tile index (decorative rhythm — DESIGN.md)
const TILE_EDGES = ['shadow-tile-chinese', 'shadow-tile-math', 'shadow-tile-gold', 'shadow-tile-plum']

/** Sunrise Playground tile look: white + own-hue edge; success fill + ✓; wrong fades, no red */
function tileClasses(state: AnswerState, isCorrect: boolean, edgeClass: string): string {
  if (state !== 'idle' && isCorrect) return 'bg-success-bg shadow-press-success scale-105'
  if (state === 'wrong') return 'bg-canvas-mid shadow-none opacity-80'
  return `bg-white ${edgeClass} pressable`
}

/** ✓ badge that pops on the correct tile — color is never the only signal */
function CorrectBadge() {
  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      className="absolute -top-2.5 -right-2.5 w-8 h-8 rounded-full bg-success text-white text-lg font-extrabold flex items-center justify-center"
    >
      ✓
    </motion.span>
  )
}

const SHAKE = { x: [-6, 6, -4, 4, 0] }

// ─── Option Card variants ────────────────────────────────────────────────────

function PictureCard({
  word, state, shaking, isCorrect, onClick, disabled, edgeClass,
}: {
  word: Word; state: AnswerState; shaking: boolean; isCorrect: boolean; onClick: () => void; disabled: boolean; edgeClass: string
}) {
  const emojiIcon = EMOJI_FALLBACKS[word.id]

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      animate={shaking ? SHAKE : {}}
      transition={{ duration: 0.3 }}
      className={`relative rounded-3xl p-4 flex flex-col items-center justify-center gap-2 transition-colors duration-200 cursor-pointer select-none ${tileClasses(state, isCorrect, edgeClass)}`}
      style={{ minHeight: 130 }}
    >
      {emojiIcon ? (
        <>
          <div className="font-emoji text-[46px] leading-none">{emojiIcon}</div>
          <span className="text-sm font-extrabold text-ink capitalize">{word.english}</span>
        </>
      ) : (
        <span className="text-3xl font-extrabold text-ink capitalize text-center leading-tight px-1">
          {word.english}
        </span>
      )}
      <AnimatePresence>
        {state !== 'idle' && isCorrect && <CorrectBadge />}
      </AnimatePresence>
    </motion.button>
  )
}

function ChineseCard({
  word, state, shaking, isCorrect, onClick, disabled, edgeClass,
}: {
  word: Word; state: AnswerState; shaking: boolean; isCorrect: boolean; onClick: () => void; disabled: boolean; edgeClass: string
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      animate={shaking ? SHAKE : {}}
      transition={{ duration: 0.3 }}
      className={`relative rounded-3xl p-4 flex flex-col items-center justify-center gap-1 transition-colors duration-200 cursor-pointer select-none ${tileClasses(state, isCorrect, edgeClass)}`}
      style={{ minHeight: 130 }}
    >
      <span className="font-hanzi text-4xl text-ink">{word.chinese}</span>
      <span className="text-base font-bold text-ink-soft">{word.pinyin}</span>
      <AnimatePresence>
        {state !== 'idle' && isCorrect && <CorrectBadge />}
      </AnimatePresence>
    </motion.button>
  )
}

// ─── Prompt variants (Hanzi hero block — DESIGN.md) ──────────────────────────

function AudioPrompt({ word }: { word: Word }) {
  return (
    <div className="text-center">
      <button
        onClick={() => speakChinese(word.chinese)}
        className="pressable bg-white rounded-3xl shadow-press-card px-7 py-4 flex flex-col items-center gap-2"
      >
        <span className="text-sm font-extrabold uppercase tracking-widest text-ink-soft">
          Which one is
        </span>
        <span className="font-hanzi text-[52px] leading-tight text-ink border-b-[6px] border-gold pb-0.5">
          {word.chinese}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-lg font-bold text-chinese">{word.pinyin}</span>
          <span className="bg-gold rounded-full px-3 py-1 shadow-press-gold">
            <span className="font-emoji text-xl">🔊</span>
          </span>
        </span>
      </button>
    </div>
  )
}

function PicturePrompt({ word }: { word: Word }) {
  const emojiIcon = EMOJI_FALLBACKS[word.id]
  return (
    <div className="text-center flex flex-col items-center gap-2">
      <p className="text-sm font-extrabold uppercase tracking-widest text-ink-soft">
        What is this in Chinese?
      </p>
      {emojiIcon ? (
        <div className="font-emoji text-8xl leading-none">{emojiIcon}</div>
      ) : (
        <div className="bg-white rounded-3xl px-8 py-4 shadow-press-card">
          <span className="text-4xl font-extrabold text-ink capitalize">{word.english}</span>
        </div>
      )}
    </div>
  )
}

function EnglishPrompt({ word }: { word: Word }) {
  return (
    <div className="text-center flex flex-col items-center gap-2">
      <p className="text-sm font-extrabold uppercase tracking-widest text-ink-soft">
        How do you say this in Chinese?
      </p>
      <div className="bg-white rounded-3xl px-8 py-4 shadow-press-card">
        <span className="text-4xl font-extrabold text-ink capitalize">{word.english}</span>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PictureChoice({ question, onAnswer }: PictureChoiceProps) {
  // Stay-until-right: wrong taps gray out and the question waits for the correct
  // tap. Only the FIRST tap feeds the memory system (onAnswer), so retry kindness
  // never corrupts the spaced-repetition data.
  const [wrongIds, setWrongIds] = useState<string[]>([])
  const [lastWrongId, setLastWrongId] = useState<string | null>(null)
  const [solved, setSolved] = useState(false)

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
    if (solved || wrongIds.includes(wordId)) return
    const correct = wordId === question.correctId

    if (correct) {
      const firstTry = wrongIds.length === 0
      setSolved(true)
      playCorrectSound()
      setTimeout(() => speakChinese(question.word.chinese), 150)
      setTimeout(() => {
        onAnswer(firstTry)
        setWrongIds([])
        setLastWrongId(null)
        setSolved(false)
      }, 1100)
    } else {
      playWrongSound()
      setWrongIds((ids) => [...ids, wordId])
      setLastWrongId(wordId)
      setTimeout(() => setLastWrongId(null), 400)
      // Re-speak the target word — a hint through the ears, not a reveal
      setTimeout(() => speakChinese(question.word.chinese), 450)
    }
  }

  const useChineseOptions =
    question.type === 'picture_to_chinese' || question.type === 'english_to_chinese'

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      {/* Prompt */}
      {question.type === 'audio_to_picture' && <AudioPrompt word={question.word} />}
      {question.type === 'picture_to_chinese' && <PicturePrompt word={question.word} />}
      {question.type === 'english_to_chinese' && <EnglishPrompt word={question.word} />}

      {/* Wrong-answer feedback — warm, no punishment, question stays until solved */}
      <AnimatePresence>
        {wrongIds.length > 0 && !solved && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-white rounded-full px-5 py-2 shadow-press-chip text-ink font-extrabold text-center text-sm"
          >
            Try again — you&apos;ve got this! 🌟
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4 option cards */}
      <div className="grid grid-cols-2 gap-4 w-full">
        {question.options.map((word, index) => {
          const isCorrect = word.id === question.correctId
          const cardState: AnswerState =
            solved && isCorrect ? 'correct' :
            wrongIds.includes(word.id) ? 'wrong' :
            'idle'
          const edgeClass = TILE_EDGES[index % TILE_EDGES.length]
          const shaking = lastWrongId === word.id
          const cardDisabled = solved || wrongIds.includes(word.id)

          return useChineseOptions ? (
            <ChineseCard
              key={word.id}
              word={word}
              state={cardState}
              shaking={shaking}
              isCorrect={isCorrect}
              onClick={() => handleSelect(word.id)}
              disabled={cardDisabled}
              edgeClass={edgeClass}
            />
          ) : (
            <PictureCard
              key={word.id}
              word={word}
              state={cardState}
              shaking={shaking}
              isCorrect={isCorrect}
              onClick={() => handleSelect(word.id)}
              disabled={cardDisabled}
              edgeClass={edgeClass}
            />
          )
        })}
      </div>
    </div>
  )
}
