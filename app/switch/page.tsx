'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import KidLayout from '@/components/layout/KidLayout'
import { setActiveChild } from '@/lib/child-cookie'

interface ChildSummary {
  id: string
  name: string
  avatar: string
  totalHearts: number
  streak: number
}

const TILE_GRADIENTS = [
  'bg-gradient-to-br from-orange-400 to-red-500',
  'bg-gradient-to-br from-blue-500 to-purple-600',
  'bg-gradient-to-br from-green-400 to-emerald-500',
  'bg-gradient-to-br from-pink-400 to-rose-500',
  'bg-gradient-to-br from-yellow-400 to-orange-500',
  'bg-gradient-to-br from-cyan-400 to-blue-500',
]

export default function SwitchPage() {
  const router = useRouter()
  const [children, setChildren] = useState<ChildSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/children')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ChildSummary[]) => {
        if (Array.isArray(data)) setChildren(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function pickChild(id: string) {
    setActiveChild(id)
    router.push('/')
  }

  if (loading) {
    return (
      <KidLayout>
        <div className="text-6xl animate-spin">🌟</div>
      </KidLayout>
    )
  }

  return (
    <KidLayout>
      <div className="flex flex-col items-center gap-8 w-full max-w-sm">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-4xl font-extrabold text-blue-700 drop-shadow-sm">
            Who&apos;s playing? 🎈
          </h1>
          <p className="text-lg text-blue-400 font-semibold mt-2">Tap your buddy!</p>
        </motion.div>

        <div className="grid grid-cols-2 gap-4 w-full">
          {children.map((child, i) => (
            <motion.button
              key={child.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, type: 'spring', stiffness: 260, damping: 20 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => pickChild(child.id)}
              className={`${TILE_GRADIENTS[i % TILE_GRADIENTS.length]} rounded-3xl p-5 flex flex-col items-center gap-2 shadow-xl text-white`}
            >
              <span className="text-6xl leading-none">{child.avatar}</span>
              <span className="text-xl font-extrabold drop-shadow truncate max-w-full">
                {child.name}
              </span>
              <div className="flex items-center gap-3 text-sm font-bold text-white/90">
                <span>❤️ {child.totalHearts}</span>
                {child.streak > 1 && <span>🔥 {child.streak}</span>}
              </div>
            </motion.button>
          ))}

          {/* Add a child */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: children.length * 0.08, type: 'spring', stiffness: 260, damping: 20 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/welcome')}
            className="rounded-3xl p-5 flex flex-col items-center justify-center gap-2 shadow-md bg-white/70 border-4 border-dashed border-blue-200 text-blue-400"
          >
            <span className="text-4xl leading-none">➕</span>
            <span className="text-lg font-extrabold">Add</span>
          </motion.button>
        </div>
      </div>
    </KidLayout>
  )
}
