'use client'

export interface PathPack {
  id: string
  name: string
  nameZh: string
  emoji: string
  wordCount: number
  learned: number
  masteryPct: number
  locked?: boolean
}

const STEP = 112 // vertical distance between stops, px
const X = [30, 68] // stop centers alternate left and right, % of the width

/** The pack the path suggests: the first started and unfinished, else the first not started */
export function suggestedIndex(packs: PathPack[]): number {
  // Same rule as the home's Play next (lib/learning-path.ts): word packs only,
  // so the sentences pack (no words, mastery always 0) is never the suggestion
  const isWordPack = (p: PathPack) => p.id !== 'sentences' && !p.locked
  const started = packs.findIndex((p) => isWordPack(p) && p.masteryPct > 0 && p.masteryPct < 100)
  if (started >= 0) return started
  const fresh = packs.findIndex((p) => isWordPack(p) && p.masteryPct === 0)
  return fresh >= 0 ? fresh : 0
}

function stateWords(pack: PathPack, isNext: boolean): string {
  if (pack.masteryPct === 100) return 'Learned'
  if (isNext) return `Next up · ${pack.learned} of ${pack.wordCount}`
  if (pack.masteryPct > 0) return `Started · ${pack.learned} of ${pack.wordCount}`
  return 'Open any time'
}

function Ring({ pct, size }: { pct: number; size: number }) {
  const r = size / 2 - 4
  const c = 2 * Math.PI * r
  return (
    <svg aria-hidden width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute -inset-[6px]" style={{ width: size, height: size }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F5E9CC" strokeWidth={6} />
      {pct > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#1FA88C"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
    </svg>
  )
}

/**
 * Packs as stops on a dotted trail, in sortOrder (6-B). One stop says
 * "Start here". No stop is locked: every stop is a button that opens its
 * session — only payment can lock a pack (🔒, then Ask a grown-up). Under each stop only the name shows (calm screen); the state in
 * words is in the button's label, and the ring and ✓ show it by shape.
 */
export default function PackPath({ packs, nextId, onOpen }: { packs: PathPack[]; nextId: string; onOpen: (pack: PathPack) => void }) {
  const next = packs.findIndex((p) => p.id === nextId)
  const height = packs.length * STEP
  // Trail through the stop centers (viewBox units: x 0–100, y px)
  const pts = packs.map((_, i) => ({ x: X[i % 2], y: i * STEP + 44 }))
  const d = pts
    .map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`
      const prev = pts[i - 1]
      const my = (prev.y + p.y) / 2
      return `C ${prev.x} ${my}, ${p.x} ${my}, ${p.x} ${p.y}`
    })
    .join(' ')

  return (
    <ol className="relative w-full" style={{ height }}>
      <svg aria-hidden className="absolute inset-0 w-full h-full" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
        <path d={d} fill="none" stroke="#F0D8A8" strokeWidth={10} strokeLinecap="round" strokeDasharray="1 18" vectorEffect="non-scaling-stroke" />
      </svg>
      {packs.map((pack, i) => {
        const isNext = i === next
        const done = pack.masteryPct === 100
        const disc = isNext ? 88 : 70
        return (
          <li
            key={pack.id}
            className="absolute flex flex-col items-center w-[132px] -translate-x-1/2"
            style={{ left: `${X[i % 2]}%`, top: i * STEP + 44 - disc / 2 }}
          >
            <button
              onClick={() => onOpen(pack)}
              aria-label={`${pack.name}, ${pack.locked ? 'locked' : stateWords(pack, isNext)}${isNext ? ', start here' : ''}`}
              className={`pressable relative rounded-full flex items-center justify-center font-emoji leading-none ${
                isNext
                  ? 'bg-chinese shadow-press-chinese text-[40px]'
                  : done
                    ? 'bg-success-bg shadow-press-success text-[32px]'
                    : 'bg-white shadow-press-card text-[32px]'
              }`}
              style={{ width: disc, height: disc, opacity: pack.locked ? 0.7 : 1 }}
            >
              <Ring pct={pack.masteryPct} size={disc + 12} />
              <span className="relative">{pack.emoji}</span>
              {pack.locked && (
                <span aria-hidden className="absolute -bottom-1 -right-1 w-[28px] h-[28px] rounded-full bg-white shadow-press-chip text-[15px] flex items-center justify-center font-emoji">
                  🔒
                </span>
              )}
              {done && (
                <span aria-hidden className="absolute -top-1 -right-1 w-[26px] h-[26px] rounded-full bg-go text-white text-[15px] font-extrabold flex items-center justify-center">
                  ✓
                </span>
              )}
            </button>
            <span className="mt-2.5 text-base font-extrabold text-ink leading-tight text-center">{pack.name}</span>
            {isNext && (
              <span
                aria-hidden
                className={`absolute top-6 whitespace-nowrap bg-white rounded-[14px] px-2.5 py-0.5 text-[15px] font-extrabold text-chinese-edge shadow-[0_4px_0_#F5B93F] ${
                  i % 2 === 0 ? 'left-[112px]' : 'right-[112px]'
                }`}
              >
                {i % 2 === 0 ? <><span className="font-emoji">👈</span> Start here</> : <>Start here <span className="font-emoji">👉</span></>}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
