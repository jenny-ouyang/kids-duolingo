'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// Sunrise Playground palette only (DESIGN.md)
const COLORS = ['#F4576B', '#FF7A82', '#3D7DE4', '#57A5F5', '#FFCF57', '#F5B93F', '#1FA88C', '#9A7BE8']
const SHAPES = ['●', '★', '■', '▲', '♦']

interface Particle {
  id: number
  x: number
  color: string
  shape: string
  size: number
  delay: number
  duration: number
  rotate: number
}

export default function Confetti({ count = 40 }: { count?: number }) {
  const [particles, setParticles] = useState<Particle[]>([])
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const generated: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
      size: 12 + Math.random() * 14,
      delay: Math.random() * 0.8,
      duration: 1.2 + Math.random() * 1.2,
      rotate: Math.random() * 720 - 360,
    }))
    setParticles(generated)
    // Leave the page when the last piece lands, so no invisible nodes stay behind
    const end = Math.max(...generated.map((p) => p.delay + p.duration))
    const timer = setTimeout(() => setParticles([]), end * 1000 + 100)
    return () => clearTimeout(timer)
  }, [count])

  if (reduceMotion || particles.length === 0) return null

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50" aria-hidden>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -30, x: `${p.x}vw`, opacity: 1, rotate: 0 }}
          animate={{ y: '110vh', opacity: [1, 1, 0], rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
          className="absolute top-0"
          style={{ color: p.color, fontSize: p.size }}
        >
          {p.shape}
        </motion.div>
      ))}
    </div>
  )
}
