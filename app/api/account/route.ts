import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { getAuthContext, authErrorResponse, CHILD_COOKIE } from '@/lib/auth'
import { hasLifetime, isPackFree, paymentsEnabled } from '@/lib/plan'

export const runtime = 'nodejs'

/**
 * GET /api/account — what the Parent Zone needs to render the unlock card.
 * Plan state comes from the validated session only. No childId involved.
 */
export async function GET() {
  try {
    const { account } = await getAuthContext()

    const packs = await prisma.pack.findMany({
      select: {
        id: true,
        _count: { select: { words: true, problems: true, sentences: true } },
      },
    })
    const withContent = packs.filter(
      (p) => p.id !== 'sentences' && p._count.words + p._count.problems + p._count.sentences > 0
    )
    const freePackCount = withContent.filter((p) => isPackFree(p.id)).length

    return NextResponse.json({
      plan: account.plan,
      lifetime: hasLifetime(account),
      isFounder: account.isFounder,
      isGuest: account.isGuest,
      email: account.email,
      paymentsEnabled: paymentsEnabled(),
      freePackCount,
      totalPackCount: withContent.length,
    })
  } catch (err) {
    const authErr = authErrorResponse(err)
    if (authErr) return authErr
    console.error('[account GET]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}

/**
 * DELETE /api/account — permanently deletes the signed-in account.
 *
 * Required by App Store guideline 5.1.1(v): an app that creates accounts must
 * let the user delete the account from inside the app. The account id comes
 * ONLY from the validated JWT (getAuthContext) — never from the request.
 *
 * Order: Account row (Prisma cascades Child → progress tables + AnswerEvent),
 * then the Supabase auth user. The app's Postgres role is the table owner
 * (`postgres`) and holds DELETE on auth.users, so no service-role key is
 * needed; Supabase cascades identities/sessions from that row.
 */
export async function DELETE() {
  try {
    const { userId } = await getAuthContext()

    await prisma.account.deleteMany({ where: { id: userId } })
    await prisma.$executeRaw`DELETE FROM auth.users WHERE id = ${userId}::uuid`

    // Clear the active-child cookie so the landing/app fork on / resets.
    cookies().set(CHILD_COOKIE, '', { httpOnly: true, sameSite: 'lax', maxAge: 0, path: '/' })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const authErr = authErrorResponse(err)
    if (authErr) return authErr
    console.error('[account DELETE]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
