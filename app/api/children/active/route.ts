import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { getAuthContext, authErrorResponse, CHILD_COOKIE } from '@/lib/auth'

const ONE_YEAR = 60 * 60 * 24 * 365

/**
 * POST /api/children/active
 * Body: { childId } — sets the active-child cookie server-side.
 * Server-set (httpOnly) so Safari ITP doesn't evict it after 7 days the way it
 * does JS-written cookies — a silent eviction would misroute progress writes to
 * the account's oldest child via requireChild()'s fallback.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await getAuthContext()
    const body = await req.json() as { childId?: unknown }
    if (typeof body.childId !== 'string') {
      return NextResponse.json({ error: 'childId required' }, { status: 400 })
    }

    const child = await prisma.child.findFirst({
      where: { id: body.childId, accountId: userId },
      select: { id: true },
    })
    if (!child) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }

    cookies().set(CHILD_COOKIE, child.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: ONE_YEAR,
      path: '/',
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const authErr = authErrorResponse(err)
    if (authErr) return authErr
    console.error('[children/active POST]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
