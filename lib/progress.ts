import { ChildProgress, PackProgress, WordProgress } from './types'
import { getDefaultWordProgress } from './spaced-repetition'

const STORAGE_KEY = 'julian-progress'
const PROGRESS_VERSION = 2  // bump when defaults change to force a migration

export function loadProgress(): ChildProgress {
  if (typeof window === 'undefined') {
    return createDefaultProgress()
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createDefaultProgress()
    const saved = JSON.parse(raw) as ChildProgress & { _version?: number }

    // Migrate: unlock all packs if saved on an older version
    if (!saved._version || saved._version < PROGRESS_VERSION) {
      const defaults = createDefaultProgress()
      // Preserve word progress but update unlock states to new defaults
      for (const packId of Object.keys(defaults.packs)) {
        if (!saved.packs[packId]) {
          saved.packs[packId] = defaults.packs[packId]
        } else {
          saved.packs[packId].unlocked = true
        }
      }
      saved._version = PROGRESS_VERSION
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
    }

    return saved
  } catch {
    return createDefaultProgress()
  }
}

export function saveProgress(progress: ChildProgress): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
}

function createDefaultProgress(): ChildProgress {
  return {
    childName: 'Julian',
    packs: {
      animals:   { unlocked: true, words: {} },
      colors:    { unlocked: true, words: {} },
      numbers:   { unlocked: true, words: {} },
      food:      { unlocked: true, words: {} },
      family:    { unlocked: true, words: {} },
      greetings: { unlocked: true, words: {} },
    },
  }
}

export function getPackProgress(packId: string): PackProgress {
  const progress = loadProgress()
  return progress.packs[packId] ?? { unlocked: true, words: {} }
}

export function getWordProgress(packId: string, wordId: string): WordProgress {
  const packProgress = getPackProgress(packId)
  return packProgress.words[wordId] ?? getDefaultWordProgress()
}

export function saveWordProgress(
  packId: string,
  wordId: string,
  wordProgress: WordProgress
): void {
  const progress = loadProgress()
  if (!progress.packs[packId]) {
    progress.packs[packId] = { unlocked: false, words: {} }
  }
  progress.packs[packId].words[wordId] = wordProgress
  saveProgress(progress)
}

export function unlockPack(packId: string): void {
  const progress = loadProgress()
  if (!progress.packs[packId]) {
    progress.packs[packId] = { unlocked: true, words: {} }
  } else {
    progress.packs[packId].unlocked = true
  }
  saveProgress(progress)
}
