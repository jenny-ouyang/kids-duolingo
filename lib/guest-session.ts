'use client'

import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { apiFetch } from '@/lib/api-fetch'
import { setActiveChild } from '@/lib/child-cookie'

/** True when this browser (or the native shell) already holds a Supabase session. */
export async function hasSession(): Promise<boolean> {
  const { data } = await createSupabaseBrowser().auth.getSession()
  return Boolean(data.session)
}

/**
 * Guest-first auth, on demand. A guest auth user is created only at the moment
 * a family makes its first child (/welcome, or "Add a child" in the Parent
 * Zone) — never on page load, so visitors and crawlers create no accounts.
 * Returns false if sign-in failed; callers surface their usual retry copy.
 */
export async function ensureGuestSession(): Promise<boolean> {
  try {
    if (await hasSession()) return true
    const { error } = await createSupabaseBrowser().auth.signInAnonymously()
    if (error) {
      console.warn('[auth] anonymous sign-in failed:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.warn('[auth] anonymous sign-in failed:', err)
    return false
  }
}

/**
 * Where a signed-in family should land: no child yet → /welcome, one child →
 * that child's home (cookie set first), several → the picker. Null when this
 * browser has no session, so the caller stays where it is.
 */
export async function familyEntry(): Promise<string | null> {
  if (!(await hasSession())) return null
  const res = await apiFetch(`/api/children?tz=${new Date().getTimezoneOffset()}`)
  if (!res.ok) return null
  const children = (await res.json()) as { id: string }[]
  if (children.length === 0) return '/welcome'
  if (children.length === 1) {
    await setActiveChild(children[0].id)
    return '/'
  }
  return '/switch'
}
