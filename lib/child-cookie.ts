'use client'

// Cookie name mirrors CHILD_COOKIE in lib/auth.ts (not imported — that module pulls in Prisma).
const CHILD_COOKIE = 'kd_child'

/**
 * Sets the active child. The authoritative cookie is set SERVER-side via
 * /api/children/active (httpOnly, 1 year) because Safari ITP evicts JS-written
 * cookies after 7 days. The document.cookie write below is only an immediate
 * fallback so the very next request works even if the API call is still in flight.
 * Await this before navigating.
 */
export async function setActiveChild(childId: string): Promise<boolean> {
  document.cookie = `${CHILD_COOKIE}=${encodeURIComponent(childId)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
  try {
    const res = await fetch('/api/children/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childId }),
    })
    return res.ok
  } catch {
    return false
  }
}
