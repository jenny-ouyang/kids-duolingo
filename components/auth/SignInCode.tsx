'use client'

import { useState } from 'react'
import { familyEntry, verifySignInCode } from '@/lib/guest-session'

/**
 * Shown after a sign-in email is sent: the parent types the code from the
 * email (works in the iPhone app), or opens the link (works in a browser).
 */
export default function SignInCode({ email }: { email: string }) {
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'checking' | 'error'>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (code.length < 6 || status === 'checking') return
    setStatus('checking')
    if (!(await verifySignInCode(email, code))) {
      setStatus('error')
      return
    }
    // Full load: "/" is server-rendered and must re-read the new child cookie
    window.location.replace((await familyEntry()) ?? '/')
  }

  return (
    <form onSubmit={submit} className="w-full flex flex-col gap-3">
      <p className="text-base font-bold text-ink-mid text-center">
        We sent an email to <strong className="text-ink">{email}</strong>. Type the code from the email, or open its link.
      </p>
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={8}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        placeholder="123456"
        aria-label="Code from the email"
        className="w-full bg-white rounded-3xl px-6 py-4 text-3xl font-extrabold tracking-[0.3em] text-ink text-center shadow-press-card placeholder:text-ink-mid/30 focus:outline-none focus:ring-4 focus:ring-gold"
      />
      <button
        type="submit"
        disabled={code.length < 6 || status === 'checking'}
        className="pressable w-full min-h-[60px] rounded-[26px] py-4 text-xl font-extrabold text-white bg-go shadow-press-go disabled:opacity-40"
      >
        {status === 'checking' ? 'Checking…' : 'Sign in'}
      </button>
      {status === 'error' && (
        <p className="text-[15px] text-chinese font-bold text-center">
          That code did not work. Codes work for 1 hour, one time. Check it, or send a new email.
        </p>
      )}
    </form>
  )
}
