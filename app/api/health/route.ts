import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/** GET /api/health → { ok: true }. No auth, no database access. */
export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 })
}
