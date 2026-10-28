'use client'

import { useEffect } from 'react'
import { familyEntry } from '@/lib/guest-session'

/**
 * The landing page is for strangers, but a signed-in family can land on it too:
 * after the sign-in email link (it opens "/" with a ?code), or after the child
 * cookie expired. Creating the Supabase client finishes the email sign-in;
 * then the family goes straight into the app. Renders nothing.
 */
export default function ResumeFamily() {
  useEffect(() => {
    let cancelled = false
    familyEntry()
      .then((to) => {
        // Full load: "/" is server-rendered and must re-read the new child cookie
        if (!cancelled && to) window.location.replace(to)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return null
}
