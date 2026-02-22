/**
 * Preferred female zh-CN voice names across platforms.
 * The browser checks these in order and uses the first match found.
 */
const FEMALE_VOICE_NAMES = [
  'Tingting',          // macOS
  'Google 普通话（中国大陆）', // Chrome on desktop
  'Microsoft Xiaoxiao Online (Natural) - zh-CN', // Edge / Windows
  'Microsoft Huihui - Chinese (Simplified, PRC)',
  'zh-CN-XiaoxiaoNeural',
  'Meijia',            // macOS (Traditional, but female)
]

let cachedVoice: SpeechSynthesisVoice | null = null

function findFemaleVoice(): SpeechSynthesisVoice | null {
  if (!window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null

  // Try preferred female names first
  for (const name of FEMALE_VOICE_NAMES) {
    const match = voices.find((v) => v.name.includes(name))
    if (match) return match
  }

  // Fall back to any zh-CN voice (browser will pick)
  return voices.find((v) => v.lang === 'zh-CN' || v.lang === 'zh_CN') ?? null
}

function getVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice
  cachedVoice = findFemaleVoice()
  return cachedVoice
}

export function speakChinese(text: string): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return

  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  utterance.rate = 0.85
  utterance.pitch = 1.15

  const voice = getVoice()
  if (voice) utterance.voice = voice

  window.speechSynthesis.speak(utterance)
}

/** Call once on app load so voices are cached before first use */
export function preloadVoices(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return

  const load = () => {
    cachedVoice = findFemaleVoice()
  }

  if (window.speechSynthesis.getVoices().length > 0) {
    load()
  } else {
    window.speechSynthesis.onvoiceschanged = () => {
      load()
      window.speechSynthesis.onvoiceschanged = null
    }
  }
}

export function stopSpeech(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}
