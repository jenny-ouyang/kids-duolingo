// End-to-end check of the pack gate (spec 2026-10-13 §3, §7).
// Run:  PAYMENTS_ENABLED=true npm run dev   (in another terminal)
//       node scripts/e2e-gate.mjs
// Creates a throwaway guest via the same anonymous sign-in the app uses,
// drives the API with the native Bearer transport, flips the plan in the DB,
// and deletes the guest (Account + auth.users) at the end — even on failure.
import pg from 'pg'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8') + '\n' + (fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '')
const get = (k) => (env.match(new RegExp('^' + k + '="?([^"\\n]+)"?', 'm')) || [])[1]
const SB = get('NEXT_PUBLIC_SUPABASE_URL'), KEY = get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const DB = get('DIRECT_URL') || get('DATABASE_URL')
const API = process.env.API_BASE || 'http://localhost:3000'

let failures = 0
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)
  if (!ok) failures++
}

const signup = await fetch(`${SB}/auth/v1/signup`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: '{}' })
const session = await signup.json()
if (!session.access_token) throw new Error('anonymous sign-in failed: ' + JSON.stringify(session))
const uid = session.user.id
const H = { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
const db = new pg.Client({ connectionString: DB })
await db.connect()

try {
  const child = await (await fetch(`${API}/api/children`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'GateTest', avatar: '🐼' }) })).json()
  const HC = { ...H, 'x-child-id': child.id }
  const j = async (path, init = {}) => { const r = await fetch(API + path, { headers: HC, ...init }); return { status: r.status, body: await r.json().catch(() => null) } }

  // --- free account, payments on ---
  let acct = await j('/api/account')
  check('account: paymentsEnabled true, plan free, guest', acct.body?.paymentsEnabled === true && acct.body?.plan === 'free' && acct.body?.isGuest === true, JSON.stringify(acct.body))
  check('account: 4 free packs counted', acct.body?.freePackCount === 4, `got ${acct.body?.freePackCount}/${acct.body?.totalPackCount}`)

  let packs = await j('/api/packs')
  check('packs: array shape kept', Array.isArray(packs.body))
  const byId = Object.fromEntries((packs.body || []).map((p) => [p.id, p]))
  check('packs: animals unlocked', byId.animals?.locked === false)
  check('packs: food locked', byId.food?.locked === true)
  check('packs: sentences mode unlocked', byId.sentences?.locked === false)
  const math = await j('/api/packs?subject=math')
  const m = Object.fromEntries((math.body || []).map((p) => [p.id, p]))
  check('math: math_add_singles unlocked', m.math_add_singles?.locked === false)
  check('math: math_add_tens locked', m.math_add_tens?.locked === true)

  check('questions/animals → 200', (await j('/api/questions/animals')).status === 200)
  const lockedQ = await j('/api/questions/food')
  check('questions/food → 402 locked', lockedQ.status === 402 && lockedQ.body?.error === 'locked' && lockedQ.body?.packId === 'food', JSON.stringify(lockedQ.body))
  check('math/questions/math_add_singles → 200', (await j('/api/math/questions/math_add_singles')).status === 200)
  check('math/questions/math_add_tens → 402', (await j('/api/math/questions/math_add_tens')).status === 402)
  check('sentences/animals → 200', (await j('/api/sentences/animals')).status === 200)
  check('sentences/s1-this-is → 402', (await j('/api/sentences/s1-this-is')).status === 402)
  const all = await j('/api/sentences/all')
  const ids = (all.body?.sentences || []).map((q) => q.sentence?.id || '')
  check('sentences/all: only animals sentences for a free account', all.status === 200 && ids.length > 0 && ids.every((id) => id.startsWith('animals_')), ids.slice(0, 3).join(','))

  const prog = { wordId: 'x', easiness: 2.5, interval: 1, repetitions: 1, nextReview: new Date().toISOString() }
  check('progress POST food → 402', (await j('/api/progress', { method: 'POST', body: JSON.stringify({ packId: 'food', ...prog }) })).status === 402)
  check('answers POST food → 402', (await j('/api/answers', { method: 'POST', body: JSON.stringify({ packId: 'food', wordId: 'x', correct: true }) })).status === 402)
  check('answers POST animals → 200', (await j('/api/answers', { method: 'POST', body: JSON.stringify({ packId: 'animals', wordId: 'x', correct: true }) })).status === 200)

  check('stripe checkout as guest → 403 claim-first or 404 dormant', [403, 404].includes((await j('/api/stripe/checkout', { method: 'POST' })).status))

  // --- flip to lifetime in the DB (what the Stripe/Apple handlers will do in Phases B/C) ---
  await db.query(`update "Account" set plan='lifetime', "planSource"='manual', "planGrantedAt"=now() where id=$1`, [uid])
  acct = await j('/api/account')
  check('account: lifetime true after flip', acct.body?.lifetime === true)
  packs = await j('/api/packs')
  check('packs: nothing locked for lifetime', Array.isArray(packs.body) && packs.body.every((p) => p.locked === false))
  check('questions/food → 200 for lifetime', (await j('/api/questions/food')).status === 200)
  check('sentences/s1-this-is → 200 for lifetime', (await j('/api/sentences/s1-this-is')).status === 200)

  // --- the cleanup guard: a paid guest must not be selected ---
  await db.query(`update "Account" set "createdAt" = now() - interval '400 days' where id=$1`, [uid])
  const stale = await db.query(`select count(*)::int as n from "Account" where id=$1 and "isGuest"=true and plan='free' and "createdAt" < now() - interval '90 days'`, [uid])
  check('cleanup filter would skip the paid guest', stale.rows[0].n === 0)
} finally {
  await db.query('delete from "Account" where id=$1', [uid])
  await db.query('delete from auth.users where id=$1::uuid and is_anonymous = true', [uid])
  await db.end()
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
