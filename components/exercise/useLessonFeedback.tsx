'use client'

import { useCallback, useRef, useState } from 'react'
import type { BuddyMood } from '@/components/design/Mascot'
import HeartFlight from './HeartFlight'
import type { LessonFeedback } from './FeedbackBand'

/**
 * Per-question reaction state for a lesson page: the panda's mood and the heart
 * that flies to the chip. Keyed by question index, so moving on resets both in
 * the same render (no effect). `landed` is the heart already in the chip before
 * the page counts it on Next.
 */
export function useLessonFeedback(currentIndex: number, canEarnHeart: boolean) {
  const heartChipRef = useRef<HTMLSpanElement>(null)
  const [state, setState] = useState<{ index: number; mood: BuddyMood; from: DOMRect | null; landed: boolean }>({
    index: -1,
    mood: 'idle',
    from: null,
    landed: false,
  })
  const current = state.index === currentIndex ? state : { index: currentIndex, mood: 'idle' as BuddyMood, from: null, landed: false }

  const onFeedback = useCallback(
    (f: LessonFeedback) => {
      setState((prev) => ({
        index: currentIndex,
        mood: f.mood,
        from: f.mood === 'yes' && f.earnsHeart && canEarnHeart && f.from ? f.from : null,
        landed: prev.index === currentIndex ? prev.landed : false,
      }))
    },
    [currentIndex, canEarnHeart]
  )

  const onLand = useCallback(() => {
    setState((prev) => (prev.index === currentIndex ? { ...prev, from: null, landed: true } : prev))
  }, [currentIndex])

  const target = heartChipRef.current?.getBoundingClientRect()
  const flight =
    current.from && target ? <HeartFlight from={current.from} to={target} onLand={onLand} /> : null

  return { mood: current.mood, onFeedback, heartChipRef, flight, landed: current.landed }
}
