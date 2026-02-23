/**
 * Seeds math Pack + MathProblem rows into the database.
 * Safe to re-run — uses upsert.
 *
 * Run with:
 *   npx ts-node --skip-project --compiler-options '{"module":"commonjs"}' prisma/seed-math.ts
 */

import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../lib/generated/prisma'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any)

// Emoji pool — cycles through for visual variety across problems
const EMOJIS = ['🍎', '🌟', '🦋', '🐶', '🚂', '🌸', '🍪', '🐸', '🎈', '🐱']
function emoji(i: number) { return EMOJIS[i % EMOJIS.length] }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface TopicDef {
  id: string
  name: string
  emoji: string
  color: string
  sortOrder: number
  problems: Array<{
    id: string
    operand1: number
    operator: string
    operand2: number
    answer: number
    emoji: string
    sortOrder: number
  }>
}

// ── Topic: Counting 1–5 ────────────────────────────────────────────────────
const countingProblems = [1, 2, 3, 4, 5].map((n, i) => ({
  id: `count_${n}`,
  operand1: n,
  operator: 'count',
  operand2: 0,
  answer: n,
  emoji: emoji(i),
  sortOrder: i,
}))

// ── Topic: Adding to 5 (sum ≤ 5, both operands ≥ 1) ──────────────────────
const add5Problems: TopicDef['problems'] = []
let si = 0
for (let a = 1; a <= 4; a++) {
  for (let b = 1; b <= 5 - a; b++) {
    add5Problems.push({
      id: `${a}+${b}`,
      operand1: a,
      operator: '+',
      operand2: b,
      answer: a + b,
      emoji: emoji(si++),
      sortOrder: si - 1,
    })
  }
}

// ── Topic: Adding to 10 (sum 6–10, both operands 1–5) ────────────────────
const add10Problems: TopicDef['problems'] = []
let ai = 0
for (let sum = 6; sum <= 10; sum++) {
  for (let a = 1; a <= 5; a++) {
    const b = sum - a
    if (b >= 1 && b <= 5) {
      add10Problems.push({
        id: `${a}+${b}`,
        operand1: a,
        operator: '+',
        operand2: b,
        answer: sum,
        emoji: emoji(ai++),
        sortOrder: ai - 1,
      })
    }
  }
}

const MATH_TOPICS: TopicDef[] = [
  {
    id: 'math_counting',
    name: 'Counting 1–5',
    emoji: '🔢',
    color: '#7c3aed',
    sortOrder: 10,
    problems: countingProblems,
  },
  {
    id: 'math_add_5',
    name: 'Adding to 5',
    emoji: '➕',
    color: '#2563eb',
    sortOrder: 11,
    problems: add5Problems,
  },
  {
    id: 'math_add_10',
    name: 'Adding to 10',
    emoji: '🔟',
    color: '#0891b2',
    sortOrder: 12,
    problems: shuffle(add10Problems).map((p, i) => ({ ...p, sortOrder: i })),
  },
]

async function main() {
  console.log('Seeding math topics...')

  for (const topic of MATH_TOPICS) {
    await prisma.pack.upsert({
      where: { id: topic.id },
      create: {
        id: topic.id,
        subject: 'math',
        name: topic.name,
        emoji: topic.emoji,
        color: topic.color,
        sortOrder: topic.sortOrder,
      },
      update: {
        subject: 'math',
        name: topic.name,
        emoji: topic.emoji,
        color: topic.color,
        sortOrder: topic.sortOrder,
      },
    })

    for (const p of topic.problems) {
      await prisma.mathProblem.upsert({
        where: { id: p.id },
        create: {
          id: p.id,
          packId: topic.id,
          operand1: p.operand1,
          operator: p.operator,
          operand2: p.operand2,
          answer: p.answer,
          emoji: p.emoji,
          sortOrder: p.sortOrder,
        },
        update: {
          packId: topic.id,
          operand1: p.operand1,
          operator: p.operator,
          operand2: p.operand2,
          answer: p.answer,
          emoji: p.emoji,
          sortOrder: p.sortOrder,
        },
      })
    }

    console.log(`  ✓ ${topic.name} (${topic.problems.length} problems)`)
  }

  console.log('Math seed complete.')
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
