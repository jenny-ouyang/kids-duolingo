import { describe, expect, it } from 'vitest'
import { groupPacksBySubject, packState } from './report-packs'

const pack = (over: Partial<{ id: string; subject: string; totalWords: number; started: number; learned: number }>) => ({
  id: 'p',
  subject: 'chinese',
  totalWords: 10,
  started: 0,
  learned: 0,
  ...over,
})

describe('packState', () => {
  it('8 of 10 learned is Learning, not Done', () => {
    expect(packState(pack({ started: 8, learned: 8 }))).toBe('learning')
  })

  it('every item learned is Done', () => {
    expect(packState(pack({ started: 10, learned: 10 }))).toBe('done')
  })

  it('only wrong answers so far is still Learning (started, 0 learned)', () => {
    expect(packState(pack({ started: 3, learned: 0 }))).toBe('learning')
  })

  it('no progress is Not started', () => {
    expect(packState(pack({}))).toBe('notStarted')
  })

  it('an empty pack is never Done', () => {
    expect(packState(pack({ totalWords: 0 }))).toBe('notStarted')
  })
})

describe('groupPacksBySubject', () => {
  it('counts Chinese and math separately', () => {
    const packs = [
      pack({ id: 'animals', started: 8, learned: 8 }),
      pack({ id: 'colors' }),
      pack({ id: 'food' }),
      pack({ id: 'add', subject: 'math' }),
      pack({ id: 'sub', subject: 'math', started: 2, learned: 2 }),
    ]
    const [chinese, math] = groupPacksBySubject(packs)
    expect(chinese.subject).toBe('chinese')
    expect(chinese.learning.map((p) => p.id)).toEqual(['animals'])
    expect(chinese.notStarted.map((p) => p.id)).toEqual(['colors', 'food'])
    expect(math.subject).toBe('math')
    expect(math.learning.map((p) => p.id)).toEqual(['sub'])
    expect(math.notStarted.map((p) => p.id)).toEqual(['add'])
  })

  it('leaves out a subject with no packs', () => {
    const groups = groupPacksBySubject([pack({ id: 'animals' })])
    expect(groups.map((g) => g.subject)).toEqual(['chinese'])
  })
})
