'use client'

import { createBrowserClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | undefined

function isNative(): boolean {
  if (typeof window === 'undefined') return false
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return cap?.isNativePlatform?.() ?? false
}

/**
 * Singleton Supabase client for client components.
 *
 * Web: @supabase/ssr's cookie-backed client, so middleware/route handlers see
 * the session. Native (Capacitor): cookies don't persist reliably on the
 * capacitor:// scheme, so the session lives in localStorage instead — losing
 * it would silently mint a NEW anonymous account and orphan all progress.
 * The API receives the session as a Bearer header (lib/api-fetch.ts).
 */
export function createSupabaseBrowser(): SupabaseClient {
  if (!client) {
    client = isNative()
      ? createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            auth: {
              storage: window.localStorage,
              persistSession: true,
              autoRefreshToken: true,
            },
          }
        )
      : createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
  }
  return client
}
