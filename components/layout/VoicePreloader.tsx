'use client'

import { useEffect } from 'react'
import { preloadVoices, primeSpeech } from '@/lib/tts'
import { unlockAudio } from '@/lib/sounds'

/**
 * Mounted once in the root layout. Preloads zh-CN voices, and — on the first
 * real user gesture anywhere in the app — primes the shared AudioContext and
 * speech engine. Browsers (iOS Safari especially) block audio + speech until a
 * gesture, so priming here makes every later sound reliable: dings, word
 * pronunciation, and the celebration screen that fires sound on mount.
 */
export default function VoicePreloader() {
  useEffect(() => {
    preloadVoices()

    const unlock = () => {
      unlockAudio()
      primeSpeech()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('touchstart', unlock)
      window.removeEventListener('keydown', unlock)
    }

    window.addEventListener('pointerdown', unlock)
    window.addEventListener('touchstart', unlock)
    window.addEventListener('keydown', unlock)

    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('touchstart', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  return null
}
