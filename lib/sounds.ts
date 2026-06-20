/**
 * All sounds generated via Web Audio API — no files needed.
 */

// One shared AudioContext for the whole app. Creating a new one per sound
// (the old behavior) is fatal: browsers cap a tab at ~6 contexts, after which
// `new AudioContext()` throws and every later sound goes silent. A new context
// also starts *suspended* until a user gesture, so per-call contexts never get
// resumed. One singleton, resumed on every use, fixes both.
let sharedCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!sharedCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    sharedCtx = new Ctor()
  }
  if (sharedCtx.state === 'suspended') {
    void sharedCtx.resume().catch(() => {})
  }
  return sharedCtx
}

/**
 * Prime/resume the shared AudioContext. Call this from the first real user
 * gesture (tap/click/key) so every later sound — including ones that fire with
 * no gesture, like the celebration screen on mount — plays instead of being
 * blocked by the browser autoplay policy. Safe to call repeatedly.
 */
export function unlockAudio(): void {
  const ctx = getCtx()
  if (ctx && ctx.state === 'suspended') {
    void ctx.resume().catch(() => {})
  }
}

function playNote(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  volume = 0.35,
  type: OscillatorType = 'sine'
) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.type = type
  osc.frequency.setValueAtTime(freq, startTime)

  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)

  osc.start(startTime)
  osc.stop(startTime + duration + 0.05)
}

/** Cheerful ascending ding — played on each correct answer */
export function playCorrectSound(): void {
  const ctx = getCtx()
  if (!ctx) return
  const t = ctx.currentTime
  // C5 → E5 → G5 ascending arpeggio
  playNote(ctx, 523, t, 0.18, 0.3)
  playNote(ctx, 659, t + 0.1, 0.18, 0.3)
  playNote(ctx, 784, t + 0.2, 0.25, 0.35)
}

/** Gentle soft thud — played on wrong answer (not punishing) */
export function playWrongSound(): void {
  const ctx = getCtx()
  if (!ctx) return
  const t = ctx.currentTime
  playNote(ctx, 330, t, 0.18, 0.15, 'sine')
  playNote(ctx, 294, t + 0.12, 0.22, 0.12, 'sine')
}

/** Triumphant fanfare — played on the celebration screen */
export function playCelebrationSound(): void {
  const ctx = getCtx()
  if (!ctx) return
  const t = ctx.currentTime

  // Rising arpeggio
  const notes = [523, 659, 784, 1047]
  notes.forEach((freq, i) => {
    playNote(ctx, freq, t + i * 0.1, 0.2, 0.3)
  })

  // Final chord
  ;[523, 659, 784, 1047].forEach((freq) => {
    playNote(ctx, freq, t + 0.55, 0.6, 0.2)
  })
}

/** Short star-pop sound — played when a star appears during celebration */
export function playStarSound(delayMs = 0): void {
  const ctx = getCtx()
  if (!ctx) return
  const t = ctx.currentTime + delayMs / 1000
  playNote(ctx, 880, t, 0.08, 0.2, 'sine')
  playNote(ctx, 1108, t + 0.06, 0.1, 0.18, 'sine')
}
