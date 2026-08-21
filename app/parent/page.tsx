'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { apiFetch, fetchJsonWithAuthRetry } from '@/lib/api-fetch'
import { clearActiveChild } from '@/lib/child-cookie'
import type { User } from '@supabase/supabase-js'

const GATE_KEY = 'kd_parent_gate'
const MAX_CHILDREN = 6

/** Not a security boundary — just a kid filter (standard kids-app pattern). */
const GATE_QUESTIONS = [
  { prompt: 'What is 6 × 7?', answer: 42 },
  { prompt: 'What is 7 × 8?', answer: 56 },
  { prompt: 'What is 8 × 9?', answer: 72 },
  { prompt: 'What is 9 × 6?', answer: 54 },
  { prompt: 'What is 7 × 7?', answer: 49 },
  { prompt: 'What is 8 × 6?', answer: 48 },
]

const AVATARS = ['🦁', '🐼', '🦊', '🐸', '🦄', '🐯', '🐨', '🐰', '🐙', '🦖']

interface ChildRow {
  id: string
  name: string
  avatar: string
  totalHearts: number
  streak: number
  lastPracticed: string | null
}

interface AccountInfo {
  email: string | null
  isAnonymous: boolean
}

function pickQuestion(exclude?: number) {
  let idx = Math.floor(Math.random() * GATE_QUESTIONS.length)
  if (idx === exclude) idx = (idx + 1) % GATE_QUESTIONS.length
  return idx
}

function formatLastPracticed(iso: string | null): string {
  if (!iso) return 'Never practiced'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'Practiced today'
  if (days === 1) return 'Practiced yesterday'
  return `Practiced ${days} days ago`
}

/* Calm variant of Sunrise Playground: same palette, warm ink, press physics —
   no mascot, no hills, no sparkles (per DESIGN.md, parent zone rule). */

const inputClass =
  'bg-canvas-top rounded-2xl px-4 min-h-[56px] text-ink font-semibold placeholder:text-ink-soft/60 focus:outline-none focus:ring-4 focus:ring-gold'

function AdultGate({ onPass }: { onPass: () => void }) {
  const router = useRouter()
  const [questionIdx, setQuestionIdx] = useState(() => pickQuestion())
  const [answer, setAnswer] = useState('')
  const [wrong, setWrong] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (parseInt(answer.trim(), 10) === GATE_QUESTIONS[questionIdx].answer) {
      onPass()
    } else {
      setWrong(true)
      setAnswer('')
      setQuestionIdx((prev) => pickQuestion(prev))
    }
  }

  return (
    <div className="min-h-screen bg-canvas-top flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[26px] p-8 shadow-press-card w-full max-w-sm text-center"
      >
        <div className="font-emoji text-4xl mb-3">🔒</div>
        <h1 className="text-xl font-extrabold text-ink">Grown-ups only</h1>
        <p className="text-ink-soft text-sm font-bold mt-1">
          Answer this to open the parent zone.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          <p className="text-lg font-extrabold text-ink">
            {GATE_QUESTIONS[questionIdx].prompt}
          </p>
          <input
            type="number"
            inputMode="numeric"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            autoFocus
            className={`${inputClass} text-center text-lg`}
          />
          {wrong && (
            <p className="text-ink-soft text-sm font-bold">
              Not quite — try this one instead.
            </p>
          )}
          <button
            type="submit"
            className="pressable min-h-[56px] bg-success text-white rounded-2xl px-4 font-extrabold shadow-press-success"
          >
            Unlock
          </button>
        </form>
        <button
          onClick={() => router.push('/')}
          className="mt-5 min-h-[44px] text-ink-soft text-sm font-bold underline underline-offset-2"
        >
          ← Back to the app
        </button>
      </motion.div>
    </div>
  )
}

function AvatarPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (avatar: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {AVATARS.map((avatar) => (
        <button
          key={avatar}
          type="button"
          onClick={() => onChange(avatar)}
          aria-label={`Pick ${avatar}`}
          aria-pressed={value === avatar}
          className={`pressable w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${
            value === avatar
              ? 'bg-success-bg shadow-press-success'
              : 'bg-canvas-top shadow-press-chip'
          }`}
        >
          <span className="font-emoji leading-none">{avatar}</span>
        </button>
      ))}
    </div>
  )
}

function ChildrenSection() {
  const [children, setChildren] = useState<ChildRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  // Add form
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAvatar, setNewAvatar] = useState(AVATARS[0])
  const [saving, setSaving] = useState(false)

  // Edit form (rename / re-avatar)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editAvatar, setEditAvatar] = useState(AVATARS[0])

  // Delete confirm (type the child's name)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteText, setDeleteText] = useState('')

  const fetchChildren = useCallback(async () => {
    const { ok, data } = await fetchJsonWithAuthRetry<ChildRow[]>('/api/children')
    if (ok && Array.isArray(data)) {
      setChildren(data)
      setLoadFailed(false)
    } else {
      // Fall back to an empty list so the add-child UI still renders
      setChildren((prev) => prev ?? [])
      setLoadFailed(true)
    }
  }, [])

  useEffect(() => {
    fetchChildren()
  }, [fetchChildren])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || saving) return
    setSaving(true)
    try {
      const res = await apiFetch('/api/children', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), avatar: newAvatar }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(
          body.error === 'child limit reached'
            ? `You can have up to ${MAX_CHILDREN} children on one account.`
            : "Couldn't add that child. Please try again."
        )
        return
      }
      setNewName('')
      setNewAvatar(AVATARS[0])
      setShowAdd(false)
      setError(null)
      await fetchChildren()
    } finally {
      setSaving(false)
    }
  }

  function startEdit(child: ChildRow) {
    setEditingId(child.id)
    setEditName(child.name)
    setEditAvatar(child.avatar)
    setDeletingId(null)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId || !editName.trim() || saving) return
    setSaving(true)
    try {
      const res = await apiFetch('/api/children', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, name: editName.trim(), avatar: editAvatar }),
      })
      if (!res.ok) {
        setError("Couldn't save those changes. Please try again.")
        return
      }
      setEditingId(null)
      setError(null)
      await fetchChildren()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(child: ChildRow) {
    if (deleteText !== child.name || saving) return
    setSaving(true)
    try {
      const res = await apiFetch(`/api/children?id=${encodeURIComponent(child.id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        setError("Couldn't remove that child. Please try again.")
        return
      }
      setDeletingId(null)
      setDeleteText('')
      setError(null)
      await fetchChildren()
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-ink">Children</h2>
        {children !== null && children.length < MAX_CHILDREN && !showAdd && (
          <button
            onClick={() => {
              setShowAdd(true)
              setEditingId(null)
              setDeletingId(null)
            }}
            className="pressable min-h-[56px] bg-success text-white rounded-2xl px-5 text-[15px] font-extrabold shadow-press-success"
          >
            + Add a child
          </button>
        )}
      </div>

      {loadFailed && (
        <div className="bg-chip-track rounded-2xl px-4 py-3 text-ink text-sm font-bold flex items-center justify-between gap-3">
          <span>Couldn&apos;t load your children.</span>
          <button
            onClick={fetchChildren}
            className="min-h-[44px] font-extrabold underline underline-offset-2 flex-shrink-0"
          >
            Try again
          </button>
        </div>
      )}

      {error && (
        <div className="bg-chip-track rounded-2xl px-4 py-3 text-ink text-sm font-bold">
          {error}
        </div>
      )}

      {children !== null && children.length >= MAX_CHILDREN && (
        <p className="text-ink-soft text-sm font-bold">
          You&apos;ve reached the maximum of {MAX_CHILDREN} children on one account.
        </p>
      )}

      <AnimatePresence>
        {showAdd && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAdd}
            className="bg-white rounded-[22px] p-5 shadow-press-card flex flex-col gap-4 overflow-hidden"
          >
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Child's nickname"
              maxLength={20}
              autoFocus
              className={inputClass}
            />
            <AvatarPicker value={newAvatar} onChange={setNewAvatar} />
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={!newName.trim() || saving}
                className="pressable min-h-[56px] bg-success text-white rounded-2xl px-6 text-[15px] font-extrabold shadow-press-success disabled:opacity-50"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="pressable min-h-[56px] bg-canvas-top text-ink-soft rounded-2xl px-6 text-[15px] font-extrabold shadow-press-chip"
              >
                Cancel
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {children === null && (
        <div className="text-ink-soft text-sm font-bold">Loading…</div>
      )}

      {children !== null && children.length === 0 && !loadFailed && (
        <p className="text-ink-soft text-sm font-bold">
          No children yet. Add one to get started.
        </p>
      )}

      {children?.map((child) => (
        <motion.div
          key={child.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[22px] p-4 shadow-press-card flex flex-col gap-3"
        >
          {editingId === child.id ? (
            <form onSubmit={handleEdit} className="flex flex-col gap-4">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={20}
                autoFocus
                className={inputClass}
              />
              <AvatarPicker value={editAvatar} onChange={setEditAvatar} />
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={!editName.trim() || saving}
                  className="pressable min-h-[56px] bg-success text-white rounded-2xl px-6 text-[15px] font-extrabold shadow-press-success disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="pressable min-h-[56px] bg-canvas-top text-ink-soft rounded-2xl px-6 text-[15px] font-extrabold shadow-press-chip"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#FFF3D6] rotate-[-4deg] flex items-center justify-center flex-shrink-0">
                <span className="font-emoji text-2xl leading-none">{child.avatar}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-ink">{child.name}</p>
                <p className="text-sm font-bold text-ink-soft mt-0.5">
                  <span className="font-emoji">❤️</span> {child.totalHearts} hearts ·{' '}
                  <span className="font-emoji">🔥</span> {child.streak} day streak ·{' '}
                  {formatLastPracticed(child.lastPracticed)}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Link
                  href={`/parent/report?child=${child.id}`}
                  className="pressable min-h-[56px] bg-white text-ink rounded-2xl px-4 text-sm font-extrabold shadow-press-chip flex items-center"
                >
                  Report
                </Link>
                <button
                  onClick={() => startEdit(child)}
                  className="pressable min-h-[56px] bg-canvas-top text-ink rounded-2xl px-4 text-sm font-extrabold shadow-press-chip"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    setDeletingId(deletingId === child.id ? null : child.id)
                    setDeleteText('')
                    setEditingId(null)
                  }}
                  className="pressable min-h-[56px] bg-canvas-top text-ink-soft rounded-2xl px-4 text-sm font-extrabold shadow-press-chip"
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          {deletingId === child.id && editingId !== child.id && (
            <div className="border-t border-chip-track pt-3 flex flex-col gap-2">
              <p className="text-sm font-bold text-ink">
                This permanently deletes <strong>{child.name}</strong> and all their
                progress. Type <strong>{child.name}</strong> to confirm.
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  placeholder={child.name}
                  className={`${inputClass} flex-1 min-w-0`}
                />
                {/* chinese-edge red is reserved for exactly this confirm action */}
                <button
                  onClick={() => handleDelete(child)}
                  disabled={deleteText !== child.name || saving}
                  className="pressable min-h-[56px] bg-chinese-edge text-white rounded-2xl px-6 text-sm font-extrabold shadow-[0_6px_0_#8E2038] disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </motion.div>
      ))}
    </section>
  )
}

function AccountSection() {
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const [claimEmail, setClaimEmail] = useState('')
  const [claimStatus, setClaimStatus] = useState<'idle' | 'sending' | 'sent' | 'error' | 'exists'>('idle')

  const [signinEmail, setSigninEmail] = useState('')
  const [signinStatus, setSigninStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  useEffect(() => {
    const supabase = createSupabaseBrowser()
    supabase.auth
      .getUser()
      .then(({ data: { user } }: { data: { user: User | null } }) => {
        if (user) {
          setAccount({
            email: user.email ?? null,
            isAnonymous: user.is_anonymous ?? !user.email,
          })
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault()
    const email = claimEmail.trim()
    if (!email || claimStatus === 'sending') return
    setClaimStatus('sending')
    const supabase = createSupabaseBrowser()
    const { error } = await supabase.auth.updateUser({ email })
    if (error && /already|registered|exists|in use/i.test(error.message)) {
      setClaimStatus('exists')
    } else {
      setClaimStatus(error ? 'error' : 'sent')
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    const email = signinEmail.trim()
    if (!email || signinStatus === 'sending') return
    setSigninStatus('sending')
    const supabase = createSupabaseBrowser()
    // Magic link into an EXISTING account (new device / cleared cookies).
    // shouldCreateUser: false so a typo can't spawn an empty account.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
    })
    setSigninStatus(error ? 'error' : 'sent')
  }

  async function handleSignOut() {
    const supabase = createSupabaseBrowser()
    // Clear the active-child selection (cookie on web, localStorage on native)
    // so / shows the landing/picker again.
    await clearActiveChild()
    await supabase.auth.signOut()
    // Full navigation so a fresh anonymous session bootstraps on the home page.
    window.location.assign('/')
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-extrabold text-ink">Account</h2>

      {loading && <div className="text-ink-soft text-sm font-bold">Loading…</div>}

      {!loading && !account && (
        <div className="bg-white rounded-[22px] p-5 shadow-press-card">
          <p className="text-ink-soft text-sm font-bold">
            No account session found. Head back to the app and try again.
          </p>
        </div>
      )}

      {!loading && account && account.isAnonymous && (
        <div className="bg-white rounded-[22px] p-5 shadow-press-card flex flex-col gap-3">
          <div>
            <h3 className="font-extrabold text-ink">Save your family&apos;s progress</h3>
            <p className="text-ink-soft text-sm font-bold mt-1">
              You&apos;re using a guest account right now. Add your email to keep your
              children&apos;s progress safe and use it on other devices.
            </p>
          </div>
          {claimStatus === 'sent' ? (
            <div className="bg-success-bg rounded-2xl px-4 py-3 text-success-edge text-sm font-bold">
              ✓ Check your inbox! Open the confirmation link we sent to{' '}
              <strong>{claimEmail.trim()}</strong> to finish saving your account.
            </div>
          ) : (
            <form onSubmit={handleClaim} className="flex flex-col gap-2">
              <div className="flex gap-3">
                <input
                  type="email"
                  value={claimEmail}
                  onChange={(e) => setClaimEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className={`${inputClass} flex-1 min-w-0`}
                />
                <button
                  type="submit"
                  disabled={!claimEmail.trim() || claimStatus === 'sending'}
                  className="pressable min-h-[56px] bg-success text-white rounded-2xl px-5 text-sm font-extrabold shadow-press-success disabled:opacity-50"
                >
                  {claimStatus === 'sending' ? 'Sending…' : 'Save progress'}
                </button>
              </div>
              {claimStatus === 'error' && (
                <p className="text-ink text-sm font-bold">
                  Something went wrong sending the confirmation email. Please try again.
                </p>
              )}
              {claimStatus === 'exists' && (
                <p className="text-ink text-sm font-bold">
                  That email already has a Mandarineer account! Use{' '}
                  <strong>&ldquo;Already saved on another device?&rdquo;</strong> below to
                  sign into it instead.
                </p>
              )}
            </form>
          )}
        </div>
      )}

      {!loading && account && account.isAnonymous && (
        <div className="bg-white rounded-[22px] p-5 shadow-press-card flex flex-col gap-3">
          <div>
            <h3 className="font-extrabold text-ink">Already saved on another device?</h3>
            <p className="text-ink-soft text-sm font-bold mt-1">
              Sign in with the email you used before and we&apos;ll bring your family&apos;s
              progress to this device.
            </p>
          </div>
          {signinStatus === 'sent' ? (
            <div className="bg-success-bg rounded-2xl px-4 py-3 text-success-edge text-sm font-bold">
              ✓ Check your inbox! Open the sign-in link we sent to{' '}
              <strong>{signinEmail.trim()}</strong> on this device.
            </div>
          ) : (
            <form onSubmit={handleSignIn} className="flex flex-col gap-2">
              <div className="flex gap-3">
                <input
                  type="email"
                  value={signinEmail}
                  onChange={(e) => setSigninEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className={`${inputClass} flex-1 min-w-0`}
                />
                <button
                  type="submit"
                  disabled={!signinEmail.trim() || signinStatus === 'sending'}
                  className="pressable min-h-[56px] bg-math text-white rounded-2xl px-5 text-sm font-extrabold shadow-press-math disabled:opacity-50"
                >
                  {signinStatus === 'sending' ? 'Sending…' : 'Email me a link'}
                </button>
              </div>
              {signinStatus === 'error' && (
                <p className="text-ink text-sm font-bold">
                  We couldn&apos;t find an account with that email, or the email failed to
                  send. Check the address and try again.
                </p>
              )}
            </form>
          )}
        </div>
      )}

      {!loading && account && !account.isAnonymous && (
        <div className="bg-white rounded-[22px] p-5 shadow-press-card flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-ink truncate">{account.email}</p>
            <p className="text-ink-soft text-sm font-bold mt-0.5">
              Your family&apos;s progress is saved to this account.
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="pressable min-h-[56px] bg-canvas-top text-ink-soft rounded-2xl px-4 text-sm font-extrabold shadow-press-chip flex-shrink-0"
          >
            Sign out
          </button>
        </div>
      )}
    </section>
  )
}

export default function ParentZone() {
  const router = useRouter()
  const [gate, setGate] = useState<'checking' | 'locked' | 'open'>('checking')

  useEffect(() => {
    setGate(sessionStorage.getItem(GATE_KEY) === 'passed' ? 'open' : 'locked')
  }, [])

  if (gate === 'checking') {
    return (
      <div className="min-h-screen bg-canvas-top flex items-center justify-center">
        <div className="font-emoji text-4xl animate-spin">⏳</div>
      </div>
    )
  }

  if (gate === 'locked') {
    return (
      <AdultGate
        onPass={() => {
          sessionStorage.setItem(GATE_KEY, 'passed')
          setGate('open')
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-canvas-top">
      <div className="max-w-2xl mx-auto p-6 flex flex-col gap-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            aria-label="Back to the app"
            className="pressable bg-white rounded-2xl w-14 h-14 flex items-center justify-center text-2xl text-ink shadow-press-chip flex-shrink-0"
          >
            ←
          </button>
          <div>
            <h1 className="text-[27px] font-extrabold text-ink leading-tight">Parent Zone</h1>
            <p className="text-ink-soft text-sm font-bold">Manage your children and account</p>
          </div>
        </div>

        <ChildrenSection />
        <AccountSection />

        {/* Quiet trust links — parents' surface only */}
        <footer className="flex items-center justify-center gap-6 pb-4">
          <Link
            href="/privacy"
            className="text-ink-soft text-sm font-bold underline underline-offset-2"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="text-ink-soft text-sm font-bold underline underline-offset-2"
          >
            Terms
          </Link>
        </footer>
      </div>
    </div>
  )
}
