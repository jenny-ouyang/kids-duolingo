/**
 * Seed script: reads the existing JSON pack files and upserts them into PostgreSQL.
 * Safe to re-run — uses upsert so it won't duplicate data.
 *
 * Run with: npm run db:seed
 */

import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../lib/generated/prisma'
import * as fs from 'fs'
import * as path from 'path'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any)

interface WordData {
  id: string
  english: string
  chinese: string
  pinyin: string
  image: string
}

interface PackData {
  id: string
  name: string
  nameZh: string
  emoji: string
  color: string
  words: WordData[]
}

// Canonical sort order for packs
const PACK_ORDER = ['animals', 'colors', 'numbers', 'food', 'family', 'greetings']

async function main() {
  const dataDir = path.join(__dirname, '..', 'data', 'packs')
  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json'))

  const packs: PackData[] = files.map((f) => {
    const raw = fs.readFileSync(path.join(dataDir, f), 'utf-8')
    return JSON.parse(raw) as PackData
  })

  // Sort packs by canonical order
  packs.sort((a, b) => {
    const ai = PACK_ORDER.indexOf(a.id)
    const bi = PACK_ORDER.indexOf(b.id)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  console.log(`Seeding ${packs.length} packs...`)

  for (let pi = 0; pi < packs.length; pi++) {
    const pack = packs[pi]

    await prisma.pack.upsert({
      where: { id: pack.id },
      create: {
        id: pack.id,
        name: pack.name,
        nameZh: pack.nameZh,
        emoji: pack.emoji,
        color: pack.color,
        sortOrder: pi,
      },
      update: {
        name: pack.name,
        nameZh: pack.nameZh,
        emoji: pack.emoji,
        color: pack.color,
        sortOrder: pi,
      },
    })

    for (let wi = 0; wi < pack.words.length; wi++) {
      const word = pack.words[wi]
      await prisma.word.upsert({
        where: { id: word.id },
        create: {
          id: word.id,
          packId: pack.id,
          english: word.english,
          chinese: word.chinese,
          pinyin: word.pinyin,
          image: word.image,
          sortOrder: wi,
        },
        update: {
          packId: pack.id,
          english: word.english,
          chinese: word.chinese,
          pinyin: word.pinyin,
          image: word.image,
          sortOrder: wi,
        },
      })
    }

    console.log(`  ✓ ${pack.name} (${pack.words.length} words)`)
  }

  console.log('Seed complete.')
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
