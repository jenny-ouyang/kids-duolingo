import { NextResponse } from 'next/server'
import { canAccessPack } from '@/lib/plan'

/**
 * Server-side pack gate (spec 2026-10-13 §3). Routes call assertPackAccess()
 * right after auth and map the error with packLockedResponse() next to
 * authErrorResponse(). The rule itself lives in lib/plan.ts; this file only
 * turns it into an error + a 402.
 */
export class PackLockedError extends Error {
  constructor(public packId: string) {
    super('locked')
    this.name = 'PackLockedError'
  }
}

export function assertPackAccess(account: { plan: string }, packId: string): void {
  if (!canAccessPack(account, packId)) throw new PackLockedError(packId)
}

/** 402 Payment Required — the client shows the "Ask a grown-up" card. */
export function packLockedResponse(err: unknown): NextResponse | null {
  if (err instanceof PackLockedError) {
    return NextResponse.json({ error: 'locked', packId: err.packId }, { status: 402 })
  }
  return null
}

/** For /api/sentences/all: which source packs this account may draw sentences from. */
export function accessibleSentencePackIds(account: { plan: string }, allPackIds: string[]): string[] {
  return allPackIds.filter((id) => canAccessPack(account, id))
}
