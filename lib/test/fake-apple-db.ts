/**
 * In-memory stand-in for the Prisma calls the Apple routes make (Account,
 * AppleFamilyGrant, AppleRevocation). Test-only: lets the tests assert the
 * resulting rows instead of call shapes. Supports equality, { in }, { not }
 * and OR in `where`, which is all the routes use.
 */
type Row = Record<string, unknown>

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([k, cond]) => {
    if (k === 'OR') return (cond as Row[]).some((w) => matches(row, w))
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      const c = cond as { in?: unknown[]; not?: unknown }
      if ('in' in c) return (c.in as unknown[]).includes(row[k])
      if ('not' in c) return row[k] !== c.not
    }
    return row[k] === cond
  })
}

function table(rows: Row[], key: string) {
  return {
    rows,
    findUnique: async ({ where }: { where: Row }) => rows.find((r) => matches(r, where)) ?? null,
    findFirst: async ({ where }: { where: Row }) => rows.find((r) => matches(r, where)) ?? null,
    findMany: async ({ where }: { where?: Row } = {}) => rows.filter((r) => matches(r, where)),
    count: async ({ where }: { where?: Row } = {}) => rows.filter((r) => matches(r, where)).length,
    create: async ({ data }: { data: Row }) => {
      if (rows.some((r) => r[key] === data[key])) throw new Error(`unique ${key}`)
      rows.push({ ...data })
      return data
    },
    update: async ({ where, data }: { where: Row; data: Row }) => {
      const r = rows.find((x) => matches(x, where))
      if (!r) throw new Error('not found')
      Object.assign(r, data)
      return r
    },
    updateMany: async ({ where, data }: { where: Row; data: Row }) => {
      const hit = rows.filter((r) => matches(r, where))
      hit.forEach((r) => Object.assign(r, data))
      return { count: hit.length }
    },
    deleteMany: async ({ where }: { where: Row }) => {
      const before = rows.length
      for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i], where)) rows.splice(i, 1)
      return { count: before - rows.length }
    },
    upsert: async ({ where, create, update }: { where: Row; create: Row; update: Row }) => {
      const r = rows.find((x) => matches(x, where))
      if (r) return Object.assign(r, update)
      rows.push({ ...create })
      return create
    },
  }
}

export function makeFakeAppleDb() {
  /** Order of operations: 'lock:<id>', 'tx:begin', 'tx:end', 'revocation:check', 'revocation:write' */
  const log: string[] = []
  const accounts: Row[] = []
  const grants: Row[] = []
  const revocations: Row[] = []
  const account = table(accounts, 'id')
  const appleFamilyGrant = table(grants, 'transactionId')
  const db = {
    account: {
      ...account,
      // dropAppleIfNoBasis reads _count.appleFamilyGrants
      findUnique: async ({ where }: { where: Row }) => {
        const r = accounts.find((x) => matches(x, where))
        if (!r) return null
        return { ...r, _count: { appleFamilyGrants: grants.filter((g) => g.accountId === r.id).length } }
      },
    },
    appleFamilyGrant,
    appleRevocation: (() => {
      const t = table(revocations, 'key')
      return {
        ...t,
        findFirst: async (args: { where: Row }) => (log.push('revocation:check'), t.findFirst(args)),
        upsert: async (args: { where: Row; create: Row; update: Row }) => (log.push('revocation:write'), t.upsert(args)),
      }
    })(),
    // Tagged template call: lockPurchase -> pg_advisory_xact_lock(hashtext(id))
    $executeRaw: async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      log.push(`lock:${values[0]}`)
      return 1
    },
  }
  return {
    accounts,
    grants,
    revocations,
    log,
    prisma: {
      ...db,
      $transaction: async (fn: (d: typeof db) => Promise<unknown>) => {
        log.push('tx:begin')
        try {
          return await fn(db)
        } finally {
          log.push('tx:end')
        }
      },
    },
    addAccount(row: Row) {
      const full = { plan: 'free', planSource: null, appleOriginalTransactionId: null, appleEnvironment: null, isFounder: false, ...row }
      accounts.push(full)
      return full
    },
    get(id: string) {
      return accounts.find((a) => a.id === id)!
    },
    reset() {
      accounts.length = 0
      grants.length = 0
      revocations.length = 0
      log.length = 0
    },
  }
}
