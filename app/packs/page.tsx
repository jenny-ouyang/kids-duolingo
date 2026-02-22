'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
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

  useEffect(() => {
    fetch('/api/packs')
      .then((r) => r.json())
      .then((data: PackMeta[]) => setPacks(data))
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

        {/* Pack grid */}
        <div className="grid grid-cols-2 gap-4">
          {packs.map((pack, i) => (
            <motion.button
              key={pack.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => router.push(`/practice/${pack.id}`)}
              className="relative rounded-3xl p-5 flex flex-col items-start gap-2 shadow-lg text-left overflow-hidden"
              style={{ background: pack.color }}
            >
              <span className="text-5xl">{pack.emoji}</span>
              <span className="text-xl font-extrabold text-white drop-shadow">{pack.name}</span>
              <span className="text-sm font-semibold text-white/80">{pack.nameZh}</span>
              <span className="text-xs text-white/70">{pack.wordCount} words</span>
              <MasteryRing percent={pack.masteryPct} />
            </motion.button>
          ))}
        </div>
      </div>
    </KidLayout>
  )
}
