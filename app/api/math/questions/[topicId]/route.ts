import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { MathProblem, MathQuestion, BaseProgress } from '@/lib/types'
import { pickWordsForSession } from '@/lib/spaced-repetition'

const CHILD = 'julian'
const SESSION_SIZE = 8

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

/** Generates 3 nearby wrong-answer numbers, avoiding negatives and zero */
function mathDistractors(answer: number): number[] {
  const candidates = [-2, -1, 1, 2]
    .map((d) => answer + d)
    .filter((n) => n > 0 && n !== answer)
  return shuffle(candidates).slice(0, 3)
}

/**
 * GET /api/math/questions/[topicId]
 *
 * Dynamically generates a math practice session:
 * - Loads MathProblem rows for this topic
 * - Applies SM-2 selection (same algorithm as Chinese)
 * - Builds MathQuestion objects with 4 answer choices
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { topicId: string } }
) {
  const { topicId } = params

  try {
    const [pack, progressRows, recentWrong] = await Promise.all([
      prisma.pack.findUnique({
        where: { id: topicId },
        include: { problems: { orderBy: { sortOrder: 'asc' } } },
      }),
      prisma.mathProgress.findMany({
        where: { childName: CHILD, packId: topicId },
        select: { problemId: true, easiness: true, interval: true, repetitions: true, nextReview: true },
      }),
      prisma.answerEvent.findMany({
        where: { childName: CHILD, packId: topicId, correct: false },
        orderBy: { answeredAt: 'desc' },
        take: 30,
        select: { itemId: true },
      }),
    ])

    if (!pack || pack.subject !== 'math') {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    }

    // Build progress map keyed by problemId
    const progressMap: Record<string, BaseProgress> = {}
    for (const p of progressRows) {
      progressMap[p.problemId] = {
        easiness: p.easiness,
        interval: p.interval,
        repetitions: p.repetitions,
        nextReview: p.nextReview.toISOString(),
      }
    }

    // Priority: recently wrong items (deduplicated, order preserved)
    const seenIds = new Set<string>()
    const priorityIds: string[] = []
    for (const e of recentWrong) {
      if (!seenIds.has(e.itemId)) {
        seenIds.add(e.itemId)
        priorityIds.push(e.itemId)
      }
    }

    // SM-2 selection — same function used for Chinese
    const allProblemIds = pack.problems.map((p) => p.id)
    const selectedIds = pickWordsForSession(allProblemIds, progressMap, SESSION_SIZE, priorityIds)

    // Build lookup map
    const problemMap: Record<string, MathProblem> = {}
    for (const p of pack.problems) {
      problemMap[p.id] = {
        id: p.id,
        operand1: p.operand1,
        operator: p.operator as MathProblem['operator'],
        operand2: p.operand2,
        answer: p.answer,
        emoji: p.emoji,
      }
    }

    // Build questions with 4 answer choices
    const questions: MathQuestion[] = selectedIds.flatMap((id) => {
      const problem = problemMap[id]
      if (!problem) return []
      const distractors = mathDistractors(problem.answer)
      const options = shuffle([problem.answer, ...distractors])
      return [{ problem, options, correctAnswer: problem.answer }]
    })

    return NextResponse.json({ questions, progress: progressMap })
  } catch (err) {
    console.error('[math/questions GET]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
