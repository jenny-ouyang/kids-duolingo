/**
 * Seeds math Pack + MathProblem rows.
 * Replaces any existing math topics cleanly before inserting.
 *
 * Run with: npm run db:seed-math
 *
 * Four tiers of addition (1–100):
 *   1. Single digits   — all 81 combinations (1+1 to 9+9, sums 2–18)
 *   2. Multiples of 10 — all 45 combos (10+10 to 90+10, sums 20–100)
 *   3. Mixed easy      — two-digit + single digit, sums up to 50 (~70 problems)
 *   4. Mixed hard      — two-digit + two-digit, sums 51–100 (~70 problems)
 */

import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../lib/generated/prisma'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any)

const EMOJIS = ['🍎', '🌟', '🦋', '🐶', '🚂', '🌸', '🍪', '🐸', '🎈', '🐱', '⚽', '🎯', '🦄', '🍕', '🎸']
const emoji = (i: number) => EMOJIS[i % EMOJIS.length]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface ProblemDef {
  id: string
  operand1: number
  operator: string
  operand2: number
  answer: number
}

// ── Topic 1: Single digits — ALL 81 combinations ────────────────────────────
function buildSingleDigits(): ProblemDef[] {
  const problems: ProblemDef[] = []
  for (let a = 1; a <= 9; a++) {
    for (let b = 1; b <= 9; b++) {
      problems.push({ id: `${a}+${b}`, operand1: a, operator: '+', operand2: b, answer: a + b })
    }
  }
  return problems
}

// ── Topic 2: Multiples of 10 — 45 combinations ──────────────────────────────
function buildTensAddition(): ProblemDef[] {
  const problems: ProblemDef[] = []
  for (let a = 10; a <= 90; a += 10) {
    for (let b = 10; b <= 100 - a; b += 10) {
      problems.push({ id: `${a}+${b}`, operand1: a, operator: '+', operand2: b, answer: a + b })
    }
  }
  return problems
}

// ── Topic 3: Mixed easy — two-digit + single digit, sums up to 50 ───────────
// At least one operand is two-digit (10+), neither is a multiple of 10 alone.
// Generates all valid pairs then shuffles.
function buildMixedEasy(): ProblemDef[] {
  const problems: ProblemDef[] = []
  const seen = new Set<string>()

  // Two-digit (11–49) + single digit (1–9), sum ≤ 50
  for (let a = 11; a <= 49; a++) {
    for (let b = 1; b <= 9; b++) {
      if (a + b > 50) break
      const id = `${a}+${b}`
      if (!seen.has(id)) {
        seen.add(id)
        problems.push({ id, operand1: a, operator: '+', operand2: b, answer: a + b })
      }
    }
  }

  // Single digit (1–9) + two-digit (11–49), sum ≤ 50
  for (let a = 1; a <= 9; a++) {
    for (let b = 11; b <= 49; b++) {
      if (a + b > 50) break
      const id = `${a}+${b}`
      if (!seen.has(id)) {
        seen.add(id)
        problems.push({ id, operand1: a, operator: '+', operand2: b, answer: a + b })
      }
    }
  }

  // Teen + teen (11–24 + 11–24), sum ≤ 50 — important for this level
  for (let a = 11; a <= 24; a++) {
    for (let b = 11; b <= 50 - a; b++) {
      const id = `${a}+${b}`
      if (!seen.has(id)) {
        seen.add(id)
        problems.push({ id, operand1: a, operator: '+', operand2: b, answer: a + b })
      }
    }
  }

  return shuffle(problems)
}

// ── Topic 4: Mixed hard — two-digit + two-digit, sums 51–100 ────────────────
function buildMixedHard(): ProblemDef[] {
  const problems: ProblemDef[] = []
  const seen = new Set<string>()

  for (let a = 1; a <= 99; a++) {
    for (let b = Math.max(1, 51 - a); b <= 100 - a; b++) {
      // Must include at least one two-digit number to be interesting
      if (a <= 9 && b <= 9) continue
      const id = `${a}+${b}`
      if (!seen.has(id)) {
        seen.add(id)
        problems.push({ id, operand1: a, operator: '+', operand2: b, answer: a + b })
      }
    }
  }

  return shuffle(problems)
}

interface TopicDef {
  id: string
  name: string
  emoji: string
  color: string
  sortOrder: number
  problems: ProblemDef[]
}

const MATH_TOPICS: TopicDef[] = [
  {
    id: 'math_add_singles',
    name: 'Single Digits',
    emoji: '🔢',
    color: '#7c3aed',
    sortOrder: 10,
    problems: buildSingleDigits(),                  // 81 problems
  },
  {
    id: 'math_add_tens',
    name: 'Adding Tens',
    emoji: '🔟',
    color: '#0891b2',
    sortOrder: 11,
    problems: buildTensAddition(),                  // 45 problems
  },
  {
    id: 'math_add_mixed_easy',
    name: 'Up to 50',
    emoji: '➕',
    color: '#2563eb',
    sortOrder: 12,
    problems: buildMixedEasy(),                     // ~70 problems
  },
  {
    id: 'math_add_mixed_hard',
    name: 'Up to 100',
    emoji: '💯',
    color: '#dc2626',
    sortOrder: 13,
    problems: buildMixedHard(),                     // ~70 problems (sampled from large set)
  },
]

async function main() {
  console.log('Cleaning up old math data...')

  // Fetch all existing math pack IDs
  const existingMathPacks = await prisma.pack.findMany({
    where: { subject: 'math' },
    select: { id: true },
  })
  const existingIds = existingMathPacks.map((p) => p.id)

  if (existingIds.length > 0) {
    // Delete child records first (FK constraints)
    await prisma.mathProgress.deleteMany({ where: { packId: { in: existingIds } } })
    await prisma.answerEvent.deleteMany({ where: { packId: { in: existingIds } } })
    await prisma.mathProblem.deleteMany({ where: { packId: { in: existingIds } } })
    await prisma.pack.deleteMany({ where: { id: { in: existingIds } } })
    console.log(`  Removed ${existingIds.length} old math topic(s).`)
  }

  console.log('\nSeeding new math topics...')

  for (const topic of MATH_TOPICS) {
    await prisma.pack.create({
      data: {
        id: topic.id,
        subject: 'math',
        name: topic.name,
        emoji: topic.emoji,
        color: topic.color,
        sortOrder: topic.sortOrder,
      },
    })

    // Batch insert problems in chunks of 50 for performance
    const chunkSize = 50
    for (let i = 0; i < topic.problems.length; i += chunkSize) {
      const chunk = topic.problems.slice(i, i + chunkSize)
      await prisma.mathProblem.createMany({
        data: chunk.map((p, j) => ({
          id: p.id,
          packId: topic.id,
          operand1: p.operand1,
          operator: p.operator,
          operand2: p.operand2,
          answer: p.answer,
          emoji: emoji(i + j),
          sortOrder: i + j,
        })),
        skipDuplicates: true,
      })
    }

    console.log(`  ✓ ${topic.name} (${topic.problems.length} problems)`)
  }

  const total = MATH_TOPICS.reduce((s, t) => s + t.problems.length, 0)
  console.log(`\nMath seed complete. ${total} problems across ${MATH_TOPICS.length} topics.`)
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
