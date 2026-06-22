import type { CategoryRule, DayRecord, DayUsage, Distraction, ReadingItem } from './types.ts'
import { toDateKey } from './dates.ts'
import { categorize, type CategoryTotal } from './categories.ts'

// Pure aggregation over already-loaded data. No chrome/IndexedDB access here so
// these stay trivially testable and reusable.

// ---------------------------------------------------------------------------
// Focus time
// ---------------------------------------------------------------------------

export interface UsageAnalytics {
  totalSeconds: number
  avgSeconds: number
  activeDays: number
  perDay: { date: string; seconds: number }[]
  topDomains: { domain: string; seconds: number }[]
}

export function analyzeUsage(days: DayUsage[], topN = 8): UsageAnalytics {
  const perDay = days.map((d) => ({
    date: d.date,
    seconds: Object.values(d.domains).reduce((s, v) => s + v, 0),
  }))
  const totalSeconds = perDay.reduce((s, d) => s + d.seconds, 0)
  const activeDays = perDay.filter((d) => d.seconds > 0).length

  const byDomain = new Map<string, number>()
  for (const day of days) {
    for (const [domain, seconds] of Object.entries(day.domains)) {
      byDomain.set(domain, (byDomain.get(domain) ?? 0) + seconds)
    }
  }
  const topDomains = [...byDomain.entries()]
    .map(([domain, seconds]) => ({ domain, seconds }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, topN)

  return {
    totalSeconds,
    avgSeconds: activeDays > 0 ? totalSeconds / activeDays : 0,
    activeDays,
    perDay,
    topDomains,
  }
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export interface GoalsAnalytics {
  perDay: { date: string; total: number; done: number }[]
  totalGoals: number
  totalDone: number
  completionRate: number // 0–1 over goals that were set in range
  /** Days in a row (back from today) where every goal set was completed. */
  streak: number
  daysWithAllDone: number
}

export function analyzeGoals(
  days: Record<string, DayRecord>,
  dates: string[],
): GoalsAnalytics {
  const perDay = dates.map((date) => {
    const rec = days[date]
    const total = rec?.goals.length ?? 0
    const done = rec?.goals.filter((g) => g.done).length ?? 0
    return { date, total, done }
  })

  const totalGoals = perDay.reduce((s, d) => s + d.total, 0)
  const totalDone = perDay.reduce((s, d) => s + d.done, 0)
  const daysWithAllDone = perDay.filter((d) => d.total > 0 && d.done === d.total).length

  // Walk back from the most recent day. Days with no goals set are neutral
  // (don't extend, don't break). A day with goals not all done breaks it.
  let streak = 0
  for (let i = perDay.length - 1; i >= 0; i--) {
    const d = perDay[i]
    if (d.total === 0) continue
    if (d.done === d.total) streak++
    else break
  }

  return {
    perDay,
    totalGoals,
    totalDone,
    completionRate: totalGoals > 0 ? totalDone / totalGoals : 0,
    streak,
    daysWithAllDone,
  }
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export interface ReadingAnalytics {
  reading: number
  queue: number
  done: number
  total: number
  addedInRange: number
  completedInRange: number
  recentlyDone: ReadingItem[]
}

export function analyzeReading(items: ReadingItem[], rangeStartMs: number): ReadingAnalytics {
  const reading = items.filter((i) => i.status === 'reading').length
  const queue = items.filter((i) => i.status === 'queue').length
  const doneItems = items.filter((i) => i.status === 'done')

  return {
    reading,
    queue,
    done: doneItems.length,
    total: items.length,
    addedInRange: items.filter((i) => i.addedAt >= rangeStartMs).length,
    completedInRange: doneItems.filter((i) => i.updatedAt >= rangeStartMs).length,
    recentlyDone: [...doneItems].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5),
  }
}

// ---------------------------------------------------------------------------
// Calendar heatmap
//
// One value per day for a given metric, plus the max for intensity scaling.
// Days are aligned to weeks (Sun–Sat) so the grid renders in clean columns.
// ---------------------------------------------------------------------------

export type HeatmapMetric = 'focus' | 'goals'

export interface HeatmapCell {
  date: string
  /** Normalised 0–4 intensity bucket (0 = no data). */
  level: 0 | 1 | 2 | 3 | 4
  /** Raw value (seconds for focus, 0–1 completion ratio for goals). */
  value: number
}

export interface HeatmapData {
  /** Weeks → days. Flattened in column-major order for CSS grid. */
  weeks: HeatmapCell[][]
  max: number
}

export function analyzeHeatmap(
  days: Record<string, DayRecord>,
  usageDays: DayUsage[],
  dates: string[],
  metric: HeatmapMetric,
): HeatmapData {
  const usageByDate = new Map(usageDays.map((d) => [d.date, d]))
  const values = dates.map((date) => {
    if (metric === 'focus') {
      const u = usageByDate.get(date)
      return { date, value: u ? Object.values(u.domains).reduce((s, v) => s + v, 0) : 0 }
    }
    const rec = days[date]
    const total = rec?.goals.length ?? 0
    const done = rec?.goals.filter((g) => g.done).length ?? 0
    return { date, value: total > 0 ? done / total : 0 }
  })

  const positive = values.filter((v) => v.value > 0)
  const max = positive.length > 0 ? Math.max(...positive.map((v) => v.value)) : 0

  // Bucket into 4 levels above 0.
  const level = (v: number): HeatmapCell['level'] => {
    if (v <= 0) return 0
    if (max <= 0) return 0
    const r = v / max
    if (r < 0.25) return 1
    if (r < 0.5) return 2
    if (r < 0.75) return 3
    return 4
  }

  const cells: HeatmapCell[] = values.map((v) => ({ ...v, level: level(v.value) }))

  // Align the first day to Sunday so weeks form clean columns.
  const first = cells.length > 0 ? new Date(`${cells[0].date}T00:00:00`) : new Date()
  const padFront = first.getDay() // 0=Sun … 6=Sat
  const frontPad: HeatmapCell[] = Array.from({ length: padFront }, () => ({
    date: '',
    level: 0,
    value: 0,
  }))
  const aligned = [...frontPad, ...cells]
  // Pad the tail so the last week is complete.
  while (aligned.length % 7 !== 0) aligned.push({ date: '', level: 0, value: 0 })

  const weeks: HeatmapCell[][] = []
  for (let i = 0; i < aligned.length; i += 7) weeks.push(aligned.slice(i, i + 7))

  return { weeks, max }
}

// ---------------------------------------------------------------------------
// Categories (time-by-category)
// ---------------------------------------------------------------------------

export interface CategoryAnalytics {
  perCategory: CategoryTotal[]
}

export function analyzeCategories(
  usageDays: DayUsage[],
  rules: CategoryRule[],
): CategoryAnalytics {
  const merged: Record<string, number> = {}
  for (const day of usageDays) {
    for (const [domain, s] of Object.entries(day.domains)) {
      merged[domain] = (merged[domain] ?? 0) + s
    }
  }
  return { perCategory: categorize(merged, rules) }
}

// ---------------------------------------------------------------------------
// Mood / energy check-ins
// ---------------------------------------------------------------------------

export interface CheckinAnalytics {
  perDay: { date: string; mood: number; energy: number }[]
  avgMood: number
  avgEnergy: number
  count: number
}

export function analyzeCheckins(days: Record<string, DayRecord>, dates: string[]): CheckinAnalytics {
  const perDay = dates
    .map((date) => {
      const c = days[date]?.checkin
      return c ? { date, mood: c.mood, energy: c.energy } : null
    })
    .filter((x): x is { date: string; mood: number; energy: number } => x !== null)

  const count = perDay.length
  const avgMood = count > 0 ? perDay.reduce((s, d) => s + d.mood, 0) / count : 0
  const avgEnergy = count > 0 ? perDay.reduce((s, d) => s + d.energy, 0) / count : 0

  return { perDay, avgMood, avgEnergy, count }
}

// ---------------------------------------------------------------------------
// Distraction log
// ---------------------------------------------------------------------------

export interface DistractionAnalytics {
  total: number
  byHour: number[] // length 24
  byDomain: { domain: string; count: number }[]
  perDay: { date: string; count: number }[]
  trend: { cur: number; prev: number }
}

export function analyzeDistractions(
  items: Distraction[],
  dates: string[],
): DistractionAnalytics {
  const inRange = items.filter((d) => {
    const dayKey = dates[0]
    const startMs = new Date(`${dayKey}T00:00:00`).getTime()
    return d.ts >= startMs
  })

  const byHour = new Array(24).fill(0)
  for (const d of inRange) byHour[new Date(d.ts).getHours()]++

  const domainMap = new Map<string, number>()
  for (const d of inRange) {
    const key = d.domain ?? '—'
    domainMap.set(key, (domainMap.get(key) ?? 0) + 1)
  }
  const byDomain = [...domainMap.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  const dateSet = new Set(dates)
  const perDayMap = new Map<string, number>()
  for (const d of inRange) {
    const key = toDateKey(new Date(d.ts))
    if (dateSet.has(key)) perDayMap.set(key, (perDayMap.get(key) ?? 0) + 1)
  }
  const perDay = dates.map((date) => ({ date, count: perDayMap.get(date) ?? 0 }))

  const n = dates.length
  const curDates = new Set(dates.slice(Math.max(0, n - 7)))
  const prevDates = new Set(dates.slice(Math.max(0, n - 14), Math.max(0, n - 7)))
  const cur = inRange.filter((d) => curDates.has(toDateKey(new Date(d.ts)))).length
  const prev = items.filter((d) => prevDates.has(toDateKey(new Date(d.ts)))).length

  return { total: inRange.length, byHour, byDomain, perDay, trend: { cur, prev } }
}

// ---------------------------------------------------------------------------
// Week-over-week comparison
//
// Splits the supplied daily series into the last 7 days vs the prior 7 and
// reports the deltas that matter: focus time, goal completion rate, and the
// single most distracting site this week vs last.
// ---------------------------------------------------------------------------

export interface WeekCompare {
  focusSeconds: { cur: number; prev: number; deltaPct: number | null }
  goalRate: { cur: number; prev: number; deltaPct: number | null }
  goalsDone: { cur: number; prev: number }
  topDistraction: { domain: string | null; curSeconds: number; prevSeconds: number }
}

function safeDeltaPct(cur: number, prev: number): number | null {
  if (prev === 0) return cur > 0 ? null : null
  return (cur - prev) / prev
}

export function compareWeeks(
  usageDays: DayUsage[],
  days: Record<string, DayRecord>,
  endDates: string[],
): WeekCompare {
  const n = endDates.length
  const curDates = endDates.slice(Math.max(0, n - 7))
  const prevDates = endDates.slice(Math.max(0, n - 14), Math.max(0, n - 7))

  const sumFocus = (dates: string[]) => {
    const byDate = new Map(usageDays.map((d) => [d.date, d]))
    let total = 0
    for (const date of dates) {
      const u = byDate.get(date)
      if (u) total += Object.values(u.domains).reduce((s, v) => s + v, 0)
    }
    return total
  }

  const goalRate = (dates: string[]) => {
    let total = 0
    let done = 0
    for (const date of dates) {
      const rec = days[date]
      if (!rec) continue
      total += rec.goals.length
      done += rec.goals.filter((g) => g.done).length
    }
    return total > 0 ? done / total : 0
  }

  const goalsDone = (dates: string[]) => {
    let done = 0
    for (const date of dates) {
      const rec = days[date]
      if (rec) done += rec.goals.filter((g) => g.done).length
    }
    return done
  }

  const topDistraction = (dates: string[]) => {
    const byDomain = new Map<string, number>()
    const byDate = new Map(usageDays.map((d) => [d.date, d]))
    for (const date of dates) {
      const u = byDate.get(date)
      if (!u) continue
      for (const [domain, s] of Object.entries(u.domains)) {
        byDomain.set(domain, (byDomain.get(domain) ?? 0) + s)
      }
    }
    const top = [...byDomain.entries()].sort((a, b) => b[1] - a[1])[0]
    return { domain: top?.[0] ?? null, seconds: top?.[1] ?? 0 }
  }

  const curFocus = sumFocus(curDates)
  const prevFocus = sumFocus(prevDates)
  const curRate = goalRate(curDates)
  const prevRate = goalRate(prevDates)
  const curTop = topDistraction(curDates)
  const prevTop = topDistraction(prevDates)

  return {
    focusSeconds: { cur: curFocus, prev: prevFocus, deltaPct: safeDeltaPct(curFocus, prevFocus) },
    goalRate: { cur: curRate, prev: prevRate, deltaPct: safeDeltaPct(curRate, prevRate) },
    goalsDone: { cur: goalsDone(curDates), prev: goalsDone(prevDates) },
    topDistraction: {
      domain: curTop.domain,
      curSeconds: curTop.seconds,
      prevSeconds: prevTop.seconds,
    },
  }
}
