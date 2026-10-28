/**
 * Two-color ten-frames for a + b: the first `a` cells are blue circles, the
 * next `b` are plum rounded squares, the rest are empty rings. Shape and color
 * both differ, so color is never the only signal (DESIGN.md).
 */
export default function TenFrames({ a, b }: { a: number; b: number }) {
  const frames = Math.max(1, Math.ceil((a + b) / 10))
  const cells = Array.from({ length: frames * 10 }, (_, i) => (i < a ? 'a' : i < a + b ? 'b' : 'empty'))
  const full = Math.floor((a + b) / 10) * 10
  const rest = a + b - full
  const label =
    full > 0
      ? `${a} blue dots and ${b} purple squares. That makes ${full}${rest ? ` and ${rest} more` : ''}.`
      : `${a} blue dots and ${b} purple squares.`

  return (
    <div role="img" aria-label={label} className="flex flex-col gap-2 items-center">
      {Array.from({ length: frames }, (_, f) => (
        <div key={f} className="grid grid-cols-5 gap-1.5 bg-canvas-top rounded-2xl p-2">
          {cells.slice(f * 10, f * 10 + 10).map((kind, i) => (
            <span
              key={i}
              className={`w-7 h-7 ${
                kind === 'a'
                  ? 'rounded-full bg-math'
                  : kind === 'b'
                    ? 'rounded-md bg-plum'
                    : 'rounded-full border-2 border-dashed border-card-edge'
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
