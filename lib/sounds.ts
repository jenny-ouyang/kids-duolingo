/**
 * All sounds generated via Web Audio API — no files needed.
 */

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  return new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
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
