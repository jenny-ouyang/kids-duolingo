'use client'

import { apiFetch } from '@/lib/api-fetch'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import KidLayout from '@/components/layout/KidLayout'
import { Hills, Sparkles, Sun, Lantern } from '@/components/design/Scenery'
import Mascot from '@/components/design/Mascot'
import { hasSession } from '@/lib/guest-session'
import { clearActiveChild } from '@/lib/child-cookie'

const PROFILE_MAX_RETRIES = 8
const PROFILE_RETRY_DELAY_MS = 1000

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

/** Square picture button: a big glyph a pre-reader knows, and a one-word label */
function PictureButton({ glyph, label, href, tone }: { glyph: string; label: string; href: string; tone: 'chinese' | 'math' | 'card' }) {
  const router = useRouter()
  const edge = tone === 'chinese' ? 'shadow-tile-chinese' : tone === 'math' ? 'shadow-tile-math' : 'shadow-press-card'
  const ink = tone === 'chinese' ? 'text-chinese-edge font-hanzi' : tone === 'math' ? 'text-math-edge font-hanzi' : 'font-emoji'
  return (
    <button
      onClick={() => router.push(href)}
      className={`pressable flex-1 aspect-square max-h-[112px] rounded-[22px] bg-white ${edge} flex flex-col items-center justify-center gap-1`}
    >
      <span aria-hidden className={`text-[30px] leading-none ${ink}`}>{glyph}</span>
      <span className="text-base font-extrabold text-ink">{label}</span>
    </button>
  )
}

export default function KidHome() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [hasSiblings, setHasSiblings] = useState(false)

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
              // Drop a stale child cookie, or "/" keeps sending this browser here
              await clearActiveChild()
              router.replace('/welcome')
              return
            }
            await new Promise((resolve) => setTimeout(resolve, PROFILE_RETRY_DELAY_MS))
            continue
          }
          if (res.status === 403) {
            // Authed but no child yet — first visit, go set one up
            await clearActiveChild()
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

      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-md">
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
            {/* One main thing to tap: play the suggested pack */}
            {profile.nextPack && (
              <button
                onClick={() => router.push(`/practice/session?pack=${profile.nextPack!.id}`)}
                aria-label={`Play next: ${profile.nextPack.name}`}
                className="pressable w-full min-h-[132px] rounded-[28px] bg-chinese shadow-press-chinese text-white px-5 py-4 flex items-center gap-4 text-left"
              >
                <span aria-hidden className="font-emoji text-[44px] leading-none bg-white rounded-[20px] w-[76px] h-[76px] flex items-center justify-center rotate-[-4deg] flex-shrink-0">
                  {profile.nextPack.emoji}
                </span>
                <span className="flex flex-col min-w-0">
                  <span className="text-xl font-extrabold leading-tight truncate">
                    {profile.nextPack.name} <span className="font-hanzi font-normal">{profile.nextPack.nameZh}</span>
                  </span>
                  <span className="text-[28px] font-extrabold leading-tight">▶ Play next</span>
                </span>
              </button>
            )}

            <div className="flex gap-3 w-full">
              <PictureButton glyph="中文" label="Packs" href="/packs" tone="chinese" />
              <PictureButton glyph="数学" label="Math" href="/math/topics" tone="math" />
              <PictureButton glyph="📒" label="Stickers" href="/stickers" tone="card" />
            </div>
          </>
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
