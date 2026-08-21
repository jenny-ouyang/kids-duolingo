'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import KidLayout from '@/components/layout/KidLayout'
import { Hills, Sparkles, Sun } from '@/components/design/Scenery'
import { fetchJsonCached } from '@/lib/api-fetch'

interface TopicMeta {
  id: string
  name: string
  emoji: string
  color: string
  wordCount: number
  masteryPct: number
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

export default function MathTopicsPage() {
  const router = useRouter()
  const [topics, setTopics] = useState<TopicMeta[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    fetchJsonCached<TopicMeta[]>('/api/packs?subject=math').then(({ ok, status, data }) => {
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
      setTopics(data)
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
        <div className="relative z-10 font-emoji text-6xl animate-spin">🌟</div>
      </KidLayout>
    )
  }

  if (status === 'error') {
    return (
      <KidLayout>
        <Hills />
        <div className="relative z-10 flex flex-col items-center">
          <p className="text-xl font-extrabold text-ink text-center">
            Oops! Could not load the topics.
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

  return (
    <KidLayout className="justify-start pt-6 pb-16">
      <Sun scale={0.8} />
      <Sparkles positions="sparse" />
      <Hills />

      <div className="relative z-10 w-full max-w-md flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            aria-label="Back to home"
            className="pressable bg-white rounded-2xl w-14 h-14 flex items-center justify-center text-2xl text-ink shadow-press-chip"
          >
            ←
          </button>
          <h1 className="text-[27px] font-extrabold text-ink">
            Math <span className="font-hanzi text-xl text-math font-normal">数学</span>
          </h1>
        </div>

        {/* Topic rows */}
        <div className="flex flex-col gap-4">
          {topics.map((topic, i) => (
            <motion.div
              key={topic.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <button
                onClick={() => router.push(`/math/practice/session?topic=${topic.id}`)}
                className="pressable w-full min-h-[72px] bg-white rounded-[22px] px-4 py-3 flex items-center gap-4 text-left shadow-press-card"
              >
                <span className="font-emoji text-[34px] leading-none bg-[#E4EFFD] rounded-2xl px-2.5 py-1.5 rotate-[-4deg]">
                  {topic.emoji}
                </span>
                <span className="flex flex-col min-w-0">
                  <span className="text-lg font-extrabold text-ink leading-tight truncate">
                    {topic.name}
                  </span>
                  <span className="text-xs font-bold text-ink-soft">{topic.wordCount} problems</span>
                </span>
                <MasteryRing percent={topic.masteryPct} />
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </KidLayout>
  )
}
