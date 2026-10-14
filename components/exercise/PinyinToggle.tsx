'use client'

interface PinyinToggleProps {
  on: boolean
  onToggle: () => void
}

/** "pīn" hint chip — pinyin stays hidden until the child asks for it */
export default function PinyinToggle({ on, onToggle }: PinyinToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      aria-label={on ? 'Hide pinyin' : 'Show pinyin'}
      className={`pressable rounded-full px-4 py-1.5 text-sm font-extrabold tracking-wide select-none transition-colors duration-200 ${
        on ? 'bg-chinese text-white shadow-press-chinese' : 'bg-white text-chinese shadow-press-chip'
      }`}
    >
      pīn
    </button>
  )
}
