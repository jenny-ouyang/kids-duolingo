import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { MathProblem, MathQuestion, BaseProgress } from '@/lib/types'
import { pickWordsForSession } from '@/lib/spaced-repetition'

const CHILD = 'julian'
const SESSION_SIZE = 8

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

/**
 * Generates 3 plausible wrong-answer numbers scaled to the answer's magnitude.
 * Tight offsets for small answers, wider spread for larger ones so choices
 * remain meaningfully different without being obviously wrong.
 */
function mathDistractors(answer: number): number[] {
  let offsets: number[]
  if (answer <= 10) {
    offsets = [-2, -1, 1, 2, 3]
  } else if (answer <= 20) {
    offsets = [-3, -2, 2, 3, 4]
  } else if (answer <= 50) {
    offsets = [-5, -3, 3, 5, 7]
  } else {
    offsets = [-10, -5, 5, 10, 15]
  }
  return shuffle(offsets.map((d) => answer + d).filter((n) => n > 0 && n !== answer)).slice(0, 3)
}

/**
 * GET /api/math/questions/[topicId]
 *
 * Two-phase fetch for performance with large problem pools (hundreds–thousands of rows):
 *   Phase 1 — lightweight: fetch only IDs + progress + recent wrong events
 *   Phase 2 — targeted: fetch full data for only the 8 selected problems
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { topicId: string } }
) {
  const { topicId } = params

  try {
    // Phase 1: IDs only (avoids loading thousands of full rows)
    const [pack, progressRows, recentWrong] = await Promise.all([
      prisma.pack.findUnique({
        where: { id: topicId },
        select: {
          id: true,
          subject: true,
          problems: { select: { id: true }, orderBy: { sortOrder: 'asc' } },
        },
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

    // SM-2 selection — picks SESSION_SIZE IDs from the full pool
    const allProblemIds = pack.problems.map((p) => p.id)
    const selectedIds = pickWordsForSession(allProblemIds, progressMap, SESSION_SIZE, priorityIds)

    // Phase 2: fetch full data only for the selected subset
    const selectedProblems = await prisma.mathProblem.findMany({
      where: { id: { in: selectedIds } },
    })

    const problemMap: Record<string, MathProblem> = {}
    for (const p of selectedProblems) {
      problemMap[p.id] = {
        id: p.id,
        operand1: p.operand1,
        operator: p.operator as MathProblem['operator'],
        operand2: p.operand2,
        answer: p.answer,
        emoji: p.emoji,
      }
    }

    // Build questions in the SM-2-selected order, with 4 shuffled answer choices
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
