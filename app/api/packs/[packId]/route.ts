import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * GET /api/packs/[packId]
 * Returns a single pack with its full word list, read from PostgreSQL.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { packId: string } }
) {
  try {
    const pack = await prisma.pack.findUnique({
      where: { id: params.packId },
      include: { words: { orderBy: { sortOrder: 'asc' } } },
    })

    if (!pack) {
      return NextResponse.json({ error: 'Pack not found' }, { status: 404 })
    }

    return NextResponse.json(pack)
  } catch (err) {
    console.error('[packs/[packId] GET]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
