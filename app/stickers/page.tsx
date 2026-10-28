'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import KidLayout from '@/components/layout/KidLayout'
import { Hills, Sun } from '@/components/design/Scenery'
import { wordEmoji, wordImageSrc } from '@/components/exercise/PictureChoice'
import { fetchJsonCached } from '@/lib/api-fetch'
import { speakChinese } from '@/lib/tts'
import type { Word } from '@/lib/types'

interface BookWord {
  id: string
  chinese: string
  english: string
  image: string
  collected: boolean
}

interface BookPage {
  id: string
  name: string
  nameZh: string
  emoji: string
  count: number
  words: BookWord[]
}

/** One sticker slot. A tap speaks the word, so the reward is also review. */
function StickerSlot({ word, isNew }: { word: BookWord; isNew: boolean }) {
  const [wiggle, setWiggle] = useState(0)
  if (!word.collected) {
    return (
      <div
        role="img"
        aria-label="Not collected yet"
        className="aspect-square rounded-[20px] bg-chip-track flex items-center justify-center text-[26px] font-extrabold text-ink-mid"
      >
        ?
      </div>
    )
  }
  const asWord = { id: word.id, image: word.image } as Word
  const art = wordImageSrc(asWord)
  return (
    <motion.button
      key={wiggle}
      onClick={() => {
        setWiggle((n) => n + 1)
        speakChinese(word.chinese)
      }}
      animate={wiggle ? { rotate: [0, -6, 6, 0] } : {}}
      transition={{ duration: 0.2 }}
      aria-label={`${word.chinese}, ${word.english}. Tap to hear it.`}
      className="pressable relative aspect-square rounded-[20px] bg-white shadow-press-card flex flex-col items-center justify-center gap-1"
    >
      {art ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={art} alt="" className="w-[58px] h-[58px] object-contain" draggable={false} />
      ) : (
        <span className="font-emoji text-[44px] leading-none">{wordEmoji(asWord)}</span>
      )}
      <span className="font-hanzi text-base text-ink leading-none">{word.chinese}</span>
      {isNew && (
        <span className="absolute -top-2 -right-2 rotate-[6deg] rounded-full bg-chinese-edge px-2 text-sm font-extrabold text-white">
          NEW
        </span>
      )}
    </motion.button>
  )
}

/** Panda's sticker book (6-C): one page per pack, empty slots show "?" */
export default function StickersPage() {
  const router = useRouter()
  const [book, setBook] = useState<{ newestWordId: string | null; pages: BookPage[] } | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetchJsonCached<{ newestWordId: string | null; pages: BookPage[] }>('/api/stickers').then(({ ok, status, data }) => {
      if (status === 403) return router.replace('/welcome')
      if (ok && data) setBook(data)
      else setFailed(true)
    })
  }, [router])

  return (
    <KidLayout align="top" className="pb-16">
      <Sun scale={0.8} />
      <Hills />
      <div className="relative z-10 w-full max-w-md flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            aria-label="Back to home"
            className="pressable bg-white rounded-2xl w-14 h-14 flex items-center justify-center text-2xl text-ink shadow-press-chip"
          >
            ←
          </button>
          <h1 className="text-[27px] font-extrabold text-ink">
            My stickers <span className="font-emoji">📒</span>
          </h1>
        </div>

        {failed && <p className="text-lg font-bold text-ink-mid">The sticker book is taking a nap. Try again soon!</p>}

        {book && book.pages.length === 0 && (
          <div className="bg-white rounded-[22px] shadow-press-card p-5 flex flex-col items-center gap-3 text-center">
            <span className="font-emoji text-5xl" aria-hidden>🐼</span>
            <p className="text-lg font-extrabold text-ink">No stickers yet.</p>
            <p className="text-base font-bold text-ink-mid">Finish a lesson to win your first word sticker.</p>
            <button
              onClick={() => router.push('/')}
              className="pressable min-h-[56px] w-full rounded-[22px] bg-chinese text-white text-lg font-extrabold shadow-press-chinese"
            >
              Play next <span className="font-emoji">▶️</span>
            </button>
          </div>
        )}

        {book?.pages.map((page) => (
          <section key={page.id} aria-label={`${page.name} stickers`} className="flex flex-col gap-3">
            <div className="bg-white rounded-[22px] shadow-press-card px-4 py-2.5 flex items-center gap-2.5">
              <span className="font-emoji text-2xl" aria-hidden>{page.emoji}</span>
              <h2 className="text-[17px] font-extrabold text-ink">
                {page.name} {page.nameZh && <span className="font-hanzi font-normal text-chinese-edge">{page.nameZh}</span>}
              </h2>
              <span className="ml-auto text-base font-extrabold text-ink tabular-nums">
                {page.count} / {page.words.length}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {page.words.map((w) => (
                <StickerSlot key={w.id} word={w} isNew={w.id === book.newestWordId} />
              ))}
            </div>
          </section>
        ))}

        {book && book.pages.length > 0 && (
          <p className="text-base font-bold text-ink-mid text-center">Tap a sticker to hear its word.</p>
        )}
      </div>
    </KidLayout>
  )
}
