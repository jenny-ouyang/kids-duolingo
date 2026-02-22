import { Word, ExerciseQuestion, QuestionType } from './types'

const QUESTION_TYPES: QuestionType[] = [
  'audio_to_picture',
  'audio_to_picture',   // weighted 2x — best for pronunciation
  'picture_to_chinese',
  'english_to_chinese',
]

function pickType(): QuestionType {
  return QUESTION_TYPES[Math.floor(Math.random() * QUESTION_TYPES.length)]
}

/** Instant fallback — picks 3 random distractors with no API call */
export function generateQuestionFast(targetWord: Word, allWords: Word[]): ExerciseQuestion {
  const type = pickType()
  const otherWords = allWords.filter((w) => w.id !== targetWord.id)
  const distractors = shuffle(otherWords).slice(0, 3)
  const options = shuffle([targetWord, ...distractors])
  return { word: targetWord, options, correctId: targetWord.id, type }
}

/**
 * Calls Ollama via /api/generate-options for smarter distractors.
 * Accepts an AbortSignal so the caller can cancel when navigating away.
 * Falls back to fast generation if the API fails, times out, or is aborted.
 */
export async function generateQuestion(
  targetWord: Word,
  allWords: Word[],
  signal?: AbortSignal
): Promise<ExerciseQuestion> {
  const type = pickType()
  const otherWords = allWords.filter((w) => w.id !== targetWord.id)

  try {
    const res = await fetch('/api/generate-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: targetWord, packWords: otherWords }),
      signal,
    })

    if (res.ok) {
      const data = await res.json()
      const distractors: Word[] = data.options ?? []
      if (distractors.length === 3) {
        const options = shuffle([targetWord, ...distractors])
        return { word: targetWord, options, correctId: targetWord.id, type }
      }
    }
  } catch {
    // Aborted or failed — fall through to fast fallback
  }

  return generateQuestionFast(targetWord, allWords)
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
