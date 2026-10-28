'use client'

import { apiFetch } from '@/lib/api-fetch'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import KidLayout from '@/components/layout/KidLayout'
import { Hills, Sparkles, Sun, Lantern } from '@/components/design/Scenery'
import Mascot from '@/components/design/Mascot'
import WeekDots from '@/components/progress/WeekDots'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { hasSession } from '@/lib/guest-session'
import type { User } from '@supabase/supabase-js'

const PROFILE_MAX_RETRIES = 8
const PROFILE_RETRY_DELAY_MS = 1000
const GUEST_NUDGE_KEY = 'kd_guest_nudge_dismissed'

interface NextPack {
  id: string
  name: string
  nameZh: string
  emoji: string
  learned: number
  wordCount: number
}

interface Profile {
  id: string
  name: string
  avatar: string
  totalHearts: number
  weekDays: boolean[]
  today: number
  nextPack: NextPack | null
  stickerCount: number
}

/** Small white subject button with its own-hue press edge (the Play next card leads) */
function SubjectButton({ seal, label, variant, href }: { seal: string; label: string; variant: 'chinese' | 'math'; href: string }) {
  const router = useRouter()
  return (
    <button
      onClick={() => router.push(href)}
      className={`pressable flex-1 min-h-[60px] rounded-[22px] bg-white text-ink text-lg font-extrabold flex items-center justify-center gap-2 ${
        variant === 'chinese' ? 'shadow-tile-chinese' : 'shadow-tile-math'
      }`}
    >
      <span className={`font-hanzi text-xl ${variant === 'chinese' ? 'text-chinese-edge' : 'text-math-edge'}`}>{seal}</span>
      {label}
    </button>
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
          const res = await apiFetch(`/api/profile?tz=${new Date().getTimezoneOffset()}`)
          if (cancelled) return

          if (res.status === 401) {
            // No session means no family yet (guest auth starts at /welcome)
            if (!(await hasSession())) {
              router.replace('/welcome')
              return
            }
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
  const showSwitcher = Boolean(profile && hasSiblings)

  return (
    <KidLayout align="top">
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

      <div className="relative z-10 flex flex-col items-center gap-4 w-full max-w-md">
        {/* Mascot with speech bubble */}
        <Mascot say="你好!" />

        {/* Greeting */}
        <div className="text-center -mt-6">
          {status === 'error' ? (
            <>
              <h1 className="text-[34px] font-extrabold text-ink leading-tight">
                We&apos;re napping, try again soon <span className="font-emoji">😴</span>
              </h1>
              <p className="text-lg text-ink-mid font-bold mt-2">Come back in a little bit!</p>
            </>
          ) : (
            <h1 className="text-[34px] font-extrabold text-ink leading-tight">
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
          )}
        </div>

        {profile && (
          <>
            {/* This week, hearts, stickers — no streak number, nothing resets */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="bg-white rounded-full px-3.5 py-2 flex items-center gap-2 shadow-press-chip text-base font-extrabold text-ink">
                This week <WeekDots days={profile.weekDays} today={profile.today} />
              </span>
              {totalHearts > 0 && (
                <span className="bg-white rounded-full px-3.5 py-2 flex items-center gap-1.5 shadow-press-chip text-base font-extrabold text-ink">
                  <span className="font-emoji" aria-hidden>❤️</span>
                  {totalHearts}
                  <span className="sr-only"> hearts</span>
                </span>
              )}
            </div>

            {/* Play next — one clear next step */}
            {profile.nextPack && (
              <section aria-label="Play next" className="w-full bg-white rounded-[26px] shadow-press-card p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-emoji text-[32px] leading-none bg-[#FFF3D6] rounded-2xl px-2.5 py-1.5 rotate-[-4deg]" aria-hidden>
                    {profile.nextPack.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-[19px] font-extrabold text-ink leading-tight">
                      {profile.nextPack.name}{' '}
                      <span className="font-hanzi text-lg text-chinese-edge font-normal">{profile.nextPack.nameZh}</span>
                    </h2>
                    <p className="text-base font-bold text-ink-mid">
                      {profile.nextPack.learned} of {profile.nextPack.wordCount} words learned
                    </p>
                    <div className="mt-1 h-2.5 rounded-full bg-chip-track overflow-hidden">
                      <div
                        className="h-full rounded-full bg-success"
                        style={{ width: `${Math.round((profile.nextPack.learned / Math.max(1, profile.nextPack.wordCount)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/practice/session?pack=${profile.nextPack!.id}`)}
                  className="pressable w-full min-h-[60px] rounded-[22px] bg-chinese text-white text-[21px] font-extrabold shadow-press-chinese"
                >
                  Play next <span className="font-emoji">▶️</span>
                </button>
                <p className="text-base font-bold text-ink-mid text-center">8 questions · about 3 minutes</p>
              </section>
            )}

            {/* Panda's sticker book (6-C) */}
            <button
              onClick={() => router.push('/stickers')}
              className="pressable w-full min-h-[56px] rounded-[22px] bg-white text-ink text-lg font-extrabold shadow-press-card flex items-center justify-center gap-2"
            >
              My sticker book <span className="font-emoji">📒</span>
              {profile.stickerCount > 0 && (
                <span className="bg-canvas-top rounded-full px-2.5 text-base text-ink-mid">{profile.stickerCount}</span>
              )}
            </button>

            <div className="flex gap-3 w-full">
              <SubjectButton seal="中文" label="All packs" variant="chinese" href="/packs" />
              <SubjectButton seal="数学" label="Math" variant="math" href="/math/topics" />
            </div>
          </>
        )}

        {/* Guest-save nudge — quiet, dismissable, parents' business */}
        {showGuestNudge && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-full pl-4 pr-1.5 py-1.5 flex items-center gap-2 shadow-press-chip max-w-full"
          >
            <button
              onClick={() => router.push('/parent')}
              className="text-ink-mid text-base font-bold text-left"
            >
              <span className="font-emoji">💾</span> Playing as guest — save your
              family&apos;s progress
            </button>
            <button
              onClick={dismissGuestNudge}
              aria-label="Dismiss"
              className="pressable bg-canvas-top text-ink-mid rounded-full w-8 h-8 flex items-center justify-center text-sm font-extrabold flex-shrink-0"
            >
              ✕
            </button>
          </motion.div>
        )}

        {/* Parent link */}
        <button
          onClick={() => router.push('/parent')}
          className="min-h-[44px] text-ink-mid text-base font-bold underline underline-offset-2"
        >
          Parent Zone
        </button>
      </div>
    </KidLayout>
  )
}
