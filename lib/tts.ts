/**
 * Chinese speech for the app.
 *
 * Primary path: pre-generated MP3 clips (scripts/generate-audio.py) played
 * through the shared AudioContext from lib/sounds.ts — consistent voices
 * (Xiaoyi teaches, Yunxia cheers) on every device, and the same first-gesture
 * unlock that fixed the June 2026 iOS total-silence bug covers these clips.
 *
 * Fallback path: the browser's Web Speech API (zh-CN), for any text that has
 * no clip yet (e.g. brand-new content before the audio script re-runs).
 */
import manifest from '@/lib/audio-manifest.json'
import { getSharedAudioContext } from '@/lib/sounds'

const clipFiles = manifest as Record<string, string>
const bufferCache = new Map<string, AudioBuffer>()
let currentSource: AudioBufferSourceNode | null = null
let currentElement: HTMLAudioElement | null = null

function isNativeShell(): boolean {
  if (typeof window === 'undefined') return false
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return cap?.isNativePlatform?.() ?? false
}

function stopClip(): void {
  if (currentSource) {
    try { currentSource.stop() } catch { /* already stopped */ }
    currentSource = null
  }
  if (currentElement) {
    try { currentElement.pause() } catch { /* already stopped */ }
    currentElement = null
  }
}

const elementCache = new Map<string, HTMLAudioElement>()

/**
 * Native (Capacitor) clip playback: HTMLAudioElement, NOT WebAudio. On real
 * devices WKWebView's WebAudio output proved unreliable (builds 2–3 were
 * silent), while HTMLMediaElement plays through the media channel — audible
 * regardless of the ring/silent switch, with no AVAudioSession involvement.
 */
async function playClipNative(file: string): Promise<boolean> {
  try {
    stopClip()
    let el = elementCache.get(file)
    if (!el) {
      el = new Audio(`/audio/zh/${file}`)
      el.preload = 'auto'
      elementCache.set(file, el)
    }
    el.currentTime = 0
    currentElement = el
    await el.play()
    return true
  } catch {
    return false
  }
}

async function playClip(text: string): Promise<boolean> {
  const file = clipFiles[text]
  if (!file) return false
  if (isNativeShell()) return playClipNative(file)
  const ctx = getSharedAudioContext()
  if (!ctx) return false

  try {
    let buffer = bufferCache.get(file)
    if (!buffer) {
      const res = await fetch(`/audio/zh/${file}`)
      // Capacitor's local-scheme responses report status 0 — treat a body as
      // success there, or every bundled clip would fall back to Web Speech.
      if (!res.ok && res.status !== 0) return false
      const bytes = await res.arrayBuffer()
      if (bytes.byteLength === 0) return false
      buffer = await ctx.decodeAudioData(bytes)
      bufferCache.set(file, buffer)
    }
    stopClip()
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.onended = () => { if (currentSource === source) currentSource = null }
    source.start()
    currentSource = source
    return true
  } catch {
    return false
  }
}

// ─── Web Speech fallback (legacy path, kept fully intact) ────────────────────

const FEMALE_VOICE_NAMES = [
  'Tingting',
  'Google 普通话（中国大陆）',
  'Microsoft Xiaoxiao Online (Natural) - zh-CN',
  'Microsoft Huihui - Chinese (Simplified, PRC)',
  'zh-CN-XiaoxiaoNeural',
  'Meijia',
]

let cachedVoice: SpeechSynthesisVoice | null = null

function findFemaleVoice(): SpeechSynthesisVoice | null {
  if (!window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null
  for (const name of FEMALE_VOICE_NAMES) {
    const match = voices.find((v) => v.name.includes(name))
    if (match) return match
  }
  return voices.find((v) => v.lang === 'zh-CN' || v.lang === 'zh_CN') ?? null
}

function speakWithBrowser(text: string): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  utterance.rate = 0.85
  utterance.pitch = 1.15
  if (!cachedVoice) cachedVoice = findFemaleVoice()
  if (cachedVoice) utterance.voice = cachedVoice
  window.speechSynthesis.speak(utterance)
}

// ─── Public API (signatures unchanged) ───────────────────────────────────────

export function speakChinese(text: string): void {
  if (typeof window === 'undefined') return
  // Cancel any in-flight speech from either engine before starting anew
  if (window.speechSynthesis) window.speechSynthesis.cancel()
  void playClip(text).then((played) => {
    if (!played) speakWithBrowser(text)
  })
}

/** Call once on app load: warms browser voices (fallback) — clip path needs no warmup */
export function preloadVoices(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  const load = () => { cachedVoice = findFemaleVoice() }
  if (window.speechSynthesis.getVoices().length > 0) {
    load()
  } else {
    window.speechSynthesis.onvoiceschanged = () => {
      load()
      window.speechSynthesis.onvoiceschanged = null
    }
  }
}

let speechPrimed = false

/**
 * Unlock speech on iOS/Safari during the first real user gesture (June 2026
 * fix). Primes BOTH engines: resumes the shared AudioContext for clips and
 * speaks a silent utterance for the Web Speech fallback.
 */
export function primeSpeech(): void {
  if (typeof window === 'undefined' || speechPrimed) return
  speechPrimed = true
  getSharedAudioContext() // creates + resumes inside a gesture → clips unlocked
  if (!window.speechSynthesis) return
  try {
    window.speechSynthesis.resume()
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    window.speechSynthesis.speak(u)
  } catch {
    // ignore — priming is best-effort
  }
}

export function stopSpeech(): void {
  if (typeof window === 'undefined') return
  stopClip()
  if (window.speechSynthesis) window.speechSynthesis.cancel()
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && ('speechSynthesis' in window || getSharedAudioContext() !== null)
}
