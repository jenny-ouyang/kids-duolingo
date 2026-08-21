'use client'

import { apiFetch } from '@/lib/api-fetch'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import KidLayout from '@/components/layout/KidLayout'
import { Hills, Sparkles, Sun, Lantern } from '@/components/design/Scenery'
import Mascot from '@/components/design/Mascot'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import type { User } from '@supabase/supabase-js'

const PROFILE_MAX_RETRIES = 8
const PROFILE_RETRY_DELAY_MS = 1000
const GUEST_NUDGE_KEY = 'kd_guest_nudge_dismissed'

interface Profile {
  id: string
  name: string
  avatar: string
  totalHearts: number
  streak: number
}

interface SubjectCardProps {
  label: string
  description: string
  seal: string
  variant: 'chinese' | 'math'
  href: string
  delay: number
}

function SubjectCard({ label, description, seal, variant, href, delay }: SubjectCardProps) {
  const router = useRouter()
  const surface =
    variant === 'chinese'
      ? 'bg-gradient-to-br from-chinese-light to-chinese shadow-press-chinese'
      : 'bg-gradient-to-br from-math-light to-math shadow-press-math'
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="w-full"
    >
      <button
        onClick={() => router.push(href)}
        className={`${surface} pressable relative w-full min-h-[88px] rounded-[26px] py-5 pl-5 pr-24 text-left text-white`}
      >
        <span className="block text-[27px] font-extrabold leading-tight">{label}</span>
        <span className="block text-sm font-bold text-white/85">{description}</span>
        <span
          aria-hidden
          className="absolute right-4 top-1/2 -translate-y-1/2 rotate-[4deg] rounded-[14px] bg-white/20 px-3 py-2 font-hanzi text-[28px] leading-none"
        >
          {seal}
        </span>
      </button>
    </motion.div>
  )
}

export default function KidHome() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [hasSiblings, setHasSiblings] = useState(false)
  const [showGuestNudge, setShowGuestNudge] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      for (let attempt = 0; attempt < PROFILE_MAX_RETRIES; attempt++) {
        try {
          const res = await apiFetch('/api/profile')
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
          apiFetch('/api/children')
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

  // Guest-save nudge: once the profile is in, a lightweight browser-side check —
  // guest account + real progress at stake → gentle "save your progress" chip.
  useEffect(() => {
    if (status !== 'ready' || !profile || profile.totalHearts <= 0) return
    if (sessionStorage.getItem(GUEST_NUDGE_KEY) === 'true') return
    let cancelled = false
    createSupabaseBrowser()
      .auth.getUser()
      .then(({ data: { user } }: { data: { user: User | null } }) => {
        if (!cancelled && user?.is_anonymous) setShowGuestNudge(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [status, profile])

  function dismissGuestNudge() {
    sessionStorage.setItem(GUEST_NUDGE_KEY, 'true')
    setShowGuestNudge(false)
  }

  const totalHearts = profile?.totalHearts ?? 0
  const streak = profile?.streak ?? 0
  const showSwitcher = Boolean(profile && hasSiblings)

  return (
    <KidLayout>
      <Sun />
      <Lantern className={showSwitcher ? 'top-5 left-[76px]' : 'top-4 left-10'} />
      <Sparkles />
      <Hills />

      {/* Child switcher (only when the account has 2+ children) */}
      {showSwitcher && profile && (
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="absolute top-3 left-3 z-20"
        >
          <button
            onClick={() => router.push('/switch')}
            aria-label="Switch player"
            className="pressable bg-white rounded-2xl w-14 h-14 flex items-center justify-center shadow-press-chip"
          >
            <span className="font-emoji text-3xl">{profile.avatar}</span>
          </button>
        </motion.div>
      )}

      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-md">
        {/* Mascot with speech bubble */}
        <Mascot say="你好!" />

        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center -mt-6"
        >
          {status === 'error' ? (
            <>
              <h1 className="text-[36px] font-extrabold text-ink leading-tight">
                We&apos;re napping, try again soon <span className="font-emoji">😴</span>
              </h1>
              <p className="text-lg text-ink-soft font-bold mt-2">
                Come back in a little bit!
              </p>
            </>
          ) : (
            <>
              <h1 className="text-[36px] font-extrabold text-ink leading-tight">
                {profile ? (
                  <>
                    Hi, {profile.name}! <span className="font-emoji">{profile.avatar}</span>
                  </>
                ) : (
                  <>
                    Hi there! <span className="font-emoji">👋</span>
                  </>
                )}
              </h1>
              <p className="text-[15px] text-ink-soft font-bold mt-1.5">
                What do you want to learn today?
              </p>
            </>
          )}
        </motion.div>

        {/* Hearts + streak chips */}
        {totalHearts > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-2.5"
          >
            <div className="bg-white rounded-full px-4 py-2 flex items-center gap-1.5 shadow-press-chip">
              <span className="font-emoji text-xl">❤️</span>
              <span className="text-[15px] font-extrabold text-ink">
                {totalHearts} heart{totalHearts !== 1 ? 's' : ''}
              </span>
            </div>
            {streak > 1 && (
              <div className="bg-white rounded-full px-4 py-2 flex items-center gap-1.5 shadow-press-chip">
                <span className="font-emoji text-xl">🔥</span>
                <span className="text-[15px] font-extrabold text-ink">{streak} days</span>
              </div>
            )}
          </motion.div>
        )}

        {/* Subject cards */}
        <div className="flex flex-col gap-5 w-full">
          <SubjectCard
            label="Chinese"
            description="Learn Mandarin words"
            seal="中文"
            variant="chinese"
            href="/packs"
            delay={0.5}
          />
          <SubjectCard
            label="Math"
            description="Count and add numbers"
            seal="数学"
            variant="math"
            href="/math/topics"
            delay={0.65}
          />
        </div>

        {/* Guest-save nudge — quiet, dismissable, parents' business */}
        {showGuestNudge && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-full pl-4 pr-1.5 py-1.5 flex items-center gap-2 shadow-press-chip max-w-full"
          >
            <button
              onClick={() => router.push('/parent')}
              className="text-ink-soft text-sm font-bold text-left"
            >
              <span className="font-emoji">💾</span> Playing as guest — save your
              family&apos;s progress
            </button>
            <button
              onClick={dismissGuestNudge}
              aria-label="Dismiss"
              className="pressable bg-canvas-top text-ink-soft rounded-full w-8 h-8 flex items-center justify-center text-sm font-extrabold flex-shrink-0"
            >
              ✕
            </button>
          </motion.div>
        )}

        {/* Parent link */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          onClick={() => router.push('/parent')}
          className="text-ink-soft text-sm font-bold underline underline-offset-2"
        >
          Parent Dashboard
        </motion.button>
      </div>
    </KidLayout>
  )
}
