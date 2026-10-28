'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * The Parent Zone is the single buy surface (spec 2026-10-13 §4). This route
 * stays only because it is Stripe's cancel_url and an old deep link.
 */
export default function UnlockPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/parent')
  }, [router])
  return null
}
