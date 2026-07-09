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
// enough (one search + ~maxUrlsToProbe getVisits calls) to not need incremental
// logic.
//
// Lifetime totals + the top-domains ranking are computed from every domain
// returned by the search (not just the probed ones), so the headline numbers
// are accurate even though per-month granularity is only stored for the
// busiest domains. Global insight aggregates (weekday pattern, 30-day trend,
// peak month) are built from the probed visits, which are dominated by the
// top sites and so are a representative sample.
// ---------------------------------------------------------------------------

const DB_NAME = 'compass-history'
const STORE = 'records'
const DB_VERSION = 1

export interface HistoryRecord {
  domain: string
  /** Lifetime visit count across all URLs on this domain. */
  totalVisits: number
  /** Visits per month, keyed 'YYYY-MM'. Empty when this domain wasn't probed. */
  monthly: Record<string, number>
  updatedAt: number
}

/** Global aggregates built during the visit probe, persisted as `__insights__`. */
export interface HistoryInsights {
  /** Visits per day-of-week, 0=Sunday … 6=Saturday. From the probed sample. */
  weekday: number[]
  /** Earliest probed-visit timestamp, ms. Used for avg visits/day. */
  firstVisitTs: number | null
  /** Probed visits in the last 30 days vs the prior 30. */
  last30: number
  prev30: number
  /** Distinct calendar days that have at least one probed visit. */
  daysActive: number
  /** Month with the most probed visits. */
  peakMonth: { month: string; visits: number } | null
  updatedAt: number
}

export interface HistoryAnalytics {
  topDomains: { domain: string; totalVisits: number }[]
  monthly: { month: string; visits: number }[]
  totalVisits: number
  monthsCovered: number
  importedAt: number | null
  // Insights —
  /** Lifetime total visits / days since the first probed visit. */
  avgPerDay: number
  /** Same shape as HistoryInsights.weekday. */
  weekday: number[]
  /** 0–6, day-of-week with the most visits over the probed sample. */
  weekdayPeak: number
  last30: number
  prev30: number
  /** 30-day % change. `null` when prev30 is zero. */
  trend30: number | null
  peakMonth: { month: string; visits: number } | null
  /** Distinct days with any probed visit. */
  daysActive: number
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

const DAY = 24 * 60 * 60 * 1000

const hasHistory = typeof chrome !== 'undefined' && !!chrome.history

/**
 * Scan Chrome history and persist per-domain totals + monthly buckets plus
 * global insight aggregates. Returns the number of domains written.
 * No-op (returns 0) outside the extension or when the history permission isn't
 * granted.
 */
export async function importHistory(maxUrlsToProbe = 150): Promise<number> {
  if (!hasHistory) return 0

  // Pull everything (maxResults caps at ~1000 per call; 10000 is the API max).
  const items = await chrome.history.search({ text: '', startTime: 0, maxResults: 10000 })

  // Aggregate lifetime visitCount per domain, and remember a few URLs per
  // domain for monthly probing.
  const byDomain = new Map<string, { totalVisits: number; urls: string[] }>()
  for (const item of items) {
    if (!item.url) continue
    const domain = domainOf(item.url)
    if (!domain) continue
    const entry = byDomain.get(domain) ?? { totalVisits: 0, urls: [] }
    entry.totalVisits += item.visitCount || 0
    // Keep up to 5 URLs (prefer higher-visit ones) for monthly probing.
    if (entry.urls.length < 5) entry.urls.push(item.url)
    byDomain.set(domain, entry)
  }

  // Probe the top domains by visit count for monthly + insight granularity.
  const topForProbe = [...byDomain.entries()]
    .sort((a, b) => b[1].totalVisits - a[1].totalVisits)
    .slice(0, maxUrlsToProbe)

  // Build a record for EVERY domain (lifetime totals for an accurate ranking).
  // Per-month buckets are only filled for the probed (top) domains.
  const probedDomains = new Set<string>()
  const records: HistoryRecord[] = []
  const now = Date.now()

  // Global insight accumulators.
  const weekday = [0, 0, 0, 0, 0, 0, 0]
  const globalMonthly = new Map<string, number>()
  const daySet = new Set<string>()
  let firstVisitTs: number | null = null
  let last30 = 0
  let prev30 = 0
  let peakMonth: { month: string; visits: number } | null = null

  for (const [domain] of topForProbe) probedDomains.add(domain)

  for (const [domain, info] of byDomain) {
    const rec: HistoryRecord = { domain, totalVisits: info.totalVisits, monthly: {}, updatedAt: now }
    if (probedDomains.has(domain)) {
      const monthly: Record<string, number> = {}
      for (const url of info.urls) {
        try {
          const visits = await chrome.history.getVisits({ url })
          for (const v of visits) {
            if (!v.visitTime) continue
            const mk = monthKey(v.visitTime)
            monthly[mk] = (monthly[mk] ?? 0) + 1
            globalMonthly.set(mk, (globalMonthly.get(mk) ?? 0) + 1)
            const dow = new Date(v.visitTime).getDay()
            weekday[dow]++
            const dayKey = toDateKeyFromMs(v.visitTime)
            daySet.add(dayKey)
            if (firstVisitTs == null || v.visitTime < firstVisitTs) firstVisitTs = v.visitTime
            const ageDays = (now - v.visitTime) / DAY
            if (ageDays < 30) last30++
            else if (ageDays < 60) prev30++
          }
        } catch {
          // URL may have been pruned between search and getVisits — skip.
        }
      }
      rec.monthly = monthly
    }
    records.push(rec)
  }

  // Peak month from the global monthly map.
  for (const [month, visits] of globalMonthly) {
    if (!peakMonth || visits > peakMonth.visits) peakMonth = { month, visits }
  }

  const database = await db()
  const tx = database.transaction(STORE, 'readwrite')
  await tx.store.clear()
  for (const r of records) await tx.store.put(r)
  await tx.store.put({
    domain: '__import__',
    totalVisits: 0,
    monthly: {},
    updatedAt: now,
  } as HistoryRecord)
  const insights: HistoryInsights = {
    weekday,
    firstVisitTs,
    last30,
    prev30,
    daysActive: daySet.size,
    peakMonth,
    updatedAt: now,
  }
  await tx.store.put({ domain: '__insights__', totalVisits: 0, monthly: {}, ...insights } as HistoryRecord & HistoryInsights)
  await tx.done

  return records.length
}

function toDateKeyFromMs(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function getAllRecords(): Promise<HistoryRecord[]> {
  const database = await db()
  const all = (await database.getAll(STORE)) as HistoryRecord[]
  return all.filter((r) => r.domain !== '__import__' && r.domain !== '__insights__')
}

async function getSentinel(domain: string): Promise<(HistoryRecord & Partial<HistoryInsights>) | undefined> {
  const database = await db()
  return (await database.get(STORE, domain)) as (HistoryRecord & Partial<HistoryInsights>) | undefined
}

export async function analyzeHistory(): Promise<HistoryAnalytics> {
  const records = await getAllRecords()
  const importSentinel = await getSentinel('__import__')
  const insightsSentinel = await getSentinel('__insights__')
  const importedAt = importSentinel?.updatedAt ?? null

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

  // Insights — fall back to empty when no probe has run yet.
  const weekday = insightsSentinel?.weekday ?? [0, 0, 0, 0, 0, 0, 0]
  const firstVisitTs = insightsSentinel?.firstVisitTs ?? null
  const last30 = insightsSentinel?.last30 ?? 0
  const prev30 = insightsSentinel?.prev30 ?? 0
  const daysActive = insightsSentinel?.daysActive ?? 0
  const peakMonth = insightsSentinel?.peakMonth ?? null

  const daysSinceFirst =
    firstVisitTs != null ? Math.max(1, Math.round((Date.now() - firstVisitTs) / DAY)) : 0
  const avgPerDay = daysSinceFirst > 0 ? totalVisits / daysSinceFirst : 0
  const weekdayPeak = weekday.indexOf(Math.max(0, ...weekday))

  return {
    topDomains,
    monthly,
    totalVisits,
    monthsCovered: monthlyMap.size,
    importedAt,
    avgPerDay,
    weekday,
    weekdayPeak,
    last30,
    prev30,
    trend30: prev30 > 0 ? (last30 - prev30) / prev30 : null,
    peakMonth,
    daysActive,
  }
}