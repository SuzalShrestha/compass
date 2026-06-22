import { openDB, type IDBPDatabase } from 'idb'
import type { DayUsage } from './types.ts'
import { toDateKey } from './dates.ts'

// ---------------------------------------------------------------------------
// Time-tracking store.
//
// Usage is time-series data, so it lives in IndexedDB (one record per day)
// rather than chrome.storage. IndexedDB has no cross-context change events, so
// writers bump a `usageTick` value in chrome.storage.local — the new-tab
// dashboard subscribes to that and re-reads.
// ---------------------------------------------------------------------------

const DB_NAME = 'compass'
const STORE = 'usage'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase> | null = null

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE)) {
          database.createObjectStore(STORE, { keyPath: 'date' })
        }
      },
    })
  }
  return dbPromise
}

function emptyDay(date: string): DayUsage {
  return { date, domains: {} }
}

export async function getDayUsage(date: string = toDateKey()): Promise<DayUsage> {
  const record = (await (await db()).get(STORE, date)) as DayUsage | undefined
  return record ?? emptyDay(date)
}

/** Add `seconds` of active time to `domain` on `date`. */
export async function addUsage(date: string, domain: string, seconds: number): Promise<void> {
  if (seconds <= 0) return
  const database = await db()
  const tx = database.transaction(STORE, 'readwrite')
  const record = ((await tx.store.get(date)) as DayUsage | undefined) ?? emptyDay(date)
  const next: DayUsage = {
    date,
    domains: { ...record.domains, [domain]: (record.domains[domain] ?? 0) + seconds },
  }
  await tx.store.put(next)
  await tx.done
}

export async function getDomainSeconds(date: string, domain: string): Promise<number> {
  const day = await getDayUsage(date)
  return day.domains[domain] ?? 0
}

export interface DomainTotal {
  domain: string
  seconds: number
}

export async function topDomains(
  date: string = toDateKey(),
  limit = 6,
): Promise<{ total: number; items: DomainTotal[] }> {
  const day = await getDayUsage(date)
  const items = Object.entries(day.domains)
    .map(([domain, seconds]) => ({ domain, seconds }))
    .sort((a, b) => b.seconds - a.seconds)
  const total = items.reduce((sum, i) => sum + i.seconds, 0)
  return { total, items: items.slice(0, limit) }
}
