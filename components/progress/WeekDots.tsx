const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** "Played Monday, Tuesday and Thursday. Today is Thursday." */
export function weekSentence(days: boolean[], today: number): string {
  const played = DAY_NAMES.filter((_, i) => days[i])
  const list =
    played.length === 0
      ? 'No play yet this week.'
      : `Played ${played.length > 1 ? `${played.slice(0, -1).join(', ')} and ${played[played.length - 1]}` : played[0]}.`
  return `${list} Today is ${DAY_NAMES[today]}.`
}

/**
 * This week as 7 dots, Monday first: played days teal, today ringed, a missed
 * day just an empty dot. Replaces the streak number — nothing ever resets.
 * `letters` adds the day letter under each dot (Parent Zone and report).
 */
export default function WeekDots({
  days,
  today,
  size = 14,
  letters = false,
}: {
  days: boolean[]
  today: number
  size?: number
  letters?: boolean
}) {
  return (
    <span role="img" aria-label={weekSentence(days, today)} className="inline-flex items-start gap-1.5">
      {days.map((played, i) => (
        <span key={i} className="flex flex-col items-center gap-0.5">
          <span
            className={`block rounded-full ${played ? 'bg-success' : 'bg-chip-track'} ${
              i === today ? 'ring-2 ring-offset-2 ring-success-edge ring-offset-white' : ''
            }`}
            style={{ width: size, height: size }}
          />
          {letters && <span className="text-base font-bold text-ink-mid leading-none">{DAY_LETTERS[i]}</span>}
        </span>
      ))}
    </span>
  )
}
