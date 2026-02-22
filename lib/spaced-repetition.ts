import { WordProgress } from './types'

const DEFAULT_WORD_PROGRESS: WordProgress = {
  easiness: 2.5,
  interval: 1,
  repetitions: 0,
  nextReview: new Date().toISOString(),
}

export function getDefaultWordProgress(): WordProgress {
  return { ...DEFAULT_WORD_PROGRESS, nextReview: new Date().toISOString() }
}

export function isDueForReview(progress: WordProgress): boolean {
  return new Date(progress.nextReview) <= new Date()
}

/**
 * Update SM-2 parameters after an answer.
 * quality: 1 = wrong, 2 = correct but slow, 3 = correct and confident
 */
export function updateSM2(progress: WordProgress, quality: 1 | 2 | 3): WordProgress {
  const q = quality === 1 ? 0 : quality === 2 ? 3 : 5

  let { easiness, interval, repetitions } = progress

  if (q < 3) {
    // Wrong answer — reset
    interval = 1
    repetitions = 0
  } else {
    // Correct answer — advance
    if (repetitions === 0) {
      interval = 1
    } else if (repetitions === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * easiness)
    }
    repetitions += 1
  }

  // Update easiness factor (min 1.3)
  easiness = easiness + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  easiness = Math.max(1.3, easiness)

  const nextReview = new Date()
  nextReview.setDate(nextReview.getDate() + interval)

  return { easiness, interval, repetitions, nextReview: nextReview.toISOString() }
}

/**
 * Pick words for a practice session.
 * Priority order:
 *   1. priorityWordIds — recently wrong answers (from DB), always show these first
 *   2. Due for SM-2 review — overdue words
 *   3. Never seen — new words
 */
export function pickWordsForSession(
  allWords: string[],
  wordProgress: Record<string, WordProgress>,
  sessionSize = 8,
  priorityWordIds: string[] = []
): string[] {
  const prioritySet = new Set(priorityWordIds)

  const priority = allWords.filter((id) => prioritySet.has(id))
  const reviewDue = allWords.filter((id) => {
    if (prioritySet.has(id)) return false
    const prog = wordProgress[id]
    return prog ? isDueForReview(prog) : false
  })
  const neverSeen = allWords.filter((id) => {
    if (prioritySet.has(id)) return false
    return !wordProgress[id]
  })
  const notDue = allWords.filter((id) => {
    if (prioritySet.has(id)) return false
    const prog = wordProgress[id]
    return prog ? !isDueForReview(prog) : false
  })

  const shuffledReview = reviewDue.sort(() => Math.random() - 0.5)
  const shuffledNew = neverSeen.sort(() => Math.random() - 0.5)
  const shuffledNotDue = notDue.sort(() => Math.random() - 0.5)

  // Fill session: priority → review due → new → not due yet (pad to fill)
  const combined = [...priority, ...shuffledReview, ...shuffledNew, ...shuffledNotDue]
  return combined.slice(0, sessionSize)
}

/**
 * Mastery: a word counts as "practiced" once it has at least 1 correct answer.
 * The ring fills meaningfully after the first session.
 */
export function getMasteryPercent(
  wordIds: string[],
  wordProgress: Record<string, WordProgress>
): number {
  if (wordIds.length === 0) return 0
  const practiced = wordIds.filter((id) => {
    const prog = wordProgress[id]
    return prog && prog.repetitions >= 1
  })
  return Math.round((practiced.length / wordIds.length) * 100)
}
