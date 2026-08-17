import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createSupabaseServer } from '@/lib/supabase-server'
import type { Child } from '@/lib/generated/prisma'

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
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new AuthError(401, 'unauthenticated')

  const isGuest = user.is_anonymous ?? !user.email
  const existing = await prisma.account.findUnique({ where: { id: user.id } })
  if (!existing) {
    await prisma.account.create({
      data: { id: user.id, email: user.email ?? null, isGuest },
    })
  } else if (existing.isGuest && !isGuest) {
    // Guest just claimed the account (magic link / OAuth) — record it.
    await prisma.account.update({
      where: { id: user.id },
      data: { email: user.email ?? existing.email, isGuest: false },
    })
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

  const cookieChildId = cookies().get(CHILD_COOKIE)?.value
  let child: Child | null = null

  if (cookieChildId) {
    child = await prisma.child.findFirst({
      where: { id: cookieChildId, accountId: userId },
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
