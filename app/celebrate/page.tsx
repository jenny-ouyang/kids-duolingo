'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import Confetti from '@/components/celebration/Confetti'
import Mascot from '@/components/design/Mascot'
import PinyinToggle from '@/components/exercise/PinyinToggle'
import { Hills, Sparkles } from '@/components/design/Scenery'
import { wordEmoji, wordImageSrc } from '@/components/exercise/PictureChoice'
import { speakChinese } from '@/lib/tts'
import { playCelebrationSound, playStarSound, playStickerSound } from '@/lib/sounds'
import { hapticCelebrate } from '@/lib/haptics'
import { getEncouragement, SessionData, Encouragement } from '@/lib/encouragement'

interface Sticker {
  wordId: string
  chinese: string
  pinyin: string
  english: string
  image: string
  packId: string
}

function CelebrationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const subject = searchParams.get('subject') ?? 'chinese'
  const packId = searchParams.get('pack') ?? 'animals'
  const correct = Number(searchParams.get('correct') ?? 0)
  const total = Number(searchParams.get('total') ?? 8)
  const heartsEarned = Number(searchParams.get('hearts') ?? 0)

  const backHref = subject === 'math' ? '/math/topics' : '/packs'
  const playAgainHref = subject === 'math' ? `/math/practice/session?topic=${packId}` : `/practice/session?pack=${packId}`
  const isMath = subject === 'math'

  const stars = correct <= 2 ? 1 : correct <= 5 ? 2 : correct <= 7 ? 3 : 4

  const [enc, setEnc] = useState<Encouragement | null>(null)
  const [sticker, setSticker] = useState<Sticker | null>(null)
  const [showPinyin, setShowPinyin] = useState(false)
  // "Skip" (or a tap anywhere) jumps every entrance to its end state
  const [skipped, setSkipped] = useState(false)
  // Reduce Motion: no confetti and nothing to skip; parts only fade in (MotionConfig)
  const reduceMotion = useReducedMotion()
  const still = skipped || Boolean(reduceMotion)

  // Read the finished session once: it is removed from storage on read, and a
  // second effect run (React Strict Mode in dev) must not lose the sticker
  const sessionRef = useRef<(SessionData & { sticker?: Sticker | null }) | null>(null)

  useEffect(() => {
    if (!sessionRef.current) {
      sessionRef.current = { packId, packName: packId, subject, correctWords: [] }
      try {
        const raw = sessionStorage.getItem('lastSession')
        if (raw) {
          sessionRef.current = { ...sessionRef.current, ...(JSON.parse(raw) as SessionData & { sticker?: Sticker | null }) }
          sessionStorage.removeItem('lastSession')
        }
      } catch { /* sessionStorage unavailable */ }
    }
    const sessionData = sessionRef.current

    const encouragement = getEncouragement({
      ...sessionData,
      correct,
      total,
      hearts: heartsEarned,
    })
    setEnc(encouragement)
    setSticker(sessionData.sticker ?? null)

    playCelebrationSound()
    hapticCelebrate()
    Array.from({ length: stars }).forEach((_, i) => {
      playStarSound(300 + i * 150)
    })
    if (sessionData.sticker) setTimeout(playStickerSound, 700)

    setTimeout(() => {
      speakChinese(encouragement.chinesePhrase)
    }, 1200)
  }, [packId, subject, correct, total, heartsEarned, stars])

  if (!enc) return null

  // Entrance helper: after Skip, everything renders in its end state at once
  const enter = (initial: Record<string, number>, delay: number, extra: Record<string, unknown> = {}) =>
    skipped ? { initial: false as const } : { initial, transition: { delay, ...extra } }

  const starRow = Array.from({ length: stars }, (_, i) => (
    <motion.span
      key={i}
      {...enter({ scale: 0, rotate: -30 }, 0.3 + i * 0.15, { type: 'spring', stiffness: 300 })}
      animate={{ scale: 1, rotate: 0 }}
      className="font-emoji text-5xl"
    >
      ⭐
    </motion.span>
  ))

  const stickerArt = sticker
    ? wordImageSrc({ id: sticker.wordId, image: sticker.image } as Parameters<typeof wordImageSrc>[0])
    : null
  const stickerEmoji = sticker ? wordEmoji({ id: sticker.wordId, image: sticker.image } as Parameters<typeof wordEmoji>[0]) : null

  return (
    <>
      {!still && <Confetti count={40} />}
      {!still && (
        <button
          onClick={() => setSkipped(true)}
          className="pressable fixed top-4 right-4 z-[60] min-h-[44px] rounded-[14px] bg-white px-4 text-base font-extrabold text-ink shadow-press-chip"
          style={{ top: 'max(16px, env(safe-area-inset-top))' }}
        >
          Skip
        </button>
      )}

      <motion.div
        {...enter({ scale: 0.92, opacity: 0 }, 0, { type: 'spring', stiffness: 200 })}
        animate={{ scale: 1, opacity: 1 }}
        onClick={() => setSkipped(true)}
        className="relative z-10 flex flex-col items-center gap-4 text-center px-4 w-full max-w-md"
      >
        {/* Panda guide celebrates */}
        <Mascot say="太棒了!" size={68} />

        <motion.h1
          {...enter({ opacity: 0, y: 20 }, 0.3)}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl sm:text-4xl font-extrabold text-ink -mt-4"
        >
          {sticker ? 'New sticker!' : enc.heading}
        </motion.h1>

        {/* This session's word sticker (6-C) */}
        {sticker && (
          <motion.div
            {...enter({ y: -60, opacity: 0, rotate: -20 }, 0.5, { type: 'spring', stiffness: 260, damping: 16 })}
            animate={{ y: 0, opacity: 1, rotate: -5 }}
            className="flex flex-col items-center gap-2"
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                speakChinese(sticker.chinese)
              }}
              aria-label={`Your new sticker: ${sticker.chinese}, ${sticker.english}. Tap to hear it.`}
              className="pressable relative w-[130px] h-[130px] rounded-[28px] bg-white shadow-press-card flex items-center justify-center"
            >
              {stickerArt ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={stickerArt} alt="" className="w-[104px] h-[104px] object-contain" draggable={false} />
              ) : (
                <span className="font-emoji text-7xl">{stickerEmoji}</span>
              )}
              <span className="absolute -top-3 -right-3.5 rotate-[6deg] rounded-full bg-chinese-edge px-3 py-0.5 text-sm font-extrabold text-white shadow-press-chinese">
                NEW
              </span>
            </button>
          </motion.div>
        )}
        {sticker && (
          <div className="flex flex-col items-center">
            <span className="font-hanzi text-[30px] leading-tight text-ink border-b-[6px] border-gold">{sticker.chinese}</span>
            <span className="font-pinyin text-base font-bold text-chinese-edge mt-1">
              {sticker.pinyin} · {sticker.english}
            </span>
          </div>
        )}

        {/* Stars and the hearts, in one row */}
        <div className="flex items-center gap-2">
          <div className="flex gap-2" aria-label={`${stars} stars`}>{starRow}</div>
          {heartsEarned > 0 && (
            <span className="ml-2 bg-white rounded-full px-3.5 py-1.5 shadow-press-chip text-lg font-extrabold text-ink">
              +{heartsEarned} <span className="font-emoji" aria-hidden>❤️</span>
              <span className="sr-only"> hearts</span>
            </span>
          )}
        </div>

        {/* Chinese praise phrase — teaches through encouragement. With a sticker,
            the sticker word is this screen's Chinese, so the phrase stays out */}
        {!sticker && (
        <motion.div
          {...enter({ opacity: 0, scale: 0.9 }, 0.6)}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => speakChinese(enc.chinesePhrase)}
            className="pressable bg-white rounded-3xl px-7 py-3 shadow-press-card flex flex-col items-center gap-1 cursor-pointer"
          >
            <span className="font-hanzi text-3xl text-ink">{enc.chinesePhrase}</span>
            <span className={`font-pinyin text-base font-bold text-chinese-edge ${showPinyin ? '' : 'invisible'}`}>
              {enc.chinesePinyin}
            </span>
            <span className="text-base font-bold text-ink-mid">
              {enc.chineseMeaning} <span className="font-emoji">🔊</span>
            </span>
          </button>
          {/* Separate control: tapping the phrase plays audio, so reveal can't share that tap */}
          <PinyinToggle on={showPinyin} onToggle={() => setShowPinyin((v) => !v)} />
        </motion.div>
        )}

        {/* Action buttons */}
        <motion.div
          {...enter({ opacity: 0, y: 20 }, 1.0)}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 mt-1 w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {sticker ? (
            <button
              onClick={() => router.push('/stickers')}
              className="pressable min-h-[60px] bg-chinese text-white font-extrabold text-xl rounded-3xl py-4 px-8 shadow-press-chinese"
            >
              Put it in my book <span className="font-emoji">📒</span>
            </button>
          ) : (
            <button
              onClick={() => router.push(playAgainHref)}
              className={`pressable min-h-[60px] text-white font-extrabold text-xl rounded-3xl py-4 px-8 ${
                isMath ? 'bg-math shadow-press-math' : 'bg-chinese shadow-press-chinese'
              }`}
            >
              Keep going <span className="font-emoji">▶️</span>
            </button>
          )}
          <button
            onClick={() => router.push(backHref)}
            className="pressable min-h-[56px] bg-white text-ink font-extrabold text-lg rounded-3xl py-3 px-8 shadow-press-card"
          >
            {isMath ? 'Back to the topics' : 'Back to the path'}
          </button>
        </motion.div>

      </motion.div>
    </>
  )
}

export default function CelebratePage() {
  return (
    <div className="sunrise-canvas flex flex-col items-center justify-start p-4 py-10 pb-24">
      <Hills />
      <Sparkles />
      <Suspense fallback={<div className="font-emoji text-4xl animate-spin motion-reduce:animate-none relative z-10">🌟</div>}>
        <CelebrationContent />
      </Suspense>
    </div>
  )
}
