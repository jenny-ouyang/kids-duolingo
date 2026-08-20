/**
 * The panda guide (docs/design/DESIGN.md). Idle-bobs with a speech bubble.
 * Emoji rendering uses the emoji font stack for Windows/Android parity.
 */
export default function Mascot({
  say = '你好!',
  size = 74,
  className = '',
}: {
  say?: string | null
  size?: number
  className?: string
}) {
  return (
    <div className={`text-center relative z-10 ${className}`}>
      <span
        className="inline-block animate-bob font-emoji"
        style={{ fontSize: size, filter: 'drop-shadow(0 8px 14px #d9973c33)' }}
        role="img"
        aria-label="panda guide"
      >
        🐼
      </span>
      {say && (
        <span
          className="inline-block bg-white rounded-2xl rounded-bl px-3.5 py-1.5 font-bold text-sm relative -top-8 left-1.5"
          style={{ color: '#7A4F1D', boxShadow: '0 4px 0 #F5B93F' }}
        >
          {say}
        </span>
      )}
    </div>
  )
}
