'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import KidLayout from '@/components/layout/KidLayout'
import { Hills, Sparkles, Sun } from '@/components/design/Scenery'
import { fetchJsonCached } from '@/lib/api-fetch'
import PackPath, { suggestedIndex } from '@/components/home/PackPath'
import AskGrownUp from '@/components/kid/AskGrownUp'

interface PackMeta {
  id: string
  name: string
  nameZh: string
  emoji: string
  color: string
  wordCount: number
  learned: number
  masteryPct: number
  /** Paid pack and payments are on (the server decides) */
  locked?: boolean
}

/** Mastery ring per DESIGN.md: conic success on chip-track, ink % on a white core */
function MasteryRing({ percent }: { percent: number }) {
  return (
    <div
      role="img"
      aria-label={`${percent}% mastered`}
      className="ml-auto w-12 h-12 rounded-full shrink-0 flex items-center justify-center"
      style={{ background: `conic-gradient(#1FA88C 0 ${percent}%, #F5E9CC ${percent}% 100%)` }}
    >
      <span className="bg-white rounded-full w-8 h-8 flex items-center justify-center text-xs font-extrabold text-ink">
        {percent}%
      </span>
    </div>
  )
}

export default function PacksPage() {
  const router = useRouter()
  const [packs, setPacks] = useState<PackMeta[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [tab, setTab] = useState<'learning' | 'mastered'>('learning')
  // The path is the default view; "See all" opens the full list with its tabs
  const [showAll, setShowAll] = useState(false)
  // A locked (paid) pack opens the Ask-a-grown-up card, never a price
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchJsonCached<PackMeta[]>('/api/packs').then(({ ok, status, data }) => {
      if (cancelled) return
      if (status === 403) {
        // Authed but no child yet — first visit, go set one up
        router.replace('/welcome')
        return
      }
      if (!ok || !Array.isArray(data)) {
        setStatus('error')
        return
      }
      setPacks(data)
      setStatus('ready')
    })
    return () => {
      cancelled = true
    }
  }, [router])

  if (status === 'loading') {
    return (
      <KidLayout>
        <Hills />
        <div className="relative z-10 font-emoji text-6xl animate-spin motion-reduce:animate-none">🌟</div>
      </KidLayout>
    )
  }

  if (status === 'error') {
    return (
      <KidLayout>
        <Hills />
        <div className="relative z-10 flex flex-col items-center">
          <p className="text-xl font-extrabold text-ink text-center">
            Oops! Could not load the packs.
          </p>
          <button
            onClick={() => router.push('/')}
            className="pressable mt-6 min-h-[56px] bg-white text-ink rounded-3xl px-8 py-4 text-lg font-extrabold shadow-press-card"
          >
            Go Back
          </button>
        </div>
      </KidLayout>
    )
  }

  const openPack = (pack: { id: string; locked?: boolean }) => {
    if (pack.locked) {
      setAsking(true)
      return
    }
    router.push(pack.id === 'sentences' ? '/practice/sentences' : `/practice/session?pack=${pack.id}`)
  }
  const next = suggestedIndex(packs)
  // 7 stops around the suggested one: one behind, the rest ahead
  const windowStart = Math.max(0, Math.min(next - 1, packs.length - 7))
  const pathPacks = packs.slice(windowStart, windowStart + 7)

  const learning = packs.filter((p) => p.masteryPct < 100)
  const mastered = packs.filter((p) => p.masteryPct === 100)
  const visible = tab === 'learning' ? learning : mastered

  return (
    <KidLayout align="top" className="pb-16">
      <Sun scale={0.8} />
      <Sparkles positions="sparse" />
      <Hills />
      {asking && (
        <div className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-[#6B4423]/30">
          <AskGrownUp onClose={() => setAsking(false)} />
        </div>
      )}

      <div className="relative z-10 w-full max-w-md flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => (showAll ? setShowAll(false) : router.push('/'))}
            aria-label={showAll ? 'Back to the path' : 'Back to home'}
            className="pressable bg-white rounded-2xl w-14 h-14 flex items-center justify-center text-2xl text-ink shadow-press-chip"
          >
            ←
          </button>
          <h1 className="text-[27px] font-extrabold text-ink">
            {showAll ? 'All packs' : 'Chinese path'}{' '}
            <span className="font-hanzi text-xl text-chinese-edge font-normal">中文</span>
          </h1>
        </div>

        {!showAll && packs.length > 0 && (
          <>
            <PackPath packs={pathPacks} nextId={packs[next].id} onOpen={openPack} />
            <button
              onClick={() => setShowAll(true)}
              className="pressable w-full min-h-[56px] rounded-[22px] bg-white text-ink text-lg font-extrabold shadow-press-card"
            >
              See all {packs.length} packs
            </button>
          </>
        )}

        {showAll && (
        <>
        {/* Tabs */}
        <div className="flex gap-3">
          <button
            onClick={() => setTab('learning')}
            className={`pressable flex-1 min-h-[56px] rounded-full py-3 text-[15px] font-extrabold ${
              tab === 'learning'
                ? 'bg-go text-white shadow-press-go'
                : 'bg-white text-ink-mid shadow-press-chip'
            }`}
          >
            Learning {learning.length > 0 && `(${learning.length})`}
          </button>
          <button
            onClick={() => setTab('mastered')}
            className={`pressable flex-1 min-h-[56px] rounded-full py-3 text-[15px] font-extrabold ${
              tab === 'mastered'
                ? 'bg-go text-white shadow-press-go'
                : 'bg-white text-ink-mid shadow-press-chip'
            }`}
          >
            Mastered <span className="font-emoji">⭐</span>{' '}
            {mastered.length > 0 && `(${mastered.length})`}
          </button>
        </div>

        {/* Pack rows */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-4"
          >
            {visible.length === 0 ? (
              <div className="text-center text-ink-mid font-bold py-12 text-[15px]">
                {tab === 'mastered' ? 'No packs mastered yet — keep going! 🌟' : 'All packs mastered! 🎉'}
              </div>
            ) : (
              visible.map((pack, i) => (
                // Only the first rows ease in; the rest render at once (33 rows staggered
                // left the last ten invisible for 3 s)
                <motion.div
                  key={pack.id}
                  initial={i < 6 ? { opacity: 0, y: 20 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={i < 6 ? { delay: i * 0.06 } : undefined}
                >
                  <button
                    onClick={() => openPack(pack)}
                    aria-label={pack.locked ? `${pack.name}, locked` : undefined}
                    className={`pressable w-full min-h-[72px] bg-white rounded-[22px] px-4 py-3 flex items-center gap-4 text-left shadow-press-card ${
                      pack.locked ? 'opacity-70' : ''
                    }`}
                  >
                    <span className="font-emoji text-[34px] leading-none bg-[#FFF3D6] rounded-2xl px-2.5 py-1.5 rotate-[-4deg]">
                      {pack.emoji}
                    </span>
                    <span className="flex flex-col min-w-0">
                      <span className="text-lg font-extrabold text-ink leading-tight truncate">
                        {pack.name}
                      </span>
                      <span className="font-hanzi text-[15px] text-chinese-edge leading-tight">
                        {pack.nameZh}
                      </span>
                      <span className="text-base font-bold text-ink-mid">
                        {pack.id === 'sentences' ? `${pack.wordCount} sentences` : `${pack.wordCount} words`}
                      </span>
                    </span>
                    {pack.locked && (
                      <span className="font-emoji text-lg leading-none" aria-hidden>🔒</span>
                    )}
                    <MasteryRing percent={pack.masteryPct} />
                  </button>
                </motion.div>
              ))
            )}
          </motion.div>
        </AnimatePresence>
        </>
        )}
      </div>
    </KidLayout>
  )
}
