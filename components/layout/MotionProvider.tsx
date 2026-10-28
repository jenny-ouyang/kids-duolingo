'use client'

import { ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'

/**
 * framer-motion ignores prefers-reduced-motion unless told. With "user", every
 * transform/layout animation is skipped when the OS asks for less motion;
 * opacity and color still animate, so feedback stays visible (DESIGN.md).
 */
export default function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
