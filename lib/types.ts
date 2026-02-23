export interface Word {
  id: string
  english: string
  chinese: string
  pinyin: string
  image: string
}

/** Shared SM-2 fields — updateSM2() is subject-agnostic and works on this */
export interface BaseProgress {
  easiness: number
  interval: number
  repetitions: number
  nextReview: string
}

export interface MathProblem {
  id: string
  operand1: number
  operator: '+' | '-' | 'count'
  operand2: number
  answer: number
  emoji: string
}

export interface MathQuestion {
  problem: MathProblem
  options: number[]
  correctAnswer: number
}

export interface Pack {
  id: string
  name: string
  nameZh: string
  emoji: string
  color: string
  words: Word[]
}

/** Alias kept for backward compatibility with Chinese practice routes */
export type WordProgress = BaseProgress

export interface PackProgress {
  unlocked: boolean
  words: Record<string, WordProgress>
}

export interface ChildProgress {
  childName: string
  packs: Record<string, PackProgress>
}

/** How the question is presented to the child */
export type QuestionType =
  | 'audio_to_picture'    // Hear Chinese → tap the right picture
  | 'picture_to_chinese'  // See a picture → tap the right Chinese character
  | 'english_to_chinese'  // See English word → tap the right Chinese character

export interface ExerciseQuestion {
  word: Word
  options: Word[]
  correctId: string
  type: QuestionType
}
