import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findMany, del, executeRawUnsafe } = vi.hoisted(() => ({
  findMany: vi.fn(),
  del: vi.fn(),
  executeRawUnsafe: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    account: { findMany, delete: del },
    $executeRawUnsafe: executeRawUnsafe,
  },
}))

import { GET } from './route'

function req(auth?: string) {
  return new Request('http://localhost/api/cron/cleanup-guests', {
    headers: auth ? { authorization: auth } : {},
  }) as unknown as import('next/server').NextRequest
}

describe('cleanup-guests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
    findMany.mockResolvedValue([{ id: '11111111-1111-1111-1111-111111111111' }])
    del.mockResolvedValue({})
    executeRawUnsafe.mockResolvedValue(1)
  })

  it('rejects a missing or wrong secret', async () => {
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(findMany).not.toHaveBeenCalled()
  })

  it('only selects guest accounts on the free plan', async () => {
    const res = await GET(req('Bearer test-secret'))
    expect(res.status).toBe(200)
    const where = findMany.mock.calls[0][0].where
    expect(where.isGuest).toBe(true)
    expect(where.plan).toBe('free')
    expect(where.createdAt.lt).toBeInstanceOf(Date)
  })

  it('deletes each selected account and its anonymous auth user', async () => {
    await GET(req('Bearer test-secret'))
    expect(del).toHaveBeenCalledWith({ where: { id: '11111111-1111-1111-1111-111111111111' } })
    expect(executeRawUnsafe).toHaveBeenCalledTimes(1)
  })
})
