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
      className={`pressable font-pinyin min-h-[44px] rounded-full px-4 py-1.5 text-base font-extrabold select-none transition-colors duration-200 ${
        on ? 'bg-chinese-edge text-white shadow-press-chinese' : 'bg-white text-chinese-edge shadow-press-chip'
      }`}
    >
      pīn
    </button>
  )
}
