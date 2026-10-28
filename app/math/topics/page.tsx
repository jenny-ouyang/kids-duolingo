'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import KidLayout from '@/components/layout/KidLayout'
import { Hills, Sparkles, Sun } from '@/components/design/Scenery'
import { fetchJsonCached } from '@/lib/api-fetch'
import { suggestedIndex } from '@/components/home/PackPath'
import type { MathQuestion } from '@/lib/types'

interface TopicMeta {
  id: string
  name: string
  emoji: string
  color: string
  wordCount: number
  learned: number
  masteryPct: number
}

function stateLine(t: TopicMeta, isNext: boolean): string {
  if (t.masteryPct === 100) return '✓ Learned'
  if (isNext) return `Next up · ${t.learned} of ${t.wordCount} learned`
  if (t.masteryPct > 0 || t.learned > 0) return `Started · ${t.learned} of ${t.wordCount} learned`
  return 'Not started, open any time'
}

export default function MathTopicsPage() {
  const router = useRouter()
  const [topics, setTopics] = useState<TopicMeta[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [sample, setSample] = useState<MathQuestion['problem'] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchJsonCached<TopicMeta[]>('/api/packs?subject=math').then(({ ok, status, data }) => {
      if (cancelled) return
      if (status === 403) {
        // Authed but no child yet — first visit, go set one up
        router.replace('/welcome')
        return
      }
      if (!ok || !Array.isArray(data)) {
        setStatus('error')
        return
      }
      setTopics(data)
      setStatus('ready')
      // One sample problem, so a child who cannot read yet still sees what comes
      const next = data[suggestedIndex(data.map((t) => ({ ...t, nameZh: '' })))]
      if (next) {
        fetchJsonCached<{ questions?: MathQuestion[] }>(`/api/math/questions/${next.id}`).then((r) => {
          if (!cancelled && r.ok) setSample(r.data?.questions?.[0]?.problem ?? null)
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [router])

  if (status === 'loading') {
    return (
      <KidLayout>
        <Hills />
        <div className="relative z-10 font-emoji text-6xl animate-spin motion-reduce:animate-none">🌟</div>
      </KidLayout>
    )
  }

  if (status === 'error') {
    return (
      <KidLayout>
        <Hills />
        <div className="relative z-10 flex flex-col items-center">
          <p className="text-xl font-extrabold text-ink text-center">
            Oops! Could not load the topics.
          </p>
          <button
            onClick={() => router.push('/')}
            className="pressable mt-6 min-h-[56px] bg-white text-ink rounded-3xl px-8 py-4 text-lg font-extrabold shadow-press-card"
          >
            Go Back
          </button>
        </div>
      </KidLayout>
    )
  }

  const nextIdx = suggestedIndex(topics.map((t) => ({ ...t, nameZh: '' })))
  const next = topics[nextIdx]

  return (
    <KidLayout align="top" className="pb-16">
      <Sun scale={0.8} />
      <Sparkles positions="sparse" />
      <Hills />

      <div className="relative z-10 w-full max-w-md flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            aria-label="Back to home"
            className="pressable bg-white rounded-2xl w-14 h-14 flex items-center justify-center text-2xl text-ink shadow-press-chip"
          >
            ←
          </button>
          <h1 className="text-[27px] font-extrabold text-ink">
            Math <span className="font-hanzi text-xl text-math-edge font-normal">数学</span>
          </h1>
        </div>

        {next && (
          <section aria-label="Play next" className="bg-white rounded-[26px] shadow-press-card p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="font-emoji text-[32px] leading-none bg-[#E4EFFD] rounded-2xl px-2.5 py-1.5 rotate-[-4deg]" aria-hidden>
                {next.emoji}
              </span>
              <div className="min-w-0">
                <h2 className="text-[19px] font-extrabold text-ink leading-tight">{next.name}</h2>
              </div>
            </div>
            {sample && sample.operator !== 'count' && (
              <p
                aria-label={`For example: ${sample.operand1} ${sample.operator === '+' ? 'plus' : 'minus'} ${sample.operand2}`}
                className="bg-[#E4EFFD] rounded-2xl py-2 text-center text-[32px] font-extrabold text-ink tabular-nums"
              >
                {sample.operand1} <span className="text-math-edge">{sample.operator === '+' ? '+' : '−'}</span> {sample.operand2}{' '}
                <span className="text-ink-mid">=</span> <span className="text-math-edge">?</span>
              </p>
            )}
            <button
              onClick={() => router.push(`/math/practice/session?topic=${next.id}`)}
              className="pressable w-full min-h-[60px] rounded-[22px] bg-math text-white text-[21px] font-extrabold shadow-press-math"
            >
              Play next <span className="font-emoji">▶️</span>
            </button>
          </section>
        )}

        {/* Topics as an open path: state in words and shape, never locked */}
        <ol className="relative flex flex-col gap-5 before:absolute before:left-[31px] before:top-8 before:bottom-8 before:border-l-4 before:border-dotted before:border-card-edge">
          {topics.map((topic, i) => {
            const isNext = i === nextIdx
            return (
              <li key={topic.id} className="relative flex items-center gap-4">
                <button
                  onClick={() => router.push(`/math/practice/session?topic=${topic.id}`)}
                  aria-label={`${topic.name}, ${stateLine(topic, isNext)}`}
                  className={`pressable shrink-0 w-16 h-16 rounded-full flex items-center justify-center font-emoji text-[30px] ${
                    isNext
                      ? 'bg-[#E4EFFD] ring-[5px] ring-math shadow-press-math'
                      : topic.masteryPct === 100
                        ? 'bg-success-bg shadow-press-success'
                        : 'bg-white shadow-press-card'
                  }`}
                >
                  {topic.emoji}
                </button>
                <p className="text-[19px] font-extrabold text-ink leading-tight min-w-0">
                  {topic.name}
                  {isNext && <span className="block text-base text-math-edge">Next up</span>}
                </p>
              </li>
            )
          })}
        </ol>

      </div>
    </KidLayout>
  )
}
