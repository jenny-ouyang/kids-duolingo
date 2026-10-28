'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import KidLayout from '@/components/layout/KidLayout'
import { Hills, Sparkles } from '@/components/design/Scenery'
import { setActiveChild } from '@/lib/child-cookie'
import { fetchJsonWithAuthRetry } from '@/lib/api-fetch'
import WeekDots from '@/components/progress/WeekDots'

interface ChildSummary {
  id: string
  name: string
  avatar: string
  totalHearts: number
  weekDays: boolean[]
  today: number
  nextPack: { id: string; name: string; nameZh: string; emoji: string } | null
}

export default function SwitchPage() {
  const router = useRouter()
  const [children, setChildren] = useState<ChildSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchJsonWithAuthRetry<ChildSummary[]>(`/api/children?tz=${new Date().getTimezoneOffset()}`).then(({ status, data }) => {
      if (cancelled) return
      if (status === 403) {
        // Authed but no child yet — first visit, go set one up
        router.replace('/welcome')
        return
      }
      if (Array.isArray(data)) setChildren(data)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [router])

  // One tap plays: set the child, then open that child's next lesson
  async function pickChild(child: ChildSummary) {
    // Await so the server-set httpOnly cookie is in place before navigating
    await setActiveChild(child.id)
    router.push(child.nextPack ? `/practice/session?pack=${child.nextPack.id}` : '/')
  }

  if (loading) {
    return (
      <KidLayout>
        <Hills />
        <div className="relative z-10 font-emoji text-6xl animate-spin motion-reduce:animate-none">🌟</div>
      </KidLayout>
    )
  }

  return (
    <KidLayout align="top">
      <Sparkles positions="sparse" />
      <Hills />

      <div className="relative z-10 flex flex-col items-center gap-5 w-full max-w-md">
        <div className="text-center">
          <h1 className="text-[27px] font-extrabold text-ink">
            Who&apos;s playing? <span className="font-emoji">🎈</span>
          </h1>
          <p className="text-lg text-ink-mid font-bold mt-1">Tap your buddy to play your next lesson.</p>
        </div>

        <ul className="flex flex-col gap-4 w-full">
          {children.map((child) => {
            const days = child.weekDays?.filter(Boolean).length ?? 0
            return (
              <li key={child.id}>
                <button
                  onClick={() => pickChild(child)}
                  aria-label={`${child.name}${child.nextPack ? `, play next: ${child.nextPack.name}` : ''}`}
                  className="pressable w-full bg-white rounded-[22px] p-3.5 flex items-center gap-3.5 text-left shadow-press-card"
                >
                  <span className="w-[72px] h-[72px] rounded-[20px] bg-[#FFF3D6] flex items-center justify-center font-emoji text-[40px] leading-none flex-shrink-0">
                    {child.avatar}
                  </span>
                  <span className="flex-1 min-w-0 flex flex-col gap-1">
                    <span className="text-[22px] font-extrabold text-ink leading-tight truncate">{child.name}</span>
                    {child.weekDays && (
                      <span className="flex items-center gap-2 flex-wrap">
                        <WeekDots days={child.weekDays} today={child.today} />
                        <span className="text-base font-bold text-ink-mid">
                          {days} day{days === 1 ? '' : 's'} this week
                        </span>
                      </span>
                    )}
                    {child.nextPack && (
                      <span className="text-[17px] font-bold text-ink truncate">
                        Next: {child.nextPack.name} <span className="font-hanzi text-chinese-edge">{child.nextPack.nameZh}</span>
                      </span>
                    )}
                  </span>
                  <span aria-hidden className="w-14 h-14 rounded-full bg-chinese shadow-press-chinese text-white text-2xl flex items-center justify-center flex-shrink-0">
                    ▶
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <p className="text-base font-bold text-ink-mid">A missed day leaves a gap. Nothing resets.</p>

        {/* Adding a child is a grown-up job: it goes through the Parent Zone gate */}
        <Link
          href="/parent?add=1"
          className="pressable w-full min-h-[64px] rounded-[22px] bg-white/70 border-[3px] border-dashed border-gold-edge text-ink text-lg font-extrabold flex items-center justify-center"
        >
          Grown-ups: add a child
        </Link>
        <Link href="/parent" className="min-h-[44px] flex items-center text-base font-extrabold text-ink underline underline-offset-2">
          Parent Zone
        </Link>
      </div>
    </KidLayout>
  )
}
