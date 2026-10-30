import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, authErrorResponse } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertPackAccess, packLockedResponse } from '@/lib/pack-gate'

/**
 * GET /api/packs/[packId]
 * Returns a single pack with its full word list, read from PostgreSQL.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { packId: string } }
) {
  try {
    const { account } = await getAuthContext()
    assertPackAccess(account, params.packId)
    const pack = await prisma.pack.findUnique({
      where: { id: params.packId },
      include: { words: { orderBy: { sortOrder: 'asc' } } },
    })

    if (!pack) {
      return NextResponse.json({ error: 'Pack not found' }, { status: 404 })
    }

    return NextResponse.json(pack)
  } catch (err) {
    const locked = packLockedResponse(err)
    if (locked) return locked
    const authErr = authErrorResponse(err)
    if (authErr) return authErr
    console.error('[packs/[packId] GET]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
