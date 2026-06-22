import { useCallback, useEffect, useState } from 'react'
import {
  getDay,
  getReading,
  getReminders,
  getSettings,
  subscribe,
} from './storage.ts'
import type { DayRecord, Reminder, ReadingItem, Settings } from './types.ts'
import { toDateKey } from './dates.ts'

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

export function useSettings() {
  return useStored<Settings | null>(['settings'], getSettings, null)
}
