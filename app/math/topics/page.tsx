'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import KidLayout from '@/components/layout/KidLayout'
import { fetchJsonWithAuthRetry } from '@/lib/api-fetch'

interface TopicMeta {
  id: string
  name: string
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

export default function MathTopicsPage() {
  const router = useRouter()
  const [topics, setTopics] = useState<TopicMeta[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    fetchJsonWithAuthRetry<TopicMeta[]>('/api/packs?subject=math').then(({ ok, status, data }) => {
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
        <div className="text-6xl animate-spin">🌟</div>
      </KidLayout>
    )
  }

  if (status === 'error') {
    return (
      <KidLayout>
        <p className="text-2xl font-bold text-red-400">Oops! Could not load the topics.</p>
        <button
          onClick={() => router.push('/')}
          className="mt-6 bg-blue-500 text-white rounded-2xl px-8 py-4 text-xl font-bold"
        >
          Go Back
        </button>
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
          <div className="flex items-center gap-2">
            <span className="text-3xl">➕</span>
            <h1 className="text-3xl font-extrabold text-blue-700">Math</h1>
          </div>
        </div>

        {/* Topic grid */}
        <div className="grid grid-cols-2 gap-4">
          {topics.map((topic, i) => (
            <motion.button
              key={topic.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => router.push(`/math/practice/${topic.id}`)}
              className="relative rounded-3xl p-5 flex flex-col items-start gap-2 shadow-lg text-left overflow-hidden"
              style={{ background: topic.color }}
            >
              <span className="text-5xl">{topic.emoji}</span>
              <span className="text-xl font-extrabold text-white drop-shadow">{topic.name}</span>
              <span className="text-xs text-white/70">{topic.wordCount} problems</span>
              <MasteryRing percent={topic.masteryPct} />
            </motion.button>
          ))}
        </div>
      </div>
    </KidLayout>
  )
}
