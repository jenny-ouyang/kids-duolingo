'use client'

import { createClient } from '@supabase/supabase-js'
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
 * Sends the sign-in email for an EXISTING account (shouldCreateUser: false, so
 * a typo can't spawn an empty account). It uses the implicit flow, not PKCE:
 * a PKCE link only works in the browser that asked for it, and parents often
 * open the email somewhere else. The link opens "/" with the session in the
 * #fragment, which finishLinkSignIn() stores.
 */
export async function sendSignInLink(email: string): Promise<boolean> {
  const linkClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { error } = await linkClient.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
  })
  return !error
}

/**
 * Stores the session from a sign-in link (#access_token=…), then removes it
 * from the address bar. A link can carry anyone's session (someone could send
 * a parent a link to THEIR account), so: magic links only, and a browser that
 * already has a session asks before it switches, naming the email.
 */
async function finishLinkSignIn(): Promise<void> {
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const access_token = hash.get('access_token')
  const refresh_token = hash.get('refresh_token')
  if (!access_token || !refresh_token || hash.get('type') !== 'magiclink') return
  history.replaceState(null, '', window.location.pathname + window.location.search)
  if (await hasSession()) {
    let email = 'another account'
    try {
      email = (JSON.parse(atob(access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { email?: string }).email || email
    } catch { /* unreadable token: keep the generic name */ }
    if (!window.confirm(`Sign in as ${email}? This browser leaves the family it has now.`)) return
  }
  await createSupabaseBrowser().auth.setSession({ access_token, refresh_token })
}

/**
 * Where a signed-in family should land: no child yet → /welcome, one child →
 * that child's home (cookie set first), several → the picker. Null when this
 * browser has no session, so the caller stays where it is.
 */
export async function familyEntry(): Promise<string | null> {
  await finishLinkSignIn()
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
