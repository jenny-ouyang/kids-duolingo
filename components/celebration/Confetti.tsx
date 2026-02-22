'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const COLORS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF922B', '#CC5DE8', '#F06595']
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

export default function Confetti({ count = 60 }: { count?: number }) {
  const [particles, setParticles] = useState<Particle[]>([])

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
  }, [count])

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
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
