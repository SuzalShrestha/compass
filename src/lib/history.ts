import { openDB, type IDBPDatabase } from 'idb'
import { domainOf } from './tracker.ts'

// ---------------------------------------------------------------------------
// Chrome history import + insights.
//
// chrome.history.search gives lifetime visitCount per URL but not per-month.
// For the monthly trend we call getVisits on the top URLs (capped) and bucket
// each visit's time into YYYY-MM. Results land in IndexedDB so the dashboard
// reads them without re-scanning history every time.
//
// A full re-import runs on install and once a day via an alarm; it's cheap
// enough (one search + ~150 getVisits calls) to not need incremental logic.
// ---------------------------------------------------------------------------

const DB_NAME = 'compass-history'
const STORE = 'records'
const DB_VERSION = 1

export interface HistoryRecord {
  domain: string
  /** Lifetime visit count across all URLs on this domain. */
  totalVisits: number
  /** Visits per month, keyed 'YYYY-MM'. */
  monthly: Record<string, number>
  updatedAt: number
}

export interface HistoryAnalytics {
  topDomains: { domain: string; totalVisits: number }[]
  monthly: { month: string; visits: number }[]
  totalVisits: number
  monthsCovered: number
  importedAt: number | null
}

let dbPromise: Promise<IDBPDatabase> | null = null

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE)) {
          database.createObjectStore(STORE, { keyPath: 'domain' })
        }
      },
    })
  }
  return dbPromise
}

function monthKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const hasHistory = typeof chrome !== 'undefined' && !!chrome.history

/**
 * Scan Chrome history and persist per-domain totals + monthly buckets.
 * Returns the number of domains written. No-op (returns 0) outside the
 * extension or when the history permission isn't granted.
 */
export async function importHistory(maxUrlsToProbe = 150): Promise<number> {
  if (!hasHistory) return 0

  // Pull everything (maxResults caps at ~1000 per call; 10000 is the API max).
  const items = await chrome.history.search({ text: '', startTime: 0, maxResults: 10000 })

  // Aggregate lifetime visitCount per domain, and remember the top URLs to
  // probe for monthly granularity.
  const byDomain = new Map<string, { totalVisits: number; urls: string[] }>()
  for (const item of items) {
    if (!item.url) continue
    const domain = domainOf(item.url)
    if (!domain) continue
    const entry = byDomain.get(domain) ?? { totalVisits: 0, urls: [] }
    entry.totalVisits += item.visitCount || 0
    // Keep the highest-visit URLs for monthly probing.
    if (entry.urls.length < 5) entry.urls.push(item.url)
    byDomain.set(domain, entry)
  }

  // Probe the top domains by visit count for monthly granularity.
  const topForProbe = [...byDomain.entries()]
    .sort((a, b) => b[1].totalVisits - a[1].totalVisits)
    .slice(0, maxUrlsToProbe)

  const records: HistoryRecord[] = []
  for (const [domain, info] of topForProbe) {
    const monthly: Record<string, number> = {}
    for (const url of info.urls) {
      try {
        const visits = await chrome.history.getVisits({ url })
        for (const v of visits) {
          if (!v.visitTime) continue
          const mk = monthKey(v.visitTime)
          monthly[mk] = (monthly[mk] ?? 0) + 1
        }
      } catch {
        // URL may have been pruned between search and getVisits — skip.
      }
    }
    records.push({ domain, totalVisits: info.totalVisits, monthly, updatedAt: Date.now() })
  }

  const database = await db()
  const tx = database.transaction(STORE, 'readwrite')
  await tx.store.clear()
  for (const r of records) await tx.store.put(r)
  await tx.done

  // Record the import timestamp in a sentinel row.
  await database.put(STORE, {
    domain: '__import__',
    totalVisits: 0,
    monthly: {},
    updatedAt: Date.now(),
  } as HistoryRecord)

  return records.length
}

async function getAllRecords(): Promise<HistoryRecord[]> {
  const database = await db()
  const all = (await database.getAll(STORE)) as HistoryRecord[]
  return all.filter((r) => r.domain !== '__import__')
}

async function getImportedAt(): Promise<number | null> {
  const database = await db()
  const sentinel = (await database.get(STORE, '__import__')) as HistoryRecord | undefined
  return sentinel?.updatedAt ?? null
}

export async function analyzeHistory(): Promise<HistoryAnalytics> {
  const records = await getAllRecords()
  const importedAt = await getImportedAt()

  const topDomains = records
    .map((r) => ({ domain: r.domain, totalVisits: r.totalVisits }))
    .sort((a, b) => b.totalVisits - a.totalVisits)
    .slice(0, 10)

  const monthlyMap = new Map<string, number>()
  let totalVisits = 0
  for (const r of records) {
    totalVisits += r.totalVisits
    for (const [month, count] of Object.entries(r.monthly)) {
      monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + count)
    }
  }

  const monthly = [...monthlyMap.entries()]
    .map(([month, visits]) => ({ month, visits }))
    .sort((a, b) => a.month.localeCompare(b.month))
    // Keep the most recent 24 months for the sparkline.
    .slice(-24)

  return {
    topDomains,
    monthly,
    totalVisits,
    monthsCovered: monthlyMap.size,
    importedAt,
  }
}
