'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import KidLayout from '@/components/layout/KidLayout'
import { Hills, Sparkles } from '@/components/design/Scenery'
import { setActiveChild } from '@/lib/child-cookie'
import { fetchJsonWithAuthRetry } from '@/lib/api-fetch'

interface ChildSummary {
  id: string
  name: string
  avatar: string
  totalHearts: number
  streak: number
}

// Decorative rhythm only (docs/design/DESIGN.md) — edge color carries no meaning
const TILE_EDGES = ['shadow-tile-chinese', 'shadow-tile-math', 'shadow-tile-gold', 'shadow-tile-plum']

export default function SwitchPage() {
  const router = useRouter()
  const [children, setChildren] = useState<ChildSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchJsonWithAuthRetry<ChildSummary[]>('/api/children').then(({ status, data }) => {
      if (cancelled) return
      if (status === 403) {
        // Authed but no child yet — first visit, go set one up
        router.replace('/welcome')
        return
      }
      if (Array.isArray(data)) setChildren(data)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [router])

  async function pickChild(id: string) {
    // Await so the server-set httpOnly cookie is in place before navigating
    await setActiveChild(id)
    router.push('/')
  }

  if (loading) {
    return (
      <KidLayout>
        <Hills />
        <div className="relative z-10 font-emoji text-6xl animate-spin">🌟</div>
      </KidLayout>
    )
  }

  return (
    <KidLayout>
      <Sparkles />
      <Hills />

      <div className="relative z-10 flex flex-col items-center gap-7 w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-[27px] font-extrabold text-ink">
            Who&apos;s playing? <span className="font-emoji">🎈</span>
          </h1>
          <p className="text-[15px] text-ink-soft font-bold mt-1">Tap your buddy!</p>
        </motion.div>

        <div className="grid grid-cols-2 gap-5 w-full">
          {children.map((child, i) => (
            <motion.div
              key={child.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, type: 'spring', stiffness: 260, damping: 20 }}
            >
              <button
                onClick={() => pickChild(child.id)}
                className={`pressable w-full min-h-[128px] bg-white rounded-3xl p-5 flex flex-col items-center gap-1.5 ${
                  TILE_EDGES[i % TILE_EDGES.length]
                } ${i % 2 === 0 ? 'rotate-[-2deg]' : 'rotate-[2deg]'}`}
              >
                <span className="font-emoji text-[44px] leading-none">{child.avatar}</span>
                <span className="text-lg font-extrabold text-ink truncate max-w-full">
                  {child.name}
                </span>
                <div className="flex items-center gap-3 text-sm font-extrabold text-ink-soft">
                  <span>
                    <span className="font-emoji">❤️</span> {child.totalHearts}
                  </span>
                  {child.streak > 1 && (
                    <span>
                      <span className="font-emoji">🔥</span> {child.streak}
                    </span>
                  )}
                </div>
              </button>
            </motion.div>
          ))}

          {/* Add a child */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: children.length * 0.08, type: 'spring', stiffness: 260, damping: 20 }}
          >
            <button
              onClick={() => router.push('/welcome')}
              className="pressable w-full min-h-[128px] h-full rounded-3xl p-5 flex flex-col items-center justify-center gap-1.5 bg-white/60 border-[3px] border-dashed border-gold-edge text-ink-soft"
            >
              <span className="text-3xl leading-none font-extrabold">+</span>
              <span className="text-lg font-extrabold">Add</span>
            </button>
          </motion.div>
        </div>
      </div>
    </KidLayout>
  )
}
