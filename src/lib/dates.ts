/** Local-time date helpers. We key days by local YYYY-MM-DD, never UTC. */

export function toDateKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Stable integer for a date key — used to pick a deterministic daily quote. */
export function dayNumber(dateKey: string = toDateKey()): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  // Days since epoch in local terms; good enough for rotation.
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

export function greetingFor(d: Date = new Date()): string {
  const h = d.getHours()
  if (h < 5) return 'Still up'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Good night'
}

export function longDate(d: Date = new Date()): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function parseKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Date keys for the last `n` days, oldest first, ending today. */
export function lastNDates(n: number, end: Date = new Date()): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end)
    d.setDate(end.getDate() - i)
    out.push(toDateKey(d))
  }
  return out
}

/** "Jun 3" */
export function shortDate(dateKey: string): string {
  return parseKey(dateKey).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** "Mon" */
export function weekdayShort(dateKey: string): string {
  return parseKey(dateKey).toLocaleDateString(undefined, { weekday: 'short' })
}
