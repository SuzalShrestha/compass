import { useCallback, useEffect, useState } from 'react'
import {
  getAllDays,
  getCalendarCache,
  getDay,
  getDistractions,
  getFocus,
  getHabits,
  IDLE_FOCUS,
  getLongGoals,
  getNotes,
  getReading,
  getReminders,
  getSettings,
  getVaultSyncState,
  subscribe,
  type VaultSyncState,
} from './storage.ts'
import type {
  CalendarCache,
  CategoryRule,
  DayRecord,
  Distraction,
  FocusState,
  Habit,
  LongGoal,
  Note,
  Reminder,
  ReadingItem,
  Settings,
} from './types.ts'
import { lastNDates, toDateKey } from './dates.ts'
import { getUsageRange, topDomains, type DomainTotal } from './usage.ts'
import { analyzeHistory, type HistoryAnalytics } from './history.ts'
import {
  analyzeCategories,
  analyzeCheckins,
  analyzeDistractions,
  analyzeGoals,
  analyzeHeatmap,
  analyzeReading,
  analyzeUsage,
  compareWeeks,
  type CategoryAnalytics,
  type CheckinAnalytics,
  type DistractionAnalytics,
  type GoalsAnalytics,
  type HeatmapData,
  type ReadingAnalytics,
  type UsageAnalytics,
  type WeekCompare,
} from './analytics.ts'

/**
 * Re-runs `load` whenever any of the watched storage `keys` change, in any
 * extension context. Returns the latest value plus a manual `reload`.
 */
function useStored<T>(
  keys: string[],
  load: () => Promise<T>,
  initial: T,
): { value: T; reload: () => void } {
  const [value, setValue] = useState<T>(initial)

  const reload = useCallback(() => {
    let cancelled = false
    void load().then((v) => {
      if (!cancelled) setValue(v)
    })
    return () => {
      cancelled = true
    }
  }, [load])

  useEffect(() => {
    const cancel = reload()
    const unsub = subscribe(keys, reload)
    return () => {
      cancel?.()
      unsub()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, keys.join(',')])

  return { value, reload }
}

export function useDay(date: string = toDateKey()) {
  const load = useCallback(() => getDay(date), [date])
  return useStored<DayRecord>(['days'], load, { date, intention: '', goals: [] })
}

export function useReading() {
  return useStored<ReadingItem[]>(['reading'], getReading, [])
}

export function useReminders() {
  return useStored<Reminder[]>(['reminders'], getReminders, [])
}

export function useLongGoals() {
  return useStored<LongGoal[]>(['longGoals'], getLongGoals, [])
}

export function useNotes() {
  return useStored<Note[]>(['notes'], getNotes, [])
}

export function useAllDays() {
  return useStored<Record<string, DayRecord>>(['days'], getAllDays, {})
}

export function useSettings() {
  return useStored<Settings | null>(['settings'], getSettings, null)
}

export function useHabits() {
  return useStored<Habit[]>(['habits'], getHabits, [])
}

export function useFocus() {
  return useStored<FocusState>(['focus'], getFocus, IDLE_FOCUS)
}

export function useCalendarCache() {
  return useStored<CalendarCache>(['calendarCache'], getCalendarCache, {
    fetchedAt: null,
    events: [],
    errors: {},
  })
}

/** Re-renders every `ms` so clocks, countdowns and "in 5 min" labels stay fresh. */
export function useNow(ms = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

export function useDistractions() {
  return useStored<Distraction[]>(['distractions'], getDistractions, [])
}

export function useVaultSyncState() {
  return useStored<VaultSyncState>(['vaultSyncState'], getVaultSyncState, { lastSyncAt: null })
}

export function useHistory() {
  // History lives in its own IndexedDB with no change beacon, so we load once
  // per mount (the import runs in the background on install + daily).
  const [value, setValue] = useState<HistoryAnalytics | null>(null)
  useEffect(() => {
    let cancelled = false
    void analyzeHistory().then((v) => {
      if (!cancelled) setValue(v)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return value
}

export interface TimeToday {
  total: number
  items: DomainTotal[]
}

export function useTimeToday() {
  // Every domain, not a top-N slice: the home footer scans these for limit
  // breaches, and a breached site is often not one of the day's biggest.
  const load = useCallback(() => topDomains(toDateKey(), Infinity), [])
  // Refreshes whenever the background bumps `usageTick` after recording time.
  return useStored<TimeToday>(['usageTick'], load, { total: 0, items: [] })
}

export interface DashboardData {
  dates: string[]
  usage: UsageAnalytics
  goals: GoalsAnalytics
  reading: ReadingAnalytics
  heatmap: HeatmapData
  weekCompare: WeekCompare
  categories: CategoryAnalytics
  checkins: CheckinAnalytics
  distractions: DistractionAnalytics
}

/** Loads and aggregates analytics for the last `rangeDays`, live-refreshing. */
export function useDashboardData(rangeDays: number, categoryRules: CategoryRule[] = []) {
  const load = useCallback(async (): Promise<DashboardData> => {
    const dates = lastNDates(rangeDays)
    // The heatmap wants a longer horizon (90d) regardless of the selected range.
    const heatDates = lastNDates(90)
    const [usageDays, days, reading, heatUsageDays, distractions] = await Promise.all([
      getUsageRange(dates),
      getAllDays(),
      getReading(),
      getUsageRange(heatDates),
      getDistractions(),
    ])
    const rangeStartMs = new Date(`${dates[0]}T00:00:00`).getTime()
    return {
      dates,
      usage: analyzeUsage(usageDays),
      goals: analyzeGoals(days, dates),
      reading: analyzeReading(reading, rangeStartMs),
      heatmap: analyzeHeatmap(days, heatUsageDays, heatDates, 'focus'),
      weekCompare: compareWeeks(usageDays, days, dates),
      categories: analyzeCategories(usageDays, categoryRules),
      checkins: analyzeCheckins(days, dates),
      distractions: analyzeDistractions(distractions, dates),
    }
  }, [rangeDays, categoryRules])

  return useStored<DashboardData | null>(['usageTick', 'days', 'reading', 'distractions'], load, null)
}
