'use client'

import { createSupabaseBrowser } from '@/lib/supabase-browser'

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
