import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, authErrorResponse } from '@/lib/auth'
import { Sentence, SentenceQuestion } from '@/lib/types'

// Static imports — bundled by webpack at build time, works on Vercel serverless
import animalsData from '@/data/sentences/animals.json'
import foodData from '@/data/sentences/food.json'
import familyData from '@/data/sentences/family.json'
import feelingsData from '@/data/sentences/feelings.json'
import homeData from '@/data/sentences/home.json'
import s1Data from '@/data/sentences/s1-this-is.json'
import s2Data from '@/data/sentences/s2-colors-counts.json'

interface SentenceFile {
  packId: string
  sentences: Sentence[]
}

const SENTENCE_PACKS: Record<string, SentenceFile> = {
  animals: animalsData as SentenceFile,
  food: foodData as SentenceFile,
  family: familyData as SentenceFile,
  feelings: feelingsData as SentenceFile,
  home: homeData as SentenceFile,
  's1-this-is': s1Data as SentenceFile,
  's2-colors-counts': s2Data as SentenceFile,
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * GET /api/sentences/[packId]
 * Returns up to 2 shuffled sentence questions for the given pack.
 * Returns { sentences: [] } gracefully for packs without sentence data.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ packId: string }> }
) {
  const { packId } = await params

  try {
    await getAuthContext()
  } catch (err) {
    const authErr = authErrorResponse(err)
    if (authErr) return authErr
    throw err
  }


  const data = SENTENCE_PACKS[packId]
  if (!data) {
    return NextResponse.json({ sentences: [] })
  }

  const shuffledSentences = shuffle(data.sentences)
  const selected = shuffledSentences.slice(0, 2)

  const questions: SentenceQuestion[] = selected.map((sentence) => ({
    sentence,
    tiles: shuffle(sentence.chinese),
    type: 'tap_to_build',
  }))

  return NextResponse.json({ sentences: questions })
}
