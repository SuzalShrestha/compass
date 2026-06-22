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
