'use client'

import { ReactNode } from 'react'

interface KidLayoutProps {
  children: ReactNode
  className?: string
}

export default function KidLayout({ children, className = '' }: KidLayoutProps) {
  return (
    <div
      className={`min-h-screen bg-gradient-to-b from-sky-100 to-blue-50 flex flex-col items-center justify-center p-4 ${className}`}
    >
      {children}
    </div>
  )
}
