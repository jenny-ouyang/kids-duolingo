'use client'

import { ReactNode } from 'react'

interface KidLayoutProps {
  children: ReactNode
  className?: string
}

/**
 * Sunrise Playground canvas wrapper (docs/design/DESIGN.md): full-bleed
 * sunrise-cream gradient with scenery layered behind a centered column.
 * Pages render Hills/Sun/Sparkles themselves; content sits at z-10+.
 */
export default function KidLayout({ children, className = '' }: KidLayoutProps) {
  return (
    <div className={`sunrise-canvas flex flex-col items-center justify-center p-4 ${className}`}>
      {children}
    </div>
  )
}
