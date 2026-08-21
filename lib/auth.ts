import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createSupabaseServer } from '@/lib/supabase-server'
import { Prisma } from '@/lib/generated/prisma'
import type { Child } from '@/lib/generated/prisma'

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}

/** Cookie holding the active child's id. A hint only — ownership is verified on every request. */
export const CHILD_COOKIE = 'kd_child'

export class AuthError extends Error {
  constructor(
    public status: 401 | 403,
    public code: 'unauthenticated' | 'no-child',
    message?: string
  ) {
    super(message ?? code)
  }
}

/**
 * Validates the Supabase JWT (getUser(), never getSession(), which is spoofable
 * server-side) and ensures an Account row exists. Returns the auth user id.
 */
export async function getAuthContext(): Promise<{ userId: string }> {
  const supabase = createSupabaseServer()
  // The native (Capacitor) app is cross-origin, so its session arrives as a
  // Bearer token instead of cookies. getUser(jwt) validates it the same way.
  const bearer = headers().get('authorization')?.match(/^Bearer (.+)$/)?.[1]
  const {
    data: { user },
  } = bearer ? await supabase.auth.getUser(bearer) : await supabase.auth.getUser()
  if (!user) throw new AuthError(401, 'unauthenticated')

  // Supabase reports anonymous users with email as EMPTY STRING, not null — and
  // Account.email is @unique, so "" must normalize to null or the second guest
  // ever created collides with the first.
  const userEmail = user.email || null
  const isGuest = user.is_anonymous ?? !userEmail
  // Race-safe provisioning. NOTE: upsert is NOT atomic here — Account has a second
  // unique field (email), which makes Prisma fall back to find-then-create, and a
  // new user's first page load fires several API calls concurrently. So: create,
  // and on a unique-violation loss re-read the winner's row.
  let existing = await prisma.account.findUnique({ where: { id: user.id } })
  if (!existing) {
    try {
      existing = await prisma.account.create({
        data: { id: user.id, email: userEmail, isGuest },
      })
    } catch (err) {
      if (!isUniqueViolation(err)) throw err
      existing = await prisma.account.findUnique({ where: { id: user.id } })
      if (!existing) throw err
    }
  }
  if (existing.isGuest && !isGuest) {
    // Guest just claimed the account (magic link / OAuth) — record it.
    try {
      await prisma.account.update({
        where: { id: user.id },
        data: { email: userEmail ?? existing.email, isGuest: false },
      })
    } catch (err) {
      if (!isUniqueViolation(err)) throw err
      // Email already on another Account row — still flip isGuest so this
      // branch doesn't re-fire (and fail) on every subsequent request.
      await prisma.account.update({
        where: { id: user.id },
        data: { isGuest: false },
      })
    }
  }

  return { userId: user.id }
}

/**
 * The ONLY way handlers obtain a childId. Reads the kd_child cookie, verifies the
 * child belongs to the authenticated account, falls back to the account's first
 * child if the cookie is missing or stale. Handlers must never accept a childId
 * from the request body or query string.
 */
export async function requireChild(): Promise<{ userId: string; child: Child }> {
  const { userId } = await getAuthContext()

  // Active-child hint: x-child-id header (native app) or kd_child cookie (web).
  // Either way it is only a hint — ownership is verified against the account.
  const hintedChildId = headers().get('x-child-id') ?? cookies().get(CHILD_COOKIE)?.value
  let child: Child | null = null

  if (hintedChildId) {
    child = await prisma.child.findFirst({
      where: { id: hintedChildId, accountId: userId },
    })
  }
  if (!child) {
    child = await prisma.child.findFirst({
      where: { accountId: userId },
      orderBy: { createdAt: 'asc' },
    })
  }
  if (!child) throw new AuthError(403, 'no-child')

  return { userId, child }
}

/** Standard error → response mapping for route handlers. */
export function authErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.code }, { status: err.status })
  }
  return null
}
