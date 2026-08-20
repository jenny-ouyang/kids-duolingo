/**
 * Sunrise Playground scenery (docs/design/DESIGN.md): jade hills pinned to the
 * bottom, gold sparkles, optional sun and swaying 福 lantern. Render inside a
 * `.sunrise-canvas` container, behind the screen's content (content needs z-10+).
 */
export function Hills() {
  return (
    <>
      <div className="hill-far" aria-hidden />
      <div className="hill-near" aria-hidden />
    </>
  )
}

export function Sparkles({ positions = 'default' }: { positions?: 'default' | 'sparse' }) {
  const spots =
    positions === 'sparse'
      ? [{ top: '60px', right: '26px', delay: '0s', size: '14px' }]
      : [
          { top: '30px', left: '28px', delay: '0s', size: '15px' },
          { top: '96px', right: '96px', delay: '1.1s', size: '10px' },
          { top: '170px', left: '36px', delay: '0.5s', size: '11px' },
        ]
  return (
    <>
      {spots.map((s, i) => (
        <span
          key={i}
          className="sparkle"
          aria-hidden
          style={{ ...s, animationDelay: s.delay, fontSize: s.size }}
        >
          ✦
        </span>
      ))}
    </>
  )
}

export function Sun({ scale = 1 }: { scale?: number }) {
  return (
    <div
      aria-hidden
      className="absolute top-5 right-6 rounded-full pointer-events-none"
      style={{
        width: 46 * scale,
        height: 46 * scale,
        background: '#FFCF57',
        boxShadow: '0 0 0 10px #ffcf5733, 0 0 34px #ffcf5766',
      }}
    />
  )
}

export function Lantern({ className = '' }: { className?: string }) {
  return (
    <div className={`absolute animate-sway origin-top pointer-events-none ${className}`} aria-hidden>
      <div
        className="relative w-[30px] h-[38px]"
        style={{
          background: 'linear-gradient(180deg,#F4576B,#D93B54)',
          borderRadius: '50%/44%',
          boxShadow: 'inset -5px -4px 0 #c1314a, 0 4px 12px #f4576b40',
        }}
      >
        <span
          className="absolute -top-2 left-1/2 -translate-x-1/2 w-[13px] h-[6px] rounded"
          style={{ background: '#F5B93F' }}
        />
        <span className="absolute inset-0 flex items-center justify-center font-hanzi text-[13px]" style={{ color: '#FFE9B0' }}>
          福
        </span>
      </div>
    </div>
  )
}
