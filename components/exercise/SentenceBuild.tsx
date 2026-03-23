'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SentenceQuestion } from '@/lib/types'
import { speakChinese } from '@/lib/tts'
import { playCorrectSound, playWrongSound } from '@/lib/sounds'

// Each character gets a distinct vivid color — consistent as it moves bank ↔ slot
const TILE_COLORS = [
  { bg: 'bg-pink-400',   shadow: 'shadow-pink-200',   text: 'text-white' },
  { bg: 'bg-violet-500', shadow: 'shadow-violet-200',  text: 'text-white' },
  { bg: 'bg-cyan-400',   shadow: 'shadow-cyan-200',    text: 'text-white' },
  { bg: 'bg-emerald-400',shadow: 'shadow-emerald-200', text: 'text-white' },
  { bg: 'bg-amber-400',  shadow: 'shadow-amber-200',   text: 'text-white' },
  { bg: 'bg-rose-400',   shadow: 'shadow-rose-200',    text: 'text-white' },
]

interface Props {
  question: SentenceQuestion
  onAnswer: (correct: boolean) => void
}

export default function SentenceBuild({ question, onAnswer }: Props) {
  const { sentence, tiles } = question
  const slotCount = sentence.chinese.length

  // Assign a color to each unique character — stable across bank/slot moves
  const colorMap = Object.fromEntries(
    sentence.chinese.map((char, i) => [char, TILE_COLORS[i % TILE_COLORS.length]])
  )

  const [placed, setPlaced] = useState<string[]>([])
  const [bank, setBank] = useState<string[]>(tiles)
  const [shaking, setShaking] = useState(false)
  const [showPinyin, setShowPinyin] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)

  const pendingTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => {
    return () => pendingTimers.current.forEach(clearTimeout)
  }, [])

  function schedule(fn: () => void, ms: number) {
    const id = setTimeout(fn, ms)
    pendingTimers.current.push(id)
  }

  function tapBankTile(tile: string, bankIndex: number) {
    if (placed.length >= slotCount || shaking || showPinyin) return
    speakChinese(tile)

    const newPlaced = [...placed, tile]
    const newBank = bank.filter((_, i) => i !== bankIndex)
    setPlaced(newPlaced)
    setBank(newBank)

    if (newPlaced.length === slotCount) {
      const correct = newPlaced.join('') === sentence.chinese.join('')
      if (correct) {
        playCorrectSound()
        setIsCorrect(true)
        setShowPinyin(true)
        schedule(() => speakChinese(sentence.chinese.join('')), 300)
        schedule(() => onAnswer(true), 1500)
      } else {
        playWrongSound()
        setShaking(true)
        schedule(() => {
          setShaking(false)
          setPlaced([])
          setBank(tiles)
        }, 800)
      }
    }
  }

  function tapPlacedTile(tile: string, placedIndex: number) {
    if (shaking || showPinyin) return
    setPlaced(placed.filter((_, i) => i !== placedIndex))
    setBank([...bank, tile])
  }

  return (
    <div className="flex flex-col items-center gap-8 w-full px-2">

      {/* Prompt */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-3 text-center"
      >
        {sentence.emoji && (
          <motion.span
            className="text-6xl leading-none"
            animate={{ rotate: [0, -6, 6, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
          >
            {sentence.emoji}
          </motion.span>
        )}
        <p className="text-2xl font-extrabold text-gray-700 leading-snug max-w-xs">
          {sentence.english}
        </p>
        <p className="text-xs font-bold text-blue-300 uppercase tracking-[0.2em]">
          tap the tiles in order
        </p>
      </motion.div>

      {/* Answer slots */}
      <motion.div
        className="flex gap-3 flex-wrap justify-center"
        animate={shaking ? { x: [0, -12, 12, -10, 10, -6, 6, 0] } : {}}
        transition={{ duration: 0.55 }}
      >
        {Array.from({ length: slotCount }).map((_, i) => {
          const tile = placed[i]
          const color = tile ? colorMap[tile] : null

          return (
            <motion.button
              key={i}
              onClick={() => tile && tapPlacedTile(tile, i)}
              animate={isCorrect && tile ? { scale: [1, 1.2, 0.95, 1.05, 1] } : { scale: 1 }}
              transition={{ delay: isCorrect ? i * 0.08 : 0, duration: 0.5, type: 'spring' }}
              className={`
                relative w-[72px] h-[72px] rounded-2xl flex items-center justify-center
                text-3xl font-black select-none
                transition-colors duration-200
                ${tile
                  ? `${color!.bg} ${color!.text} shadow-lg ${color!.shadow} active:scale-95 cursor-pointer`
                  : 'bg-white/50 border-[2.5px] border-dashed border-blue-200 cursor-default'
                }
              `}
            >
              <AnimatePresence mode="wait">
                {tile && (
                  <motion.span
                    key={tile}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.4, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                    className="block leading-none"
                  >
                    {tile}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          )
        })}
      </motion.div>

      {/* Pinyin — appears on correct */}
      <AnimatePresence>
        {showPinyin && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="bg-white/80 backdrop-blur-sm rounded-2xl px-6 py-3 shadow-sm border border-blue-100"
          >
            <p className="text-base font-semibold text-blue-500 tracking-wide text-center">
              {sentence.pinyin}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Divider */}
      <div className="w-full max-w-[280px] h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent" />

      {/* Tile bank */}
      <div className="flex gap-3 flex-wrap justify-center min-h-[80px]">
        <AnimatePresence>
          {bank.map((tile, i) => {
            const color = colorMap[tile]
            return (
              <motion.button
                key={`${tile}-${i}`}
                initial={{ scale: 0.6, opacity: 0, y: 16 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.6, opacity: 0, y: -8 }}
                whileHover={{ scale: 1.1, y: -4 }}
                whileTap={{ scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                onClick={() => tapBankTile(tile, i)}
                disabled={shaking || showPinyin}
                className={`
                  w-[72px] h-[72px] rounded-2xl flex items-center justify-center
                  ${color.bg} ${color.text}
                  text-3xl font-black select-none
                  shadow-lg ${color.shadow}
                  disabled:opacity-40 disabled:cursor-not-allowed
                  cursor-pointer
                `}
              >
                {tile}
              </motion.button>
            )
          })}
        </AnimatePresence>
      </div>

    </div>
  )
}
