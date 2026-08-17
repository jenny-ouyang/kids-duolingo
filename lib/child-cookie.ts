/** Client-side helper for the active-child cookie. Server routes read it via lib/auth.ts. */

const CHILD_COOKIE = 'kd_child'
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

/** Marks childId as the active child. The server verifies ownership on every request. */
export function setActiveChild(childId: string) {
  document.cookie = `${CHILD_COOKIE}=${encodeURIComponent(childId)}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`
}
