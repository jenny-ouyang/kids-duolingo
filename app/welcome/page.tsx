'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import KidLayout from '@/components/layout/KidLayout'
import { Hills, Sparkles } from '@/components/design/Scenery'
import Mascot from '@/components/design/Mascot'
import { setActiveChild } from '@/lib/child-cookie'

const AVATARS = ['🦁', '🐼', '🐰', '🦊', '🐸', '🐯', '🐨', '🦄', '🐶', '🐱', '🐧', '🐢']

// Decorative rhythm only — selection is shown by success tokens + ✓ badge
const TILE_EDGES = ['shadow-tile-chinese', 'shadow-tile-math', 'shadow-tile-gold', 'shadow-tile-plum']

const MAX_RETRIES = 6
const RETRY_DELAY_MS = 1200

export default function WelcomePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState('🦁')
  const [saving, setSaving] = useState(false)
  const [waitingForAuth, setWaitingForAuth] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = name.trim().length > 0 && !saving

  async function createChild() {
    if (!canSubmit) return
    setSaving(true)
    setError(null)

    try {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const res = await fetch('/api/children', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), avatar }),
        })

        if (res.status === 401) {
          // AuthBootstrap may still be signing in anonymously — wait and retry
          setWaitingForAuth(true)
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
          continue
        }

        setWaitingForAuth(false)
        if (res.ok) {
          const child = (await res.json()) as { id: string }
          // Await so the server-set httpOnly cookie is in place before navigating
          await setActiveChild(child.id)
          router.push('/')
          return
        }

        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(
          body.error === 'child limit reached'
            ? 'Wow, that is a full house! Ask a grown-up to make room first. 🏠'
            : 'Hmm, that did not work. Try again! 💪'
        )
        setSaving(false)
        return
      }

      // Still 401 after all retries
      setWaitingForAuth(false)
      setError('We could not wake up the app. Try again in a moment! 😴')
      setSaving(false)
    } catch {
      setWaitingForAuth(false)
      setError('Hmm, that did not work. Try again! 💪')
      setSaving(false)
    }
  }

  return (
    <KidLayout>
      <Sparkles />
      <Hills />

      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-md">
        {/* Panda guide */}
        <Mascot say="你好!" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center -mt-6"
        >
          <h1 className="text-[27px] font-extrabold text-ink">
            Who&apos;s learning? <span className="font-emoji">🌟</span>
          </h1>
          <p className="text-[15px] text-ink-soft font-bold mt-1">
            Pick a buddy and tell us your name!
          </p>
        </motion.div>

        {/* Name input */}
        <motion.input
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') createChild()
          }}
          maxLength={20}
          placeholder="My name is..."
          autoFocus
          className="w-full bg-white rounded-3xl px-6 py-4 text-2xl font-extrabold text-ink text-center shadow-press-card placeholder:text-ink-soft/60 focus:outline-none focus:ring-4 focus:ring-gold"
        />

        {/* Avatar picker */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="grid grid-cols-4 gap-3.5 w-full"
        >
          {AVATARS.map((emoji, i) => {
            const selected = avatar === emoji
            return (
              <motion.div
                key={emoji}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25 + i * 0.04, type: 'spring', stiffness: 300, damping: 20 }}
              >
                <button
                  onClick={() => setAvatar(emoji)}
                  aria-label={`Pick ${emoji}`}
                  aria-pressed={selected}
                  className={`pressable relative w-full min-h-[60px] rounded-3xl py-3 ${
                    selected
                      ? 'bg-success-bg shadow-press-success'
                      : `bg-white ${TILE_EDGES[i % TILE_EDGES.length]}`
                  }`}
                >
                  <span className="font-emoji text-4xl leading-none">{emoji}</span>
                  {selected && (
                    <span
                      aria-hidden
                      className="absolute -top-2 -right-1.5 w-6 h-6 bg-success text-white rounded-full flex items-center justify-center text-sm font-extrabold shadow-[0_2px_0_#147663]"
                    >
                      ✓
                    </span>
                  )}
                </button>
              </motion.div>
            )
          })}
        </motion.div>

        {/* Gentle status / error */}
        {waitingForAuth && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[15px] text-ink-soft font-bold"
          >
            One moment… ✨
          </motion.p>
        )}
        {error && !waitingForAuth && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[15px] text-chinese font-bold text-center"
          >
            {error}
          </motion.p>
        )}

        {/* Let's go! */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="w-full"
        >
          <button
            onClick={createChild}
            disabled={!canSubmit}
            className="pressable w-full min-h-[64px] rounded-[26px] py-5 text-2xl font-extrabold text-white bg-success shadow-press-success disabled:opacity-40"
          >
            {saving ? (
              <>
                Getting ready… <span className="font-emoji">🎈</span>
              </>
            ) : (
              <>
                Let&apos;s go! <span className="font-emoji">🚀</span>
              </>
            )}
          </button>
        </motion.div>
      </div>
    </KidLayout>
  )
}
