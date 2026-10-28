'use client'

import { useState } from 'react'
import Link from 'next/link'
import KidLayout from '@/components/layout/KidLayout'
import { Hills, Sparkles } from '@/components/design/Scenery'
import Mascot from '@/components/design/Mascot'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

/**
 * Sign in for returning families, one tap from the landing page (no grown-up
 * gate: an email link is the gate). The link opens "/", where ResumeFamily
 * finishes the sign-in and takes the family to its child.
 */
export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const address = email.trim()
    if (!address || status === 'sending') return
    setStatus('sending')
    // shouldCreateUser: false so a typo can't spawn an empty account
    const { error } = await createSupabaseBrowser().auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
    })
    setStatus(error ? 'error' : 'sent')
  }

  return (
    <KidLayout>
      <Sparkles />
      <Hills />

      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/"
        className="pressable fixed left-4 z-20 min-h-[44px] flex items-center rounded-[14px] bg-white px-4 text-base font-extrabold text-ink shadow-press-chip"
        style={{ top: 'max(16px, env(safe-area-inset-top))' }}
      >
        ← Back
      </a>

      <div className="relative z-10 flex flex-col items-center gap-5 w-full max-w-md">
        <Mascot say="欢迎回来!" />
        <div className="text-center -mt-4">
          <h1 className="text-[27px] font-extrabold text-ink">Welcome back</h1>
          <p className="text-[15px] text-ink-mid font-bold mt-1">
            Type the email you saved your family with. We send you a sign-in link.
          </p>
        </div>

        {status === 'sent' ? (
          <div className="w-full bg-success-bg rounded-3xl px-5 py-4 text-success-edge text-base font-bold text-center">
            ✓ Check your inbox. Open the link on this device, and your family is back.
          </div>
        ) : (
          <form onSubmit={send} className="w-full flex flex-col gap-4">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-label="Email"
              className="w-full bg-white rounded-3xl px-6 py-4 text-xl font-extrabold text-ink text-center shadow-press-card placeholder:text-ink-mid/60 focus:outline-none focus:ring-4 focus:ring-gold"
            />
            <button
              type="submit"
              disabled={!email.trim() || status === 'sending'}
              className="pressable w-full min-h-[60px] rounded-[26px] py-4 text-xl font-extrabold text-white bg-go shadow-press-go disabled:opacity-40"
            >
              {status === 'sending' ? 'Sending…' : 'Send my sign-in link'}
            </button>
            {status === 'error' && (
              <p className="text-[15px] text-chinese font-bold text-center">
                We could not find that email, or the email did not send. Check it and try again.
              </p>
            )}
          </form>
        )}

        <Link href="/welcome" className="min-h-[44px] flex items-center text-base font-bold text-ink-mid underline underline-offset-2">
          New here? Play free
        </Link>
      </div>
    </KidLayout>
  )
}
