'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { fetchJsonWithAuthRetry } from '@/lib/api-fetch'
import { speakChinese } from '@/lib/tts'
import WeekDots from '@/components/progress/WeekDots'

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
  weekDays: boolean[]
  today: number
  nextPack: { id: string; name: string; nameZh: string; emoji: string; learned: number; wordCount: number } | null
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

function weekProse(daysPlayed: number, answers7d: number, correct7d: number): string {
  if (answers7d === 0) return 'No practice this week yet. A quick session together is a great start!'
  const pct = Math.round((correct7d / answers7d) * 100)
  const questions = answers7d === 1 ? 'question' : 'questions'
  const days = daysPlayed === 1 ? 'day' : 'days'
  return `Played ${daysPlayed} ${days}. ${answers7d} ${questions}, ${pct}% right on the first try.`
}

/** A pack's state, in words: Learning, Done, or Not started */
function packState(p: ReportPack): 'learning' | 'done' | 'notStarted' {
  if (p.totalWords > 0 && p.mastered === p.totalWords) return 'done'
  if (p.started > 0 || p.mastered > 0) return 'learning'
  return 'notStarted'
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
        <p className="font-extrabold text-ink text-base truncate">
          {pack.name}
          {pack.nameZh && (
            <span className="font-hanzi text-ink-mid font-normal ml-2">
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
            className="h-full rounded-full bg-success"
            style={{ width: `${fillPct}%` }}
          />
        </div>
      </div>
      <p className="text-ink-mid text-base font-bold flex-shrink-0">
        {pack.mastered} of {pack.totalWords} {unit}
      </p>
    </div>
  )
}

export default function ChildReportPage() {
  // useSearchParams needs a Suspense boundary under static export
  return (
    <Suspense fallback={null}>
      <ChildReport />
    </Suspense>
  )
}

function ChildReport() {
  const router = useRouter()
  const childId = useSearchParams().get('child') ?? ''
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
      `/api/children/${encodeURIComponent(childId)}/report?tz=${new Date().getTimezoneOffset()}`
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
  }, [childId, router])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const allPacks = report ? [...report.packs.filter((p) => p.subject !== 'math'), ...report.packs.filter((p) => p.subject === 'math')] : []
  const learning = allPacks.filter((p) => packState(p) === 'learning')
  const done = allPacks.filter((p) => packState(p) === 'done')
  const notStarted = allPacks.filter((p) => packState(p) === 'notStarted')

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
                <p className="text-ink-mid text-base font-bold">
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
            <span className="bg-white rounded-full px-4 py-2 shadow-press-chip text-ink text-base font-extrabold">
              <span className="font-emoji">❤️</span> {report.child.totalHearts} hearts
            </span>
          </div>
        )}

        {status === 'loading' && (
          <div className="text-ink-mid text-base font-bold">Loading…</div>
        )}

        {status === 'failed' && (
          <div className="bg-chip-track rounded-2xl px-4 py-3 text-ink text-base font-bold flex items-center justify-between gap-3">
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
              <div className="mt-3">
                <WeekDots days={report.weekDays} today={report.today} size={18} letters />
              </div>
              <p className="text-ink text-xl font-extrabold mt-3">
                {weekProse(report.weekDays.filter(Boolean).length, report.totals.answers7d, report.totals.correct7d)}
              </p>
              <p className="text-ink-mid text-base font-bold mt-1">A missed day leaves a gap; nothing resets.</p>
              <p className="text-ink-mid text-base font-bold mt-1">
                {report.totals.wordsStarted} words started · {report.totals.wordsMastered} mastered so far
              </p>
            </motion.section>

            {/* What comes next */}
            {report.nextPack && (
              <section className="bg-white rounded-[22px] p-5 shadow-press-card flex items-center gap-4">
                <span className="font-emoji text-3xl bg-[#FFF3D6] rounded-2xl px-2.5 py-1.5 rotate-[-4deg]" aria-hidden>
                  {report.nextPack.emoji}
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg font-extrabold text-ink">What comes next</h2>
                  <p className="text-base font-bold text-ink">
                    <span className="text-success-edge font-extrabold">Next up:</span> {report.nextPack.name}{' '}
                    <span className="font-hanzi text-chinese-edge">{report.nextPack.nameZh}</span>,{' '}
                    {report.nextPack.learned} of {report.nextPack.wordCount} words learned.
                  </p>
                  <p className="text-base font-bold text-ink-mid">
                    The Play next button on {report.child.name}&apos;s home opens it.
                  </p>
                </div>
              </section>
            )}

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
                <>
                  <p className="text-ink-mid text-base font-bold mt-1">
                    {report.child.name} found these hard lately. Tap 🔊 to hear each one.
                  </p>
                  <ul className="mt-3 flex flex-col gap-3">
                    {report.wobbly.map((word) => (
                      <li key={word.wordId} className="flex items-center gap-3">
                        <button
                          onClick={() => speakChinese(word.chinese)}
                          aria-label={`Hear ${word.chinese}, ${word.english}`}
                          className="pressable min-w-[56px] min-h-[48px] rounded-2xl bg-gold shadow-press-gold flex items-center justify-center flex-shrink-0"
                        >
                          <span className="font-emoji text-xl">🔊</span>
                        </button>
                        <div className="min-w-0">
                          <span className="block font-hanzi text-chinese-edge text-3xl leading-tight">{word.chinese}</span>
                          <span className="block text-base font-bold text-ink-mid">
                            <span className="font-pinyin">{word.pinyin}</span> · {word.english} · {word.packName}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
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
              <p className="text-ink-mid text-base font-bold">
                <b className="text-ink">Learning</b>: started. <b className="text-ink">Done</b>: every word or problem
                mastered. <b className="text-ink">Not started</b>: open any time; nothing is locked.
              </p>

              <h3 className="text-base font-extrabold text-ink">Learning · {learning.length}</h3>
              {learning.map((pack) => (
                <PackRow key={pack.packId} pack={pack} />
              ))}
              {learning.length === 0 && <p className="text-ink-mid text-base font-bold">No pack started yet.</p>}

              <h3 className="text-base font-extrabold text-ink">Done · {done.length}</h3>
              {done.map((pack) => (
                <PackRow key={pack.packId} pack={pack} />
              ))}
              {done.length === 0 && (
                <p className="text-ink-mid text-base font-bold">A pack is done when every word in it is mastered.</p>
              )}

              {notStarted.length > 0 && (
                <details className="group">
                  <summary className="min-h-[44px] flex items-center cursor-pointer text-base font-extrabold text-ink">
                    Not started, open any time · {notStarted.length}
                  </summary>
                  <div className="flex flex-col gap-4 mt-3">
                    {notStarted.map((pack) => (
                      <PackRow key={pack.packId} pack={pack} />
                    ))}
                  </div>
                </details>
              )}
            </motion.section>
          </>
        )}
      </div>
    </div>
  )
}
