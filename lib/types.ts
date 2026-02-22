export interface Word {
  id: string
  english: string
  chinese: string
  pinyin: string
  image: string
}

export interface Pack {
  id: string
  name: string
  nameZh: string
  emoji: string
  color: string
  words: Word[]
}

export interface WordProgress {
  easiness: number
  interval: number
  repetitions: number
  nextReview: string
}

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
