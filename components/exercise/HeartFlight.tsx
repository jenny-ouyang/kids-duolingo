'use client'

import { useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { playHeartSound } from '@/lib/sounds'

/**
 * A heart flies from the tapped tile to the hearts chip (450 ms), so the child
 * sees where it went. Under Reduce Motion there is no flight: it lands at once.
 */
export default function HeartFlight({ from, to, onLand }: { from: DOMRect; to: DOMRect; onLand: () => void }) {
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (reduceMotion) onLand()
  }, [reduceMotion, onLand])

  if (reduceMotion) return null

  const startX = from.left + from.width / 2 - 14
  const startY = from.top + from.height / 2 - 14
  const endX = to.left + to.width / 2 - 14
  const endY = to.top + to.height / 2 - 14

  return (
    <motion.span
      aria-hidden
      className="font-emoji fixed left-0 top-0 z-40 text-[28px] leading-none pointer-events-none"
      initial={{ x: startX, y: startY, scale: 1.2 }}
      animate={{ x: endX, y: endY, scale: 0.8 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      onAnimationComplete={() => {
        playHeartSound()
        onLand()
      }}
    >
      ❤️
    </motion.span>
  )
}
