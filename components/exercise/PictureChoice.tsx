'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { speakChinese } from '@/lib/tts'
import { playCorrectSound, playWrongSound } from '@/lib/sounds'
import { hapticCorrect, hapticWrong } from '@/lib/haptics'
import { Word, ExerciseQuestion } from '@/lib/types'
import wordImageIds from '@/lib/word-images.json'
import { RightBand, NotQuiteBand, SayAgainButton, AnswerRow, LessonFeedback } from './FeedbackBand'

interface PictureChoiceProps {
  question: ExerciseQuestion
  /** Called when the child presses Next after the right tap; true = right on the first try */
  onAnswer: (correct: boolean) => void
  /** Child pressed the "pīn" toggle for this question */
  showPinyin: boolean
  /** 1-based question number and session length, for "Right! 2 of 8" */
  position: { n: number; total: number }
  onFeedback?: (feedback: LessonFeedback) => void
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
      className="absolute -top-2.5 -right-2.5 w-8 h-8 rounded-full bg-go text-white text-lg font-extrabold flex items-center justify-center"
    >
      ✓
    </motion.span>
  )
}

const SHAKE = { x: [-6, 6, -4, 4, 0] }

// ─── Option Card variants ────────────────────────────────────────────────────

/** New packs ship the emoji in word.image; legacy packs use the fallback map */
export function wordEmoji(word: Word): string | undefined {
  if (word.image && !word.image.startsWith('/')) return word.image
  return EMOJI_FALLBACKS[word.id]
}

// Custom Sunrise Playground illustrations (scripts/generate-images.sh).
// Words in the manifest render real art; everything else falls back to emoji.
const ILLUSTRATED = new Set<string>(wordImageIds as string[])
export function wordImageSrc(word: Word): string | null {
  return ILLUSTRATED.has(word.id) ? `/images/words/${word.id}.jpg` : null
}

function PictureCard({
  word, state, shaking, isCorrect, onClick, disabled, edgeClass,
}: {
  word: Word; state: AnswerState; shaking: boolean; isCorrect: boolean; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; disabled: boolean; edgeClass: string
}) {
  const emojiIcon = wordEmoji(word)
  const imageSrc = wordImageSrc(word)

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      animate={shaking ? SHAKE : {}}
      transition={{ duration: 0.3 }}
      className={`relative rounded-3xl p-4 flex flex-col items-center justify-center gap-2 transition-colors duration-200 cursor-pointer select-none ${tileClasses(state, isCorrect, edgeClass)}`}
      style={{ minHeight: 130 }}
    >
      {imageSrc ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageSrc} alt={word.english} className="w-[88px] h-[88px] object-contain rounded-2xl" draggable={false} />
          <span className="text-sm font-extrabold text-ink capitalize">{word.english}</span>
        </>
      ) : emojiIcon ? (
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
  word, state, shaking, isCorrect, onClick, disabled, edgeClass, showPinyin,
}: {
  word: Word; state: AnswerState; shaking: boolean; isCorrect: boolean; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; disabled: boolean; edgeClass: string; showPinyin: boolean
}) {
  // Pinyin is a hint, not a crutch: hidden until asked for, or shown on the solved tile
  const pinyinVisible = showPinyin || (state !== 'idle' && isCorrect)
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
      <span className={`font-pinyin text-base font-bold text-ink-mid ${pinyinVisible ? '' : 'invisible'}`}>{word.pinyin}</span>
      <AnimatePresence>
        {state !== 'idle' && isCorrect && <CorrectBadge />}
      </AnimatePresence>
    </motion.button>
  )
}

// ─── Prompt variants (Hanzi hero block — DESIGN.md) ──────────────────────────

function AudioPrompt({ word, pinyinVisible }: { word: Word; pinyinVisible: boolean }) {
  return (
    <div className="text-center flex flex-col items-center gap-2">
      <h1 className="text-[22px] font-extrabold text-ink leading-tight">Which one is</h1>
      <button
        onClick={() => speakChinese(word.chinese)}
        aria-label={`Hear ${word.chinese} again`}
        className="pressable bg-white rounded-3xl shadow-press-card px-7 py-4 flex flex-col items-center gap-2"
      >
        <span className="font-hanzi text-[52px] leading-tight text-ink border-b-[6px] border-gold pb-0.5">
          {word.chinese}
        </span>
        <span className="flex items-center gap-2">
          <span className={`font-pinyin text-lg font-bold text-chinese-edge ${pinyinVisible ? '' : 'invisible'}`}>{word.pinyin}</span>
          <span className="bg-gold rounded-full px-3 py-1 shadow-press-gold">
            <span className="font-emoji text-xl">🔊</span>
          </span>
        </span>
      </button>
    </div>
  )
}

// The word picture hops once on a right answer (a transform: skipped under Reduce Motion)
const HOP = { y: [0, -8, 0] }

function PicturePrompt({ word, solved }: { word: Word; solved: boolean }) {
  const emojiIcon = wordEmoji(word)
  const imageSrc = wordImageSrc(word)
  return (
    <div className="text-center flex flex-col items-center gap-2">
      <h1 className="text-[22px] font-extrabold text-ink leading-tight">What is this in Chinese?</h1>
      {imageSrc ? (
        <motion.img
          src={imageSrc}
          alt={word.english}
          className="w-40 h-40 object-contain rounded-3xl"
          draggable={false}
          animate={solved ? HOP : {}}
          transition={{ duration: 0.3 }}
        />
      ) : emojiIcon ? (
        <motion.div className="font-emoji text-8xl leading-none" animate={solved ? HOP : {}} transition={{ duration: 0.3 }}>
          {emojiIcon}
        </motion.div>
      ) : (
        <div className="bg-white rounded-3xl px-8 py-4 shadow-press-card">
          <span className="text-4xl font-extrabold text-ink capitalize">{word.english}</span>
        </div>
      )}
    </div>
  )
}

function EnglishPrompt({ word }: { word: Word }) {
  // English alone is a wall of text to a pre-reader — pair it with the word's
  // picture whenever one exists (illustration first, emoji otherwise).
  const emojiIcon = wordEmoji(word)
  const imageSrc = wordImageSrc(word)
  return (
    <div className="text-center flex flex-col items-center gap-2">
      <h1 className="text-[22px] font-extrabold text-ink leading-tight">How do you say this in Chinese?</h1>
      <div className="bg-white rounded-3xl px-8 py-4 shadow-press-card flex flex-col items-center gap-2">
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageSrc} alt="" className="w-28 h-28 object-contain rounded-2xl" draggable={false} />
        ) : emojiIcon ? (
          <span className="font-emoji text-6xl leading-none">{emojiIcon}</span>
        ) : null}
        <span className="text-4xl font-extrabold text-ink capitalize">{word.english}</span>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PictureChoice({ question, onAnswer, showPinyin, position, onFeedback }: PictureChoiceProps) {
  // Stay-until-right: wrong taps gray out and the question waits for the correct
  // tap. Only the FIRST tap feeds the memory system (onAnswer), so retry kindness
  // never corrupts the spaced-repetition data. The page remounts this per question.
  const [wrongIds, setWrongIds] = useState<string[]>([])
  const [lastWrongId, setLastWrongId] = useState<string | null>(null)
  const [solved, setSolved] = useState(false)
  const target = question.word

  // Auto-play audio when question loads (for audio type) or on all types as reinforcement
  useEffect(() => {
    const timer = setTimeout(() => {
      if (question.type === 'audio_to_picture') {
        speakChinese(question.word.chinese)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [question.word.chinese, question.type])

  function handleSelect(wordId: string, e: React.MouseEvent<HTMLButtonElement>) {
    if (solved || wrongIds.includes(wordId)) return
    const correct = wordId === question.correctId

    if (correct) {
      setSolved(true)
      playCorrectSound()
      hapticCorrect()
      setTimeout(() => speakChinese(target.chinese), 150)
      onFeedback?.({ mood: 'yes', earnsHeart: wrongIds.length === 0, from: e.currentTarget.getBoundingClientRect() })
    } else {
      playWrongSound()
      hapticWrong()
      setWrongIds((ids) => [...ids, wordId])
      setLastWrongId(wordId)
      setTimeout(() => setLastWrongId(null), 400)
      // Re-speak the target word — a hint through the ears, not a reveal
      setTimeout(() => speakChinese(target.chinese), 450)
      onFeedback?.({ mood: 'listen' })
    }
  }

  const useChineseOptions =
    question.type === 'picture_to_chinese' || question.type === 'english_to_chinese'

  const lastWrong = question.options.find((w) => w.id === wrongIds[wrongIds.length - 1])
  const reason = lastWrong
    ? question.type === 'audio_to_picture'
      ? `That one is ${lastWrong.english}. Listen again and find ${target.chinese}.`
      : `That one means ${lastWrong.english}. Listen to the right word and try again.`
    : ''

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      {/* Prompt */}
      {question.type === 'audio_to_picture' && <AudioPrompt word={target} pinyinVisible={showPinyin || solved} />}
      {question.type === 'picture_to_chinese' && <PicturePrompt word={target} solved={solved} />}
      {question.type === 'english_to_chinese' && <EnglishPrompt word={target} />}

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
              onClick={(e) => handleSelect(word.id, e)}
              disabled={cardDisabled}
              edgeClass={edgeClass}
              showPinyin={showPinyin}
            />
          ) : (
            <PictureCard
              key={word.id}
              word={word}
              state={cardState}
              shaking={shaking}
              isCorrect={isCorrect}
              onClick={(e) => handleSelect(word.id, e)}
              disabled={cardDisabled}
              edgeClass={edgeClass}
            />
          )
        })}
      </div>

      {/* Wrong tap: a kind band with the reason; the question waits for the right tile */}
      {wrongIds.length > 0 && !solved && (
        <NotQuiteBand reason={reason}>
          <SayAgainButton label={`Hear ${target.chinese} again`} onClick={() => speakChinese(target.chinese)}>
            <span className="font-hanzi">{target.chinese}</span>
          </SayAgainButton>
        </NotQuiteBand>
      )}

      {/* Right tap: the child reads the word, then presses Next */}
      <AnimatePresence>
        {solved && (
          <RightBand title={`Right! ${position.n} of ${position.total}`} onNext={() => onAnswer(wrongIds.length === 0)}>
            <AnswerRow
              chinese={target.chinese}
              pinyin={target.pinyin}
              english={target.english}
              onSpeak={() => speakChinese(target.chinese)}
            />
          </RightBand>
        )}
      </AnimatePresence>
    </div>
  )
}
