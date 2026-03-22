import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Sentence, SentenceQuestion } from '@/lib/types'

interface SentenceFile {
  packId: string
  sentences: Sentence[]
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
 * Reads from data/sentences/[packId].json — no DB required.
 * Returns { sentences: [] } gracefully for packs without sentence data.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ packId: string }> }
) {
  const { packId } = await params

  // Guard against path traversal — pack IDs are only lowercase letters, numbers, and hyphens
  if (!/^[a-z0-9-]+$/.test(packId)) {
    return NextResponse.json({ sentences: [] })
  }

  try {
    const filePath = join(process.cwd(), 'data', 'sentences', `${packId}.json`)
    const raw = readFileSync(filePath, 'utf-8')
    const data: SentenceFile = JSON.parse(raw)

    const shuffledSentences = shuffle(data.sentences)
    const selected = shuffledSentences.slice(0, 2)

    const questions: SentenceQuestion[] = selected.map((sentence) => ({
      sentence,
      tiles: shuffle(sentence.chinese),
      type: 'tap_to_build',
    }))

    return NextResponse.json({ sentences: questions })
  } catch {
    // No sentence file for this pack — return empty gracefully
    return NextResponse.json({ sentences: [] })
  }
}
