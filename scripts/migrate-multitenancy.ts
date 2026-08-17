/**
 * One-shot, idempotent multi-tenancy migration: expand → backfill julian → contract.
 *
 * Run: npm run db:migrate-multitenancy
 *
 * Required env (in .env):
 *   DATABASE_URL          — Postgres connection (session-mode pooler recommended for DDL)
 *   JENNY_USER_ID         — Supabase auth.users.id that will own the migrated Julian data
 *                           (sign in once on the deployed app / Supabase dashboard → Auth → Users)
 *   JENNY_EMAIL           — email for the Account row (e.g. bingjie.j.ouyang@gmail.com)
 *
 * Safe to re-run: every step checks before it writes. The contract step's SQL contains
 * a hard guard that aborts if any row still has NULL childId.
 */
import 'dotenv/config'
import { readFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { execSync } from 'child_process'
import { Pool } from 'pg'

const EXPAND = '20260817000001_multitenancy_expand'
const CONTRACT = '20260817000002_multitenancy_contract'

async function main() {
  const { JENNY_USER_ID, JENNY_EMAIL, DATABASE_URL } = process.env
  if (!DATABASE_URL) throw new Error('DATABASE_URL missing')
  if (!JENNY_USER_ID || !JENNY_EMAIL) {
    throw new Error(
      'JENNY_USER_ID and JENNY_EMAIL are required.\n' +
      'Create/sign in the parent account first (Supabase dashboard → Authentication → Users),\n' +
      'then put its UUID in .env as JENNY_USER_ID.'
    )
  }

  const pool = new Pool({ connectionString: DATABASE_URL })
  const sql = (name: string) =>
    readFileSync(join(__dirname, '..', 'prisma', 'migrations', name, 'migration.sql'), 'utf8')

  // ---- Step 1: expand (additive, idempotent) ----
  console.log('→ expand…')
  await pool.query(sql(EXPAND))

  // ---- Step 2: backfill ----
  console.log('→ backfill…')
  await pool.query(
    `INSERT INTO "Account" ("id", "email", "isGuest", "plan", "updatedAt")
     VALUES ($1, $2, false, 'free', now())
     ON CONFLICT ("id") DO UPDATE SET "email" = EXCLUDED."email", "isGuest" = false, "updatedAt" = now()`,
    [JENNY_USER_ID, JENNY_EMAIL]
  )

  const existing = await pool.query(
    `SELECT "id" FROM "Child" WHERE "accountId" = $1 AND lower("name") = 'julian'`,
    [JENNY_USER_ID]
  )
  let childId: string
  if (existing.rows.length > 0) {
    childId = existing.rows[0].id
  } else {
    childId = randomUUID()
    // Copy hearts/streak from the legacy ChildProfile row (if it still exists)
    await pool.query(
      `INSERT INTO "Child" ("id", "accountId", "name", "avatar", "totalHearts", "streak", "lastPracticed", "updatedAt")
       SELECT $1, $2, 'Julian', '🦁',
              COALESCE(cp."totalHearts", 0), COALESCE(cp."streak", 0), cp."lastPracticed", now()
       FROM (SELECT 1) one
       LEFT JOIN "ChildProfile" cp ON cp."name" = 'julian'`,
      [childId, JENNY_USER_ID]
    )
  }
  console.log(`  child Julian = ${childId}`)

  for (const table of ['WordProgress', 'SentenceProgress', 'MathProgress', 'AnswerEvent']) {
    const r = await pool.query(
      `UPDATE "${table}" SET "childId" = $1 WHERE "childName" = 'julian' AND "childId" IS NULL`,
      [childId]
    )
    console.log(`  ${table}: ${r.rowCount} rows mapped`)
  }

  const nulls = await pool.query(
    `SELECT
       (SELECT count(*) FROM "WordProgress" WHERE "childId" IS NULL) +
       (SELECT count(*) FROM "SentenceProgress" WHERE "childId" IS NULL) +
       (SELECT count(*) FROM "MathProgress" WHERE "childId" IS NULL) +
       (SELECT count(*) FROM "AnswerEvent" WHERE "childId" IS NULL) AS n`
  )
  if (Number(nulls.rows[0].n) !== 0) throw new Error(`${nulls.rows[0].n} rows still unmapped — aborting before contract`)

  // ---- Step 3: contract (guarded in SQL as well) ----
  console.log('→ contract…')
  await pool.query(sql(CONTRACT))

  await pool.end()

  // ---- Step 4: record both migrations as applied so prisma migrate stays consistent ----
  console.log('→ marking migrations applied…')
  for (const name of [EXPAND, CONTRACT]) {
    execSync(`npx prisma migrate resolve --applied ${name}`, { stdio: 'inherit' })
  }

  console.log('✓ multi-tenancy migration complete')
}

main().catch((e) => {
  console.error('MIGRATION FAILED:', e.message)
  process.exit(1)
})
