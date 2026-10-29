'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import KidLayout from '@/components/layout/KidLayout'
import { Hills, Sparkles } from '@/components/design/Scenery'
import Mascot from '@/components/design/Mascot'
import { sendSignInLink } from '@/lib/guest-session'
import SignInCode from '@/components/auth/SignInCode'

/**
 * Sign in for returning families, one tap from the landing page (no grown-up
 * gate: the email is the gate). The parent types the email's code here, or
 * opens its link, which SignInLinkCatcher finishes on any page.
 */
export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  // Set by familyEntry() when an email link was too old or used already
  const [oldLink, setOldLink] = useState(false)
  useEffect(() => setOldLink(window.location.search.includes('link=old')), [])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const address = email.trim()
    if (!address || status === 'sending') return
    setStatus('sending')
    setStatus((await sendSignInLink(address)) ? 'sent' : 'error')
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
            Type the email you saved your family with. We send you a sign-in code.
          </p>
        </div>

        {oldLink && status !== 'sent' && (
          <div className="w-full bg-white rounded-3xl px-5 py-4 text-ink text-base font-bold text-center shadow-press-card">
            That sign-in link is too old, or it was used already. Links work for 1 hour, one time. Send a new email.
          </div>
        )}

        {status === 'sent' ? (
          <SignInCode email={email.trim()} />
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
              {status === 'sending' ? 'Sending…' : 'Send my sign-in code'}
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
