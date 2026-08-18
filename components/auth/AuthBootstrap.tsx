'use client'

import { useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

/**
 * Silent guest-first auth bootstrap. On first visit there is no Supabase session,
 * so we sign in anonymously — the kid gets a real auth user without ever seeing
 * an auth screen. Renders nothing; failures are logged and the app keeps working
 * (API calls simply 401 until auth succeeds).
 */
export default function AuthBootstrap() {
  useEffect(() => {
    async function bootstrap() {
      try {
        const supabase = createSupabaseBrowser()
        const { data } = await supabase.auth.getSession()
        if (data.session) return

        const { error } = await supabase.auth.signInAnonymously()
        if (error) console.warn('[auth] anonymous sign-in failed:', error.message)
      } catch (err) {
        console.warn('[auth] bootstrap failed:', err)
      }
    }
    bootstrap()
  }, [])

  return null
}
