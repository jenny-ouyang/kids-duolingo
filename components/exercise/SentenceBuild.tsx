'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SentenceQuestion } from '@/lib/types'
import { speakChinese } from '@/lib/tts'
import { playCorrectSound, playWrongSound } from '@/lib/sounds'

interface Props {
  question: SentenceQuestion
  onAnswer: (correct: boolean) => void
}

export default function SentenceBuild({ question, onAnswer }: Props) {
  const { sentence, tiles } = question
  const slotCount = sentence.chinese.length

  const [placed, setPlaced] = useState<string[]>([])
  const [bank, setBank] = useState<string[]>(tiles)
  const [shaking, setShaking] = useState(false)
  const [showPinyin, setShowPinyin] = useState(false)

  // Track all pending timeouts so we can cancel them if the component unmounts
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
        setShowPinyin(true)
        schedule(() => speakChinese(sentence.chinese.join('')), 300)
        schedule(() => onAnswer(true), 1200)
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
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Prompt */}
      <div className="flex items-center gap-3 text-center">
        {sentence.emoji && (
          <span className="text-5xl">{sentence.emoji}</span>
        )}
        <p className="text-2xl font-bold text-gray-700 leading-snug">
          {sentence.english}
        </p>
      </div>

      {/* Answer slots */}
      <motion.div
        className="flex gap-3 flex-wrap justify-center"
        animate={shaking ? { x: [0, -8, 8, -8, 8, -4, 4, 0] } : {}}
        transition={{ duration: 0.5 }}
      >
        {Array.from({ length: slotCount }).map((_, i) => {
          const tile = placed[i]
          return (
            <button
              key={i}
              onClick={() => tile && tapPlacedTile(tile, i)}
              className={`
                min-w-[64px] h-16 px-3 rounded-2xl border-2 text-3xl font-bold shadow-sm
                transition-all duration-150
                ${tile
                  ? 'bg-white border-blue-400 text-gray-800 active:scale-95'
                  : 'bg-blue-50 border-blue-200 text-transparent'
                }
              `}
            >
              {tile ?? '　'}
            </button>
          )
        })}
      </motion.div>

      {/* Pinyin — revealed after correct */}
      <AnimatePresence>
        {showPinyin && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-lg text-gray-400 tracking-wide"
          >
            {sentence.pinyin}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Tile bank */}
      <div className="flex gap-3 flex-wrap justify-center mt-2">
        {bank.map((tile, i) => (
          <button
            key={`${tile}-${i}`}
            onClick={() => tapBankTile(tile, i)}
            disabled={shaking || showPinyin}
            className="
              min-w-[64px] h-16 px-3 bg-white rounded-2xl border-2 border-gray-200
              text-3xl font-bold text-gray-800 shadow-md
              active:scale-95 disabled:opacity-50
              transition-transform duration-100
            "
          >
            {tile}
          </button>
        ))}
      </div>
    </div>
  )
}
