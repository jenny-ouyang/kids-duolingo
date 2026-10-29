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

function linkClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

/**
 * Sends the sign-in email for an EXISTING account (shouldCreateUser: false, so
 * a typo can't spawn an empty account). It uses the implicit flow, not PKCE:
 * a PKCE link only works in the browser that asked for it, and parents often
 * open the email somewhere else (Jenny, 2026-10-28). The link opens "/" with
 * the session in the #fragment, which finishLinkSignIn() stores.
 */
export async function sendSignInLink(email: string): Promise<boolean> {
  const { error } = await linkClient().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
  })
  return !error
}

/**
 * Signs in with the code from the sign-in email. The iPhone app needs this:
 * the email's link opens Safari, not the app. The parent types the code, so
 * this browser asked for it and no confirm is needed (unlike a link).
 */
export async function verifySignInCode(email: string, code: string): Promise<boolean> {
  const { data, error } = await linkClient().auth.verifyOtp({ email, token: code, type: 'email' })
  if (error || !data.session) return false
  const { access_token, refresh_token } = data.session
  const { error: saveError } = await createSupabaseBrowser().auth.setSession({ access_token, refresh_token })
  return !saveError
}

/**
 * Stores the session from a sign-in link (#access_token=…). A link can carry
 * anyone's session (someone could send a parent a link to THEIR account), and
 * binding it to this browser would break the any-browser sign-in. So: magic
 * links only, the email is checked with the server, and the parent confirms
 * that email before this browser keeps the session.
 * Returns false when the link itself failed (too old, or used already).
 */
async function finishLinkSignIn(): Promise<boolean> {
  const hash = new URLSearchParams(window.location.hash.slice(1))
  if (hash.get('error_code') || hash.get('error')) {
    history.replaceState(null, '', window.location.pathname + window.location.search)
    return false
  }
  const access_token = hash.get('access_token')
  const refresh_token = hash.get('refresh_token')
  if (!access_token || !refresh_token || hash.get('type') !== 'magiclink') return true
  history.replaceState(null, '', window.location.pathname + window.location.search)
  const { data, error } = await linkClient().auth.getUser(access_token)
  const email = data.user?.email
  if (error || !email) return false
  if (!window.confirm(`Sign in as ${email}?`)) return true
  await createSupabaseBrowser().auth.setSession({ access_token, refresh_token })
  return true
}

/**
 * Where a signed-in family should land: no child yet → /welcome, one child →
 * that child's home (cookie set first), several → the picker; a failed sign-in
 * link → /signin to send a new one. Null when this
 * browser has no session, so the caller stays where it is.
 */
export async function familyEntry(): Promise<string | null> {
  // A failed link must not drop the parent into whatever family this browser
  // already holds (Jenny, 2026-10-28: an old link opened a test family)
  if (!(await finishLinkSignIn())) return '/signin?link=old'
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
