import { useEffect, useState } from 'react'
import { greetingFor, longDate } from '../../lib/dates.ts'

export function Header({
  name,
  onOpenSettings,
  onOpenDashboard,
}: {
  name: string
  onOpenSettings: () => void
  onOpenDashboard: () => void
}) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 30)
    return () => clearInterval(id)
  }, [])

  const time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

  return (
    <header className="header">
      <div>
        <h1 className="greeting">
          {greetingFor(now)}
          {name ? `, ${name}` : ''}.
        </h1>
        <div className="date">{longDate(now)}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div className="clock">{time}</div>
        <button className="icon-btn" title="Dashboard" onClick={onOpenDashboard}>
          📊
        </button>
        <button className="icon-btn" title="Settings" onClick={onOpenSettings}>
          ⚙
        </button>
      </div>
    </header>
  )
}
