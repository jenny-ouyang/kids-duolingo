'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import KidLayout from '@/components/layout/KidLayout'

interface PackMeta {
  id: string
  name: string
  nameZh: string
  emoji: string
  color: string
  wordCount: number
  masteryPct: number
}

function MasteryRing({ percent }: { percent: number }) {
  const r = 20
  const circumference = 2 * Math.PI * r
  const offset = circumference - (percent / 100) * circumference

  return (
    <svg width="52" height="52" className="absolute top-2 right-2">
      <circle cx="26" cy="26" r={r} fill="none" stroke="white" strokeOpacity={0.4} strokeWidth="4" />
      <motion.circle
        cx="26"
        cy="26"
        r={r}
        fill="none"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: 'easeOut' }}
        transform="rotate(-90 26 26)"
      />
      <text x="26" y="31" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
        {percent}%
      </text>
    </svg>
  )
}

export default function PacksPage() {
  const router = useRouter()
  const [packs, setPacks] = useState<PackMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'learning' | 'mastered'>('learning')

  useEffect(() => {
    fetch('/api/packs')
      .then((r) => r.json())
      .then((data: PackMeta[]) => {
        if (Array.isArray(data)) setPacks(data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <KidLayout>
        <div className="text-6xl animate-spin">🌟</div>
      </KidLayout>
    )
  }

  const learning = packs.filter((p) => p.masteryPct < 100)
  const mastered = packs.filter((p) => p.masteryPct === 100)
  const visible = tab === 'learning' ? learning : mastered

  return (
    <KidLayout className="justify-start pt-8">
      <div className="w-full max-w-2xl flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="bg-white/70 rounded-2xl px-4 py-2 text-2xl shadow-sm hover:bg-white transition-colors"
          >
            ←
          </button>
          <h1 className="text-3xl font-extrabold text-blue-700">Choose a Pack</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-white/60 rounded-2xl p-1 shadow-sm">
          <button
            onClick={() => setTab('learning')}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
              tab === 'learning'
                ? 'bg-blue-500 text-white shadow'
                : 'text-blue-400 hover:text-blue-600'
            }`}
          >
            Learning {learning.length > 0 && `(${learning.length})`}
          </button>
          <button
            onClick={() => setTab('mastered')}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
              tab === 'mastered'
                ? 'bg-green-500 text-white shadow'
                : 'text-green-500 hover:text-green-700'
            }`}
          >
            Mastered ⭐ {mastered.length > 0 && `(${mastered.length})`}
          </button>
        </div>

        {/* Pack grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-2 gap-4"
          >
            {visible.length === 0 ? (
              <div className="col-span-2 text-center text-gray-400 py-12 text-lg">
                {tab === 'mastered' ? 'No packs mastered yet — keep going! 🌟' : 'All packs mastered! 🎉'}
              </div>
            ) : (
              visible.map((pack, i) => (
                <motion.button
                  key={pack.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => router.push(pack.id === 'sentences' ? '/practice/sentences' : `/practice/${pack.id}`)}
                  className="relative rounded-3xl p-5 flex flex-col items-start gap-2 shadow-lg text-left overflow-hidden"
                  style={{ background: pack.color }}
                >
                  <span className="text-5xl">{pack.emoji}</span>
                  <span className="text-xl font-extrabold text-white drop-shadow">{pack.name}</span>
                  <span className="text-sm font-semibold text-white/80">{pack.nameZh}</span>
                  <span className="text-xs text-white/70">{pack.id === 'sentences' ? `${pack.wordCount} sentences` : `${pack.wordCount} words`}</span>
                  <MasteryRing percent={pack.masteryPct} />
                </motion.button>
              ))
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </KidLayout>
  )
}
