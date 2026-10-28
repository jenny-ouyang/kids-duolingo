'use client'

import { ReactNode } from 'react'

interface KidLayoutProps {
  children: ReactNode
  /** 'center' for short single-purpose screens; 'top' when content should start near the top on a phone */
  align?: 'center' | 'top'
  className?: string
}

/**
 * Sunrise Playground canvas wrapper (docs/design/DESIGN.md): full-bleed
 * sunrise-cream gradient with scenery layered behind a centered column.
 * Pages render Hills/Sun/Sparkles themselves; content sits at z-10+.
 *
 * Alignment is a prop, not a className: a passed `justify-start` cannot beat
 * the built-in `justify-center` (Tailwind emits .justify-center later).
 */
export default function KidLayout({ children, align = 'center', className = '' }: KidLayoutProps) {
  const justify = align === 'top' ? 'justify-start pt-10' : 'justify-center'
  return (
    <div className={`sunrise-canvas flex flex-col items-center ${justify} p-4 ${className}`}>
      {children}
    </div>
  )
}
