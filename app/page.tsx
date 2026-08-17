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

const PROFILE_MAX_RETRIES = 8
const PROFILE_RETRY_DELAY_MS = 1000

interface Profile {
  id: string
  name: string
  avatar: string
  totalHearts: number
  streak: number
}

interface SubjectCardProps {
  emoji: string
  label: string
  description: string
  gradient: string
  href: string
  delay: number
}

function SubjectCard({ emoji, label, description, gradient, href, delay }: SubjectCardProps) {
  const router = useRouter()
  return (
    <motion.button
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => router.push(href)}
      className={`${gradient} rounded-[2rem] p-6 flex flex-col items-center gap-2 shadow-xl text-white w-full`}
    >
      <span className="text-6xl leading-none">{emoji}</span>
      <span className="text-2xl font-extrabold drop-shadow">{label}</span>
      <span className="text-sm font-semibold text-white/80">{description}</span>
    </motion.button>
  )
}

export default function HomePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [hasSiblings, setHasSiblings] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      for (let attempt = 0; attempt < PROFILE_MAX_RETRIES; attempt++) {
        try {
          const res = await fetch('/api/profile')
          if (cancelled) return

          if (res.status === 401) {
            // AuthBootstrap may still be signing in anonymously — wait and retry
            await new Promise((resolve) => setTimeout(resolve, PROFILE_RETRY_DELAY_MS))
            continue
          }
          if (res.status === 403) {
            // Authed but no child yet — first visit, go set one up
            router.replace('/welcome')
            return
          }
          if (!res.ok) {
            setStatus('error')
            return
          }

          const data = (await res.json()) as Profile
          if (cancelled) return
          setProfile(data)
          setStatus('ready')

          // Show the switcher entry when the account has more than one child
          fetch('/api/children')
            .then((r) => (r.ok ? r.json() : []))
            .then((children: unknown) => {
              if (!cancelled && Array.isArray(children)) setHasSiblings(children.length > 1)
            })
            .catch(() => {})
          return
        } catch {
          if (cancelled) return
          await new Promise((resolve) => setTimeout(resolve, PROFILE_RETRY_DELAY_MS))
        }
      }
      if (!cancelled) setStatus('error')
    }

    loadProfile()
    return () => {
      cancelled = true
    }
  }, [router])

  const totalHearts = profile?.totalHearts ?? 0
  const streak = profile?.streak ?? 0

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

      {/* Child switcher (only when the account has 2+ children) */}
      {profile && hasSiblings && (
        <motion.button
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => router.push('/switch')}
          aria-label="Switch player"
          className="absolute top-4 right-4 z-20 bg-white/80 rounded-3xl w-16 h-16 flex items-center justify-center text-4xl shadow-md"
        >
          {profile.avatar}
        </motion.button>
      )}

      <div className="flex flex-col items-center gap-8 z-10 w-full max-w-sm">
        {/* Mascot */}
        <motion.div
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className="text-[100px] leading-none select-none"
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
          {status === 'error' ? (
            <>
              <h1 className="text-4xl font-extrabold text-blue-700 drop-shadow-sm">
                We&apos;re napping, try again soon 😴
              </h1>
              <p className="text-xl text-blue-400 font-semibold mt-2">
                Come back in a little bit!
              </p>
            </>
          ) : (
            <>
              <h1 className="text-5xl font-extrabold text-blue-700 drop-shadow-sm">
                {profile ? (
                  <>
                    Hi, {profile.name}! {profile.avatar}
                  </>
                ) : (
                  <>Hi there! 👋</>
                )}
              </h1>
              <p className="text-xl text-blue-400 font-semibold mt-2">
                What do you want to learn today?
              </p>
            </>
          )}
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

        {/* Subject cards */}
        <div className="flex flex-col gap-4 w-full">
          <SubjectCard
            emoji="🈶"
            label="Chinese"
            description="Learn Mandarin words"
            gradient="bg-gradient-to-br from-orange-400 to-red-500"
            href="/packs"
            delay={0.5}
          />
          <SubjectCard
            emoji="➕"
            label="Math"
            description="Count and add numbers"
            gradient="bg-gradient-to-br from-blue-500 to-purple-600"
            href="/math/topics"
            delay={0.65}
          />
        </div>

        {/* Parent link */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          onClick={() => router.push('/parent')}
          className="text-gray-400 text-sm underline underline-offset-2"
        >
          Parent Dashboard
        </motion.button>
      </div>
    </KidLayout>
  )
}
