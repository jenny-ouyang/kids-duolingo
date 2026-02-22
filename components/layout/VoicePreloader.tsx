'use client'

import { useEffect } from 'react'
import { preloadVoices } from '@/lib/tts'

export default function VoicePreloader() {
  useEffect(() => {
    preloadVoices()
  }, [])
  return null
}
