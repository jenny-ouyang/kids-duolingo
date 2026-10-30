'use client'

import { fetchJsonWithAuthRetry, isNativeApp } from '@/lib/api-fetch'

/**
 * iPhone in-app purchase (spec 2026-10-13 §6). Wraps the in-app Capacitor
 * plugin ios/App/App/LifetimePurchase.swift (StoreKit 2) and sends each signed
 * transaction to POST /api/apple/verify, which grants the unlock.
 *
 * Every function is a safe no-op on the web (isNativeApp() guard). This module
 * reads no env vars: the iOS bundle is a static export.
 */

/** Where StoreKit runs. TestFlight and App Review are 'sandbox'. */
export type StoreEnvironment = 'production' | 'sandbox' | 'xcode' | 'unknown'

export interface StoreProduct {
  id: string
  /** Apple's localized price, e.g. "$9.99" or "9,99 €". Never hardcode the price on iPhone. */
  displayPrice: string
}

export interface StoreInfo {
  /** null when the App Store did not return the product (not ready, or offline) */
  product: StoreProduct | null
  environment: StoreEnvironment
}

interface PluginPurchaseResult {
  status: 'ok' | 'pending' | 'cancelled'
  jws?: string
}

interface LifetimePurchasePlugin {
  getProduct(): Promise<{ product?: StoreProduct; environment?: StoreEnvironment }>
  purchase(): Promise<PluginPurchaseResult>
  restore(): Promise<{ jws?: string[] }>
  addListener(
    event: 'purchaseUpdated',
    cb: (data: { jws: string }) => void
  ): Promise<{ remove: () => Promise<void> }>
}

let pluginPromise: Promise<LifetimePurchasePlugin> | null = null

/** Dynamic import keeps @capacitor/core's plugin proxy off the web hot path (same as lib/haptics.ts). */
function plugin(): Promise<LifetimePurchasePlugin> {
  if (!pluginPromise) {
    pluginPromise = import('@capacitor/core').then(({ registerPlugin }) =>
      registerPlugin<LifetimePurchasePlugin>('LifetimePurchase')
    )
  }
  return pluginPromise
}

export async function getStoreInfo(): Promise<StoreInfo> {
  if (!isNativeApp()) return { product: null, environment: 'unknown' }
  try {
    const res = await (await plugin()).getProduct()
    return { product: res.product ?? null, environment: res.environment ?? 'unknown' }
  } catch {
    return { product: null, environment: 'unknown' }
  }
}

export type PurchaseOutcome =
  | 'unlocked' // verified by our server
  | 'pending' // Ask to Buy: waiting for the family organizer
  | 'cancelled'
  | 'nothing-to-restore'
  | 'verify-failed' // Apple charged / owns it, our server did not confirm yet: Restore fixes it
  | 'store-error'

/** Sends one signed transaction to the server. */
export async function verifyWithServer(jws: string): Promise<boolean> {
  const { ok } = await fetchJsonWithAuthRetry<{ lifetime?: boolean }>('/api/apple/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jws }),
  })
  return ok
}

export async function buyLifetime(): Promise<PurchaseOutcome> {
  if (!isNativeApp()) return 'store-error'
  let result: PluginPurchaseResult
  try {
    result = await (await plugin()).purchase()
  } catch {
    return 'store-error'
  }
  if (result.status === 'cancelled') return 'cancelled'
  if (result.status === 'pending') return 'pending'
  if (!result.jws) return 'store-error'
  return (await verifyWithServer(result.jws)) ? 'unlocked' : 'verify-failed'
}

export async function restoreLifetime(): Promise<PurchaseOutcome> {
  if (!isNativeApp()) return 'store-error'
  let jwsList: string[]
  try {
    jwsList = (await (await plugin()).restore()).jws ?? []
  } catch {
    return 'store-error'
  }
  if (jwsList.length === 0) return 'nothing-to-restore'
  for (const jws of jwsList) {
    if (await verifyWithServer(jws)) return 'unlocked'
  }
  return 'verify-failed'
}

/**
 * Purchases that finish outside the Buy tap (Ask to Buy approved later, a
 * purchase interrupted by the app closing). Returns an unsubscribe function.
 */
export function onPurchaseUpdated(cb: (jws: string) => void): () => void {
  if (!isNativeApp()) return () => {}
  let handle: { remove: () => Promise<void> } | null = null
  let stopped = false
  plugin()
    .then((p) => p.addListener('purchaseUpdated', ({ jws }) => cb(jws)))
    .then((h) => {
      handle = h
      if (stopped) h.remove().catch(() => {})
    })
    .catch(() => {})
  return () => {
    stopped = true
    handle?.remove().catch(() => {})
  }
}
