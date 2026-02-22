'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import KidLayout from '@/components/layout/KidLayout'

const CLOUD_POSITIONS = [
  { top: '8%', left: '5%', scale: 1.2, delay: 0 },
  { top: '12%', right: '8%', scale: 0.9, delay: 0.3 },
  { top: '22%', left: '60%', scale: 0.7, delay: 0.6 },
]

export default function HomePage() {
  const router = useRouter()
  const [totalHearts, setTotalHearts] = useState(0)
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data) => {
        setTotalHearts(data.totalHearts ?? 0)
        setStreak(data.streak ?? 0)
      })
      .catch(() => {})
  }, [])

  return (
    <KidLayout className="relative overflow-hidden">
      {/* Decorative clouds */}
      {CLOUD_POSITIONS.map((pos, i) => (
        <motion.div
          key={i}
          className="absolute text-white/80 text-5xl pointer-events-none select-none"
          style={{ top: pos.top, left: (pos as { left?: string }).left, right: (pos as { right?: string }).right, scale: pos.scale }}
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3 + i, repeat: Infinity, delay: pos.delay, ease: 'easeInOut' }}
        >
          ☁️
        </motion.div>
      ))}

      <div className="flex flex-col items-center gap-8 z-10">
        {/* Mascot */}
        <motion.div
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className="text-[120px] leading-none select-none"
        >
          🐼
        </motion.div>

        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center"
        >
          <h1 className="text-5xl font-extrabold text-blue-700 drop-shadow-sm">
            Hi, Julian! 👋
          </h1>
          <p className="text-2xl text-blue-400 font-semibold mt-2">
            Let&apos;s learn Chinese today!
          </p>
        </motion.div>

        {/* Hearts + streak stats */}
        {totalHearts > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-4"
          >
            <div className="bg-white/80 rounded-3xl px-5 py-3 flex items-center gap-2 shadow-md">
              <span className="text-3xl">❤️</span>
              <span className="text-xl font-bold text-red-500">
                {totalHearts} heart{totalHearts !== 1 ? 's' : ''}
              </span>
            </div>
            {streak > 1 && (
              <div className="bg-white/80 rounded-3xl px-5 py-3 flex items-center gap-2 shadow-md">
                <span className="text-3xl">🔥</span>
                <span className="text-xl font-bold text-orange-500">
                  {streak} days
                </span>
              </div>
            )}
          </motion.div>
        )}

        {/* Play button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => router.push('/packs')}
          className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white font-extrabold text-3xl rounded-[2rem] py-6 px-16 shadow-xl mt-2"
        >
          Play! 🎮
        </motion.button>

        {/* Parent link */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          onClick={() => router.push('/parent')}
          className="text-gray-400 text-sm underline underline-offset-2 mt-2"
        >
          Parent Dashboard
        </motion.button>
      </div>
    </KidLayout>
  )
}
