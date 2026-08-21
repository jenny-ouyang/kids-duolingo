'use client'

import { isNativeApp } from '@/lib/api-fetch'

/**
 * Native haptic taps for answer feedback — silently a no-op on the web.
 * Dynamic import keeps @capacitor/haptics out of the web bundle's hot path.
 */
async function haptics() {
  const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics')
  return { Haptics, ImpactStyle, NotificationType }
}

export function hapticCorrect() {
  if (!isNativeApp()) return
  haptics()
    .then(({ Haptics, NotificationType }) => Haptics.notification({ type: NotificationType.Success }))
    .catch(() => {})
}

export function hapticWrong() {
  if (!isNativeApp()) return
  haptics()
    .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }))
    .catch(() => {})
}

export function hapticCelebrate() {
  if (!isNativeApp()) return
  haptics()
    .then(async ({ Haptics, ImpactStyle }) => {
      await Haptics.impact({ style: ImpactStyle.Medium })
      setTimeout(() => Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {}), 150)
    })
    .catch(() => {})
}
