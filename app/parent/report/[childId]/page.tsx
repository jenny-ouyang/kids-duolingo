'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { fetchJsonWithAuthRetry } from '@/lib/api-fetch'

/* Calm variant of Sunrise Playground: same palette, warm ink, press physics —
   no mascot, no hills, no sparkles (per DESIGN.md, parent zone rule). */

const GATE_KEY = 'kd_parent_gate' // same session gate the parent zone sets

interface ReportChild {
  id: string
  name: string
  avatar: string
  totalHearts: number
  streak: number
  lastPracticed: string | null
}

interface ReportPack {
  packId: string
  name: string
  nameZh: string | null
  emoji: string
  subject: string
  totalWords: number
  started: number
  mastered: number
}

interface WobblyWord {
  wordId: string
  english: string
  chinese: string
  pinyin: string
  packName: string
}

interface Report {
  child: ReportChild
  packs: ReportPack[]
  wobbly: WobblyWord[]
  totals: {
    wordsStarted: number
    wordsMastered: number
    answers7d: number
    correct7d: number
  }
}

function formatLastPracticed(iso: string | null): string {
  if (!iso) return 'Never practiced'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'Practiced today'
  if (days === 1) return 'Practiced yesterday'
  return `Practiced ${days} days ago`
}

function weekProse(answers7d: number, correct7d: number): string {
  if (answers7d === 0) {
    return 'No practice this week yet — a great excuse for a quick session together!'
  }
  const pct = Math.round((correct7d / answers7d) * 100)
  const questions = answers7d === 1 ? 'question' : 'questions'
  return `${answers7d} ${questions} this week, ${pct}% right on the first try.`
}

function PackRow({ pack }: { pack: ReportPack }) {
  const fillPct =
    pack.totalWords > 0 ? Math.round((pack.mastered / pack.totalWords) * 100) : 0
  const unit = pack.subject === 'math' ? 'problems' : 'words'
  return (
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-2xl bg-[#FFF3D6] rotate-[-4deg] flex items-center justify-center flex-shrink-0">
        <span className="font-emoji text-xl leading-none">{pack.emoji}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-extrabold text-ink text-[15px] truncate">
          {pack.name}
          {pack.nameZh && (
            <span className="font-hanzi text-ink-soft font-normal ml-2">
              {pack.nameZh}
            </span>
          )}
        </p>
        <div
          className="mt-1.5 h-3 rounded-full bg-chip-track overflow-hidden"
          role="progressbar"
          aria-valuenow={pack.mastered}
          aria-valuemin={0}
          aria-valuemax={pack.totalWords}
          aria-label={`${pack.name}: ${pack.mastered} of ${pack.totalWords} ${unit} mastered`}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold to-success"
            style={{ width: `${fillPct}%` }}
          />
        </div>
      </div>
      <p className="text-ink-soft text-sm font-bold flex-shrink-0">
        {pack.mastered} of {pack.totalWords} {unit}
      </p>
    </div>
  )
}

export default function ChildReport({
  params,
}: {
  params: { childId: string }
}) {
  const router = useRouter()
  const [report, setReport] = useState<Report | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')

  useEffect(() => {
    // The parent zone's grown-ups gate (kid filter, not a security boundary):
    // unlock happens on /parent, so send un-gated visitors there first.
    if (sessionStorage.getItem(GATE_KEY) !== 'passed') {
      router.replace('/parent')
    }
  }, [router])

  const fetchReport = useCallback(async () => {
    setStatus('loading')
    const { ok, status: httpStatus, data } = await fetchJsonWithAuthRetry<Report>(
      `/api/children/${encodeURIComponent(params.childId)}/report`
    )
    if (httpStatus === 404) {
      router.replace('/parent')
      return
    }
    if (ok && data) {
      setReport(data)
      setStatus('ready')
    } else {
      setStatus('failed')
    }
  }, [params.childId, router])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const chinesePacks = report?.packs.filter((p) => p.subject !== 'math') ?? []
  const mathPacks = report?.packs.filter((p) => p.subject === 'math') ?? []

  return (
    <div className="min-h-screen bg-canvas-top">
      <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/parent')}
            aria-label="Back to the parent zone"
            className="pressable bg-white rounded-2xl w-14 h-14 flex items-center justify-center text-2xl text-ink shadow-press-chip flex-shrink-0"
          >
            ←
          </button>
          {report ? (
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-14 h-14 rounded-2xl bg-[#FFF3D6] rotate-[-4deg] flex items-center justify-center flex-shrink-0">
                <span className="font-emoji text-2xl leading-none">
                  {report.child.avatar}
                </span>
              </div>
              <div className="min-w-0">
                <h1 className="text-[27px] font-extrabold text-ink leading-tight truncate">
                  {report.child.name}
                </h1>
                <p className="text-ink-soft text-sm font-bold">
                  {formatLastPracticed(report.child.lastPracticed)}
                </p>
              </div>
            </div>
          ) : (
            <h1 className="text-[27px] font-extrabold text-ink leading-tight">
              Progress report
            </h1>
          )}
        </div>

        {report && (
          <div className="flex flex-wrap gap-3">
            <span className="bg-white rounded-full px-4 py-2 shadow-press-chip text-ink text-sm font-extrabold">
              <span className="font-emoji">❤️</span> {report.child.totalHearts} hearts
            </span>
            <span className="bg-white rounded-full px-4 py-2 shadow-press-chip text-ink text-sm font-extrabold">
              <span className="font-emoji">🔥</span> {report.child.streak} day streak
            </span>
          </div>
        )}

        {status === 'loading' && (
          <div className="text-ink-soft text-sm font-bold">Loading…</div>
        )}

        {status === 'failed' && (
          <div className="bg-chip-track rounded-2xl px-4 py-3 text-ink text-sm font-bold flex items-center justify-between gap-3">
            <span>Couldn&apos;t load this report.</span>
            <button
              onClick={fetchReport}
              className="min-h-[44px] font-extrabold underline underline-offset-2 flex-shrink-0"
            >
              Try again
            </button>
          </div>
        )}

        {status === 'ready' && report && (
          <>
            {/* This week */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[22px] p-5 shadow-press-card"
            >
              <h2 className="text-lg font-extrabold text-ink">This week</h2>
              <p className="text-ink font-bold mt-2">
                {weekProse(report.totals.answers7d, report.totals.correct7d)}
              </p>
              <p className="text-ink-soft text-sm font-bold mt-1">
                {report.totals.wordsStarted} words started ·{' '}
                {report.totals.wordsMastered} mastered so far
              </p>
            </motion.section>

            {/* Words to practice together */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-white rounded-[22px] p-5 shadow-press-card"
            >
              <h2 className="text-lg font-extrabold text-ink">
                Words to practice together
              </h2>
              {report.wobbly.length === 0 ? (
                <p className="text-ink font-bold mt-2">
                  Nothing wobbly right now!{' '}
                  <span className="font-emoji">🎉</span>
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-3">
                  {report.wobbly.map((word) => (
                    <li key={word.wordId} className="flex items-baseline gap-3">
                      <span className="font-hanzi text-chinese text-3xl leading-none flex-shrink-0">
                        {word.chinese}
                      </span>
                      <span className="text-ink-soft text-sm font-bold flex-shrink-0">
                        {word.pinyin}
                      </span>
                      <span className="text-ink text-sm font-bold truncate">
                        {word.english}
                      </span>
                      <span className="ml-auto text-ink-soft text-xs font-bold flex-shrink-0">
                        {word.packName}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </motion.section>

            {/* Packs */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-[22px] p-5 shadow-press-card flex flex-col gap-4"
            >
              <h2 className="text-lg font-extrabold text-ink">Packs</h2>
              {[...chinesePacks, ...mathPacks].map((pack) => (
                <PackRow key={pack.packId} pack={pack} />
              ))}
              {report.packs.length === 0 && (
                <p className="text-ink-soft text-sm font-bold">
                  No packs to show yet.
                </p>
              )}
            </motion.section>
          </>
        )}
      </div>
    </div>
  )
}
