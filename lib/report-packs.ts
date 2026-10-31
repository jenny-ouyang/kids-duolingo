/**
 * Pack grouping for the parent report (app/parent/report).
 *
 * "Learned" uses the same rule as the rest of the app (pack list ring, home
 * path, Play next): an item answered right at least once (repetitions >= 1).
 * A pack is Done when every item in it is learned, the same point where the
 * pack list moves it to its Mastered tab.
 */

export interface ReportPackLike {
  subject: string
  totalWords: number
  /** Items with any progress row, right or wrong */
  started: number
  /** Items answered right at least once (repetitions >= 1) */
  learned: number
}

export type PackState = 'learning' | 'done' | 'notStarted'

export function packState(p: ReportPackLike): PackState {
  if (p.totalWords > 0 && p.learned >= p.totalWords) return 'done'
  if (p.started > 0 || p.learned > 0) return 'learning'
  return 'notStarted'
}

export interface PackGroups<T> {
  learning: T[]
  done: T[]
  notStarted: T[]
}

export interface SubjectGroups<T> extends PackGroups<T> {
  subject: 'chinese' | 'math'
}

function group<T extends ReportPackLike>(packs: T[]): PackGroups<T> {
  return {
    learning: packs.filter((p) => packState(p) === 'learning'),
    done: packs.filter((p) => packState(p) === 'done'),
    notStarted: packs.filter((p) => packState(p) === 'notStarted'),
  }
}

/** Chinese first, then math. A subject with no packs is left out. */
export function groupPacksBySubject<T extends ReportPackLike>(packs: T[]): SubjectGroups<T>[] {
  const chinese = packs.filter((p) => p.subject !== 'math')
  const math = packs.filter((p) => p.subject === 'math')
  const out: SubjectGroups<T>[] = []
  if (chinese.length > 0) out.push({ subject: 'chinese', ...group(chinese) })
  if (math.length > 0) out.push({ subject: 'math', ...group(math) })
  return out
}
