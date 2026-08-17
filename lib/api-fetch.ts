'use client'

const AUTH_RETRY_MAX = 6
const AUTH_RETRY_DELAY_MS = 1000

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
      res = await fetch(url, opts)
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
