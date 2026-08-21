'use client'

import { apiFetch, isNativeApp, setNativeChildId } from '@/lib/api-fetch'

// Cookie name mirrors CHILD_COOKIE in lib/auth.ts (not imported — that module pulls in Prisma).
const CHILD_COOKIE = 'kd_child'

/**
 * Sets the active child. On the web the authoritative cookie is set SERVER-side
 * via /api/children/active (httpOnly, 1 year) because Safari ITP evicts
 * JS-written cookies after 7 days; the document.cookie write below is only an
 * immediate fallback so the very next request works even if the API call is
 * still in flight. In the native app cookies don't cross to the API origin, so
 * the id lives in localStorage and rides the x-child-id header instead.
 * Await this before navigating.
 */
export async function setActiveChild(childId: string): Promise<boolean> {
  if (isNativeApp()) {
    setNativeChildId(childId)
    return true
  }
  document.cookie = `${CHILD_COOKIE}=${encodeURIComponent(childId)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
  try {
    const res = await apiFetch('/api/children/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childId }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Clears the active-child selection (used on sign-out). */
export async function clearActiveChild(): Promise<void> {
  if (isNativeApp()) {
    setNativeChildId(null)
    return
  }
  document.cookie = `${CHILD_COOKIE}=; path=/; max-age=0`
  await apiFetch('/api/children/active', { method: 'DELETE' }).catch(() => {})
}
