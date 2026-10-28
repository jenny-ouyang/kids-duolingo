'use client'

import { useEffect } from 'react'
import { familyEntry } from '@/lib/guest-session'

/**
 * The sign-in email link opens "/". When this browser already has a child
 * cookie, "/" renders that child's home, not the landing, so the landing's
 * ResumeFamily never sees the link and the old family stays (Jenny,
 * 2026-10-28: "still uses tada"). This runs on every page and finishes any
 * sign-in link in the #fragment. Renders nothing.
 */
export default function SignInLinkCatcher() {
  useEffect(() => {
    if (!/access_token=|error_code=|error=/.test(window.location.hash)) return
    familyEntry()
      .then((to) => {
        if (to) window.location.replace(to)
      })
      .catch(() => {})
  }, [])
  return null
}
