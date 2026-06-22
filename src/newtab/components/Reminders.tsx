import { useEffect, useMemo, useState } from 'react'
import type { Reminder } from '../../lib/types.ts'

/** Rotating nudge. Cycles through enabled reminders every 8 seconds. */
export function Reminders({ reminders }: { reminders: Reminder[] }) {
  const enabled = useMemo(() => reminders.filter((r) => r.enabled), [reminders])
  const [i, setI] = useState(0)

  useEffect(() => {
    if (enabled.length <= 1) return
    const id = setInterval(() => setI((n) => (n + 1) % enabled.length), 8000)
    return () => clearInterval(id)
  }, [enabled.length])

  if (enabled.length === 0) return null
  const current = enabled[i % enabled.length]

  return (
    <div className="reminder" key={current.id}>
      <span className="dot" />
      <span>{current.text}</span>
    </div>
  )
}
