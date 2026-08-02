import { useEffect, useMemo, useState } from 'react'
import type { Reminder } from '../../lib/types.ts'
import { quoteForDay } from '../../lib/quotes.ts'

/**
 * One quiet line at the foot of the page. Cycles the enabled reminders and the
 * day's quote through a single slot so neither needs its own block on the grid.
 */
export function Ticker({ reminders }: { reminders: Reminder[] }) {
  const lines = useMemo(() => {
    const q = quoteForDay()
    return [
      ...reminders.filter((r) => r.enabled).map((r) => ({ text: r.text, cite: '' })),
      { text: `“${q.text}”`, cite: q.source },
    ]
  }, [reminders])

  const [i, setI] = useState(0)

  useEffect(() => {
    if (lines.length <= 1) return
    const id = setInterval(() => setI((n) => (n + 1) % lines.length), 9000)
    return () => clearInterval(id)
  }, [lines.length])

  const current = lines[i % lines.length]

  return (
    <p className="ticker" key={i} title={current.text}>
      <span className="ticker-dot" aria-hidden />
      <span className="ticker-text">{current.text}</span>
      {current.cite && <cite className="ticker-cite">{current.cite}</cite>}
    </p>
  )
}
