import { afterEach, describe, expect, it } from 'vitest'
import { FREE_PACK_IDS, canAccessPack, hasLifetime, isPackFree, paymentsEnabled } from '@/lib/plan'

const free = { plan: 'free' }
const lifetime = { plan: 'lifetime' }

afterEach(() => {
  delete process.env.PAYMENTS_ENABLED
})

describe('free list', () => {
  it('contains exactly the four free packs plus the sentences practice mode', () => {
    expect([...FREE_PACK_IDS].sort()).toEqual(
      ['animals', 'colors', 'math_add_singles', 'numbers', 'sentences'].sort()
    )
  })
  it('isPackFree is true only for listed ids', () => {
    expect(isPackFree('animals')).toBe(true)
    expect(isPackFree('math_add_singles')).toBe(true)
    expect(isPackFree('food')).toBe(false)
    expect(isPackFree('s1-this-is')).toBe(false)
    expect(isPackFree('')).toBe(false)
  })
})

describe('paymentsEnabled', () => {
  it('is false unless PAYMENTS_ENABLED is exactly "true"', () => {
    expect(paymentsEnabled()).toBe(false)
    process.env.PAYMENTS_ENABLED = 'TRUE'
    expect(paymentsEnabled()).toBe(false)
    process.env.PAYMENTS_ENABLED = '1'
    expect(paymentsEnabled()).toBe(false)
    process.env.PAYMENTS_ENABLED = 'true'
    expect(paymentsEnabled()).toBe(true)
  })
})

describe('canAccessPack', () => {
  it('allows everything while payments are off', () => {
    expect(canAccessPack(free, 'food')).toBe(true)
    expect(canAccessPack(free, 's3-where-have')).toBe(true)
  })
  it('allows free packs for free accounts when payments are on', () => {
    process.env.PAYMENTS_ENABLED = 'true'
    expect(canAccessPack(free, 'animals')).toBe(true)
    expect(canAccessPack(free, 'math_add_singles')).toBe(true)
    expect(canAccessPack(free, 'sentences')).toBe(true)
  })
  it('locks paid packs for free accounts when payments are on', () => {
    process.env.PAYMENTS_ENABLED = 'true'
    expect(canAccessPack(free, 'food')).toBe(false)
    expect(canAccessPack(free, 'math_add_tens')).toBe(false)
    expect(canAccessPack(free, 's1-this-is')).toBe(false)
  })
  it('allows everything for lifetime accounts when payments are on', () => {
    process.env.PAYMENTS_ENABLED = 'true'
    expect(canAccessPack(lifetime, 'food')).toBe(true)
    expect(canAccessPack(lifetime, 's1-this-is')).toBe(true)
  })
  it('hasLifetime matches only the lifetime plan string', () => {
    expect(hasLifetime(lifetime)).toBe(true)
    expect(hasLifetime(free)).toBe(false)
    expect(hasLifetime({ plan: 'Lifetime' })).toBe(false)
  })
})
