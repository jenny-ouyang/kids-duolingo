'use client'

import { createSupabaseBrowser } from '@/lib/supabase-browser'

const AUTH_RETRY_MAX = 6
const AUTH_RETRY_DELAY_MS = 1000

/**
 * In the Capacitor build the UI is served from capacitor://localhost, so API
 * calls must target the deployed backend absolutely. On the web this is ''
 * and every path stays same-origin.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? ''

export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return cap?.isNativePlatform?.() ?? false
}

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`
}

const NATIVE_CHILD_KEY = 'kd_child_native'

export function getNativeChildId(): string | null {
  try {
    return localStorage.getItem(NATIVE_CHILD_KEY)
  } catch {
    return null
  }
}

export function setNativeChildId(childId: string | null) {
  try {
    if (childId) localStorage.setItem(NATIVE_CHILD_KEY, childId)
    else localStorage.removeItem(NATIVE_CHILD_KEY)
  } catch {
    /* storage unavailable — child falls back to the account's first child */
  }
}

/**
 * Auth transport differs by platform. On the web, Supabase session + kd_child
 * ride httpOnly cookies (same-origin). In the native shell the API is
 * cross-origin, so the session token and active child travel as headers —
 * lib/auth.ts verifies both exactly as it does the cookies.
 */
async function nativeAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await createSupabaseBrowser().auth.getSession()
  const headers: Record<string, string> = {}
  if (session?.access_token) headers['authorization'] = `Bearer ${session.access_token}`
  const childId = getNativeChildId()
  if (childId) headers['x-child-id'] = childId
  return headers
}

/** fetch() for /api/* paths: absolute base + native auth headers when needed. */
export async function apiFetch(path: string, opts?: RequestInit): Promise<Response> {
  let init = opts
  if (isNativeApp()) {
    init = { ...opts, headers: { ...(await nativeAuthHeaders()), ...(opts?.headers as Record<string, string>) } }
  }
  return fetch(apiUrl(path), init)
}

export interface ApiFetchResult<T> {
  ok: boolean
  status: number
  data: T | null
}

/**
 * Fetch that tolerates the anonymous-auth bootstrap race: AuthBootstrap may
 * still be signing in when a page's first API call fires, so on 401 this
 * retries up to 6 times at 1s intervals before giving up.
 * Returns { ok, status, data } where data is the parsed JSON body or null.
 * A network error surfaces as { ok: false, status: 0, data: null }.
 */
export async function fetchJsonWithAuthRetry<T = unknown>(
  url: string,
  opts?: RequestInit
): Promise<ApiFetchResult<T>> {
  let res: Response | null = null
  for (let attempt = 0; attempt < AUTH_RETRY_MAX; attempt++) {
    try {
      res = await apiFetch(url, opts)
    } catch {
      return { ok: false, status: 0, data: null }
    }
    if (res.status !== 401 || attempt === AUTH_RETRY_MAX - 1) break
    await new Promise((resolve) => setTimeout(resolve, AUTH_RETRY_DELAY_MS))
  }
  if (!res) return { ok: false, status: 0, data: null }
  const data = (await res.json().catch(() => null)) as T | null
  return { ok: res.ok, status: res.status, data }
}

const OFFLINE_CACHE_PREFIX = 'kd_cache:'

/**
 * GET with offline fallback: successful responses are cached in localStorage
 * (keyed per child so siblings never see each other's data); when the network
 * or backend is unreachable the last good response is served instead. Used by
 * the practice flow so previously played packs work on a plane.
 */
export async function fetchJsonCached<T = unknown>(url: string): Promise<ApiFetchResult<T>> {
  const cacheKey = `${OFFLINE_CACHE_PREFIX}${getNativeChildId() ?? 'web'}:${url}`
  const result = await fetchJsonWithAuthRetry<T>(url)
  if (result.ok && result.data !== null) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify(result.data))
    } catch {
      /* cache full — fine, offline fallback just won't cover this pack */
    }
    return result
  }
  if (result.status === 0 || result.status >= 500) {
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) return { ok: true, status: 200, data: JSON.parse(cached) as T }
    } catch {
      /* fall through to the failed result */
    }
  }
  return result
}
