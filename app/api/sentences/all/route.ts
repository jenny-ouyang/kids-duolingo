import { NextResponse } from 'next/server'
import { getAuthContext, authErrorResponse } from '@/lib/auth'
import { Sentence, SentenceQuestion } from '@/lib/types'
import animalsData from '@/data/sentences/animals.json'
import foodData from '@/data/sentences/food.json'
import familyData from '@/data/sentences/family.json'
import feelingsData from '@/data/sentences/feelings.json'
import homeData from '@/data/sentences/home.json'
import s1Data from '@/data/sentences/s1-this-is.json'
import s2Data from '@/data/sentences/s2-colors-counts.json'

const ALL_SENTENCES: Sentence[] = [
  ...(animalsData.sentences as Sentence[]),
  ...(foodData.sentences as Sentence[]),
  ...(familyData.sentences as Sentence[]),
  ...(feelingsData.sentences as Sentence[]),
  ...(homeData.sentences as Sentence[]),
  ...(s1Data.sentences as Sentence[]),
  ...(s2Data.sentences as Sentence[]),
]

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * GET /api/sentences/all
 * Returns a full session of 8 sentence questions drawn from all packs.
 */
export async function GET() {
  try {
    await getAuthContext()
  } catch (err) {
    const authErr = authErrorResponse(err)
    if (authErr) return authErr
    throw err
  }

  const shuffled = shuffle(ALL_SENTENCES)
  const selected = shuffled.slice(0, 8)

  const questions: SentenceQuestion[] = selected.map((sentence) => ({
    sentence,
    tiles: shuffle([...sentence.chinese]),
    type: 'tap_to_build',
  }))

  return NextResponse.json({ sentences: questions })
}
