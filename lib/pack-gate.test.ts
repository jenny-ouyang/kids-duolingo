import { afterEach, describe, expect, it } from 'vitest'
import { PackLockedError, accessibleSentencePackIds, assertPackAccess, packLockedResponse } from '@/lib/pack-gate'

afterEach(() => {
  delete process.env.PAYMENTS_ENABLED
})

describe('assertPackAccess', () => {
  it('does nothing while payments are off', () => {
    expect(() => assertPackAccess({ plan: 'free' }, 'food')).not.toThrow()
  })
  it('throws PackLockedError for a paid pack on a free account', () => {
    process.env.PAYMENTS_ENABLED = 'true'
    expect(() => assertPackAccess({ plan: 'free' }, 'food')).toThrow(PackLockedError)
    try {
      assertPackAccess({ plan: 'free' }, 'food')
    } catch (e) {
      expect((e as PackLockedError).packId).toBe('food')
    }
  })
  it('lets free packs and lifetime accounts through', () => {
    process.env.PAYMENTS_ENABLED = 'true'
    expect(() => assertPackAccess({ plan: 'free' }, 'animals')).not.toThrow()
    expect(() => assertPackAccess({ plan: 'lifetime' }, 'food')).not.toThrow()
  })
})

describe('packLockedResponse', () => {
  it('maps PackLockedError to 402 { error: "locked", packId }', async () => {
    const res = packLockedResponse(new PackLockedError('s1-this-is'))
    expect(res?.status).toBe(402)
    expect(await res?.json()).toEqual({ error: 'locked', packId: 's1-this-is' })
  })
  it('returns null for anything else', () => {
    expect(packLockedResponse(new Error('boom'))).toBeNull()
    expect(packLockedResponse(undefined)).toBeNull()
  })
})

describe('accessibleSentencePackIds', () => {
  const all = ['animals', 'food', 'family', 'feelings', 'home', 's1-this-is', 's2-colors-counts', 's3-where-have']
  it('returns everything while payments are off', () => {
    expect(accessibleSentencePackIds({ plan: 'free' }, all)).toEqual(all)
  })
  it('keeps only free source packs for a free account when payments are on', () => {
    process.env.PAYMENTS_ENABLED = 'true'
    expect(accessibleSentencePackIds({ plan: 'free' }, all)).toEqual(['animals'])
  })
  it('returns everything for lifetime', () => {
    process.env.PAYMENTS_ENABLED = 'true'
    expect(accessibleSentencePackIds({ plan: 'lifetime' }, all)).toEqual(all)
  })
})
