import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext, authErrorResponse } from '@/lib/auth'

const MAX_CHILDREN = 6
const MAX_NAME_LENGTH = 20

function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.trim().slice(0, MAX_NAME_LENGTH)
  return name.length > 0 ? name : null
}

/**
 * GET /api/children — list the account's children.
 */
export async function GET() {
  try {
    const { userId } = await getAuthContext()
    const children = await prisma.child.findMany({
      where: { accountId: userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, avatar: true, totalHearts: true, streak: true, lastPracticed: true },
    })
    return NextResponse.json(children)
  } catch (err) {
    const authErr = authErrorResponse(err)
    if (authErr) return authErr
    console.error('[children GET]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}

/**
 * POST /api/children
 * Body: { name, avatar? } — create a child (nickname + avatar only, no PII).
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await getAuthContext()
    const body = await req.json() as { name?: unknown; avatar?: unknown }

    const name = sanitizeName(body.name)
    if (!name) {
      return NextResponse.json({ error: 'name required' }, { status: 400 })
    }
    const avatar = typeof body.avatar === 'string' && body.avatar.length <= 8 ? body.avatar : undefined

    const count = await prisma.child.count({ where: { accountId: userId } })
    if (count >= MAX_CHILDREN) {
      return NextResponse.json({ error: 'child limit reached' }, { status: 400 })
    }

    const child = await prisma.child.create({
      data: { accountId: userId, name, ...(avatar ? { avatar } : {}) },
      select: { id: true, name: true, avatar: true, totalHearts: true, streak: true, lastPracticed: true },
    })
    return NextResponse.json(child, { status: 201 })
  } catch (err) {
    const authErr = authErrorResponse(err)
    if (authErr) return authErr
    console.error('[children POST]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}

/**
 * PATCH /api/children
 * Body: { id, name?, avatar? } — rename / re-avatar a child. Ownership enforced in the where clause.
 */
export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await getAuthContext()
    const body = await req.json() as { id?: unknown; name?: unknown; avatar?: unknown }

    if (typeof body.id !== 'string') {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }
    const data: { name?: string; avatar?: string } = {}
    const name = sanitizeName(body.name)
    if (name) data.name = name
    if (typeof body.avatar === 'string' && body.avatar.length <= 8) data.avatar = body.avatar
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
    }

    const result = await prisma.child.updateMany({
      where: { id: body.id, accountId: userId },
      data,
    })
    if (result.count === 0) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    const authErr = authErrorResponse(err)
    if (authErr) return authErr
    console.error('[children PATCH]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}

/**
 * DELETE /api/children?id=<childId> — delete a child and (via FK cascade) all their progress.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await getAuthContext()
    const id = req.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const result = await prisma.child.deleteMany({
      where: { id, accountId: userId },
    })
    if (result.count === 0) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    const authErr = authErrorResponse(err)
    if (authErr) return authErr
    console.error('[children DELETE]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
