'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import KidLayout from '@/components/layout/KidLayout'
import { setActiveChild } from '@/lib/child-cookie'

const AVATARS = ['🦁', '🐼', '🐰', '🦊', '🐸', '🐯', '🐨', '🦄', '🐶', '🐱', '🐧', '🐢']

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
      <div className="flex flex-col items-center gap-8 w-full max-w-sm">
        {/* Bouncing avatar preview */}
        <motion.div
          key={avatar}
          initial={{ scale: 0.5 }}
          animate={{ scale: 1, y: [0, -12, 0] }}
          transition={{
            scale: { type: 'spring', stiffness: 300, damping: 15 },
            y: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' },
          }}
          className="text-[100px] leading-none select-none"
        >
          {avatar}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-4xl font-extrabold text-blue-700 drop-shadow-sm">
            Who&apos;s learning? 🌟
          </h1>
          <p className="text-lg text-blue-400 font-semibold mt-2">
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
          className="w-full bg-white rounded-3xl px-6 py-4 text-2xl font-bold text-blue-700 text-center shadow-md placeholder:text-blue-200 focus:outline-none focus:ring-4 focus:ring-blue-300"
        />

        {/* Avatar picker */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="grid grid-cols-4 gap-3 w-full"
        >
          {AVATARS.map((emoji, i) => (
            <motion.button
              key={emoji}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 + i * 0.04, type: 'spring', stiffness: 300, damping: 20 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setAvatar(emoji)}
              aria-label={`Pick ${emoji}`}
              className={`rounded-3xl text-4xl py-3 shadow-md transition-colors ${
                avatar === emoji
                  ? 'bg-yellow-300 ring-4 ring-yellow-400'
                  : 'bg-white/80 hover:bg-white'
              }`}
            >
              {emoji}
            </motion.button>
          ))}
        </motion.div>

        {/* Gentle status / error */}
        {waitingForAuth && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-lg text-blue-400 font-semibold"
          >
            One moment… ✨
          </motion.p>
        )}
        {error && !waitingForAuth && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-lg text-orange-500 font-semibold text-center"
          >
            {error}
          </motion.p>
        )}

        {/* Let's go! */}
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          whileHover={{ scale: canSubmit ? 1.05 : 1 }}
          whileTap={{ scale: canSubmit ? 0.95 : 1 }}
          onClick={createChild}
          disabled={!canSubmit}
          className={`w-full rounded-[2rem] py-5 text-3xl font-extrabold text-white shadow-xl transition-opacity ${
            canSubmit
              ? 'bg-gradient-to-br from-green-400 to-emerald-500'
              : 'bg-gradient-to-br from-green-400 to-emerald-500 opacity-40'
          }`}
        >
          {saving ? 'Getting ready… 🎈' : "Let's go! 🚀"}
        </motion.button>
      </div>
    </KidLayout>
  )
}
