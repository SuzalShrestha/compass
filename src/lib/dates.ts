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

/** ISO-8601 week number (weeks start Monday; week 1 contains the first Thursday). */
export function isoWeek(d: Date = new Date()): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  // Shift to the Thursday of this week, then count weeks from Jan 1.
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
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

/** "Monday, June 3" — for selected-day labels. */
export function mediumDate(dateKey: string): string {
  return parseKey(dateKey).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

/** Month grid: date keys for all cells (incl. leading/trailing padding). */
export function monthGrid(year: number, month: number): (string | null)[] {
  // month is 0-indexed. Week starts on Monday to match common productivity UIs.
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // JS getDay(): 0=Sun … 6=Sat → shift so Mon=0 … Sun=6
  const startPad = (first.getDay() + 6) % 7
  const cells: (string | null)[] = []
  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(toDateKey(new Date(year, month, d)))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}
