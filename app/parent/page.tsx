'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { fetchJsonWithAuthRetry } from '@/lib/api-fetch'
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 w-full max-w-sm text-center"
      >
        <div className="text-4xl mb-3">🔒</div>
        <h1 className="text-xl font-bold text-gray-800">Grown-ups only</h1>
        <p className="text-gray-500 text-sm mt-1">
          Answer this to open the parent zone.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          <p className="text-lg font-semibold text-gray-700">
            {GATE_QUESTIONS[questionIdx].prompt}
          </p>
          <input
            type="number"
            inputMode="numeric"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            autoFocus
            className="border border-gray-200 rounded-xl px-4 py-2 text-center text-lg font-semibold text-gray-800 focus:outline-none focus:border-blue-400"
          />
          {wrong && (
            <p className="text-red-500 text-sm">Not quite — try this one instead.</p>
          )}
          <button
            type="submit"
            className="bg-blue-600 text-white rounded-xl px-4 py-2 font-semibold hover:bg-blue-700 transition-colors"
          >
            Unlock
          </button>
        </form>
        <button
          onClick={() => router.push('/')}
          className="mt-4 text-gray-400 text-sm underline underline-offset-2"
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
    <div className="flex flex-wrap gap-2">
      {AVATARS.map((avatar) => (
        <button
          key={avatar}
          type="button"
          onClick={() => onChange(avatar)}
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-colors ${
            value === avatar
              ? 'bg-blue-100 border-2 border-blue-400'
              : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
          }`}
        >
          {avatar}
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
      const res = await fetch('/api/children', {
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
      const res = await fetch('/api/children', {
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
      const res = await fetch(`/api/children?id=${encodeURIComponent(child.id)}`, {
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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-700">Children</h2>
        {children !== null && children.length < MAX_CHILDREN && !showAdd && (
          <button
            onClick={() => {
              setShowAdd(true)
              setEditingId(null)
              setDeletingId(null)
            }}
            className="bg-blue-50 text-blue-600 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-blue-100 transition-colors"
          >
            + Add a child
          </button>
        )}
      </div>

      {loadFailed && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-red-600 text-sm flex items-center justify-between gap-3">
          <span>Couldn&apos;t load your children.</span>
          <button
            onClick={fetchChildren}
            className="font-semibold underline underline-offset-2 flex-shrink-0"
          >
            Try again
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-red-600 text-sm">
          {error}
        </div>
      )}

      {children !== null && children.length >= MAX_CHILDREN && (
        <p className="text-gray-500 text-sm">
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
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3 overflow-hidden"
          >
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Child's nickname"
              maxLength={20}
              autoFocus
              className="border border-gray-200 rounded-xl px-4 py-2 text-gray-800 focus:outline-none focus:border-blue-400"
            />
            <AvatarPicker value={newAvatar} onChange={setNewAvatar} />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!newName.trim() || saving}
                className="bg-blue-600 text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="bg-gray-100 text-gray-600 rounded-xl px-4 py-2 text-sm font-semibold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {children === null && (
        <div className="text-gray-400 text-sm">Loading…</div>
      )}

      {children !== null && children.length === 0 && !loadFailed && (
        <p className="text-gray-500 text-sm">
          No children yet. Add one to get started.
        </p>
      )}

      {children?.map((child) => (
        <motion.div
          key={child.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3"
        >
          {editingId === child.id ? (
            <form onSubmit={handleEdit} className="flex flex-col gap-3">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={20}
                autoFocus
                className="border border-gray-200 rounded-xl px-4 py-2 text-gray-800 focus:outline-none focus:border-blue-400"
              />
              <AvatarPicker value={editAvatar} onChange={setEditAvatar} />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!editName.trim() || saving}
                  className="bg-blue-600 text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="bg-gray-100 text-gray-600 rounded-xl px-4 py-2 text-sm font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-2xl flex-shrink-0">
                {child.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800">{child.name}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  ❤️ {child.totalHearts} hearts · 🔥 {child.streak} day streak ·{' '}
                  {formatLastPracticed(child.lastPracticed)}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => startEdit(child)}
                  className="bg-gray-100 text-gray-600 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-gray-200 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    setDeletingId(deletingId === child.id ? null : child.id)
                    setDeleteText('')
                    setEditingId(null)
                  }}
                  className="bg-red-50 text-red-500 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-red-100 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          {deletingId === child.id && editingId !== child.id && (
            <div className="border-t border-gray-100 pt-3 flex flex-col gap-2">
              <p className="text-sm text-red-600">
                This permanently deletes <strong>{child.name}</strong> and all their
                progress. Type <strong>{child.name}</strong> to confirm.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  placeholder={child.name}
                  className="border border-gray-200 rounded-xl px-4 py-2 text-gray-800 flex-1 focus:outline-none focus:border-red-400"
                />
                <button
                  onClick={() => handleDelete(child)}
                  disabled={deleteText !== child.name || saving}
                  className="bg-red-500 text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
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
  const [claimStatus, setClaimStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

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
    setClaimStatus(error ? 'error' : 'sent')
  }

  async function handleSignOut() {
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    // Full navigation so a fresh anonymous session bootstraps on the home page.
    window.location.assign('/')
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-bold text-gray-700">Account</h2>

      {loading && <div className="text-gray-400 text-sm">Loading…</div>}

      {!loading && !account && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-gray-500 text-sm">
            No account session found. Head back to the app and try again.
          </p>
        </div>
      )}

      {!loading && account && account.isAnonymous && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3">
          <div>
            <h3 className="font-bold text-gray-800">Save your family&apos;s progress</h3>
            <p className="text-gray-500 text-sm mt-1">
              You&apos;re using a guest account right now. Add your email to keep your
              children&apos;s progress safe and use it on other devices.
            </p>
          </div>
          {claimStatus === 'sent' ? (
            <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-green-700 text-sm">
              Check your inbox! Open the confirmation link we sent to{' '}
              <strong>{claimEmail.trim()}</strong> to finish saving your account.
            </div>
          ) : (
            <form onSubmit={handleClaim} className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={claimEmail}
                  onChange={(e) => setClaimEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="border border-gray-200 rounded-xl px-4 py-2 text-gray-800 flex-1 focus:outline-none focus:border-blue-400"
                />
                <button
                  type="submit"
                  disabled={!claimEmail.trim() || claimStatus === 'sending'}
                  className="bg-blue-600 text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {claimStatus === 'sending' ? 'Sending…' : 'Save progress'}
                </button>
              </div>
              {claimStatus === 'error' && (
                <p className="text-red-500 text-sm">
                  Something went wrong sending the confirmation email. Please try again.
                </p>
              )}
            </form>
          )}
        </div>
      )}

      {!loading && account && !account.isAnonymous && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800 truncate">{account.email}</p>
            <p className="text-gray-500 text-sm mt-0.5">
              Your family&apos;s progress is saved to this account.
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="bg-gray-100 text-gray-600 rounded-xl px-4 py-2 text-sm font-semibold hover:bg-gray-200 transition-colors flex-shrink-0"
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-4xl animate-spin">⏳</div>
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-6 flex flex-col gap-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-gray-600 hover:bg-gray-100 transition-colors font-medium"
          >
            ← Back to the app
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Parent Zone</h1>
            <p className="text-gray-500 text-sm">Manage your children and account</p>
          </div>
        </div>

        <ChildrenSection />
        <AccountSection />
      </div>
    </div>
  )
}
