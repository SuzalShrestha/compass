import type {
  DailyGoal,
  DayRecord,
  Distraction,
  Reminder,
  ReadingItem,
  Settings,
} from './types.ts'
import { toDateKey } from './dates.ts'

// ---------------------------------------------------------------------------
// Low-level adapter
//
// Uses chrome.storage.local when running as an extension, and falls back to
// window.localStorage so the pages still work when opened directly in a normal
// Vite dev tab. Both expose the same async get/set/subscribe surface, and
// change events propagate across extension contexts (newtab / popup /
// background) so the UI stays live without manual refresh wiring.
// ---------------------------------------------------------------------------

type Bag = Record<string, unknown>

const hasChrome = typeof chrome !== 'undefined' && !!chrome.storage?.local

async function readAll(keys: string[]): Promise<Bag> {
  if (hasChrome) {
    return (await chrome.storage.local.get(keys)) as Bag
  }
  const out: Bag = {}
  for (const k of keys) {
    const raw = localStorage.getItem(`compass:${k}`)
    if (raw != null) out[k] = JSON.parse(raw)
  }
  return out
}

async function writeAll(values: Bag): Promise<void> {
  if (hasChrome) {
    await chrome.storage.local.set(values)
    return
  }
  for (const [k, v] of Object.entries(values)) {
    localStorage.setItem(`compass:${k}`, JSON.stringify(v))
  }
  // Mirror chrome.storage.onChanged for same-document subscribers in dev.
  window.dispatchEvent(new CustomEvent('compass:changed', { detail: values }))
}

/** Subscribe to changes for the given keys. Returns an unsubscribe function. */
export function subscribe(keys: string[], cb: () => void): () => void {
  if (hasChrome) {
    const handler = (changes: Record<string, unknown>, area: string) => {
      if (area === 'local' && keys.some((k) => k in changes)) cb()
    }
    chrome.storage.onChanged.addListener(handler)
    return () => chrome.storage.onChanged.removeListener(handler)
  }
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail as Bag
    if (keys.some((k) => k in detail)) cb()
  }
  window.addEventListener('compass:changed', handler)
  // Cross-tab updates in dev.
  const storageHandler = (e: StorageEvent) => {
    if (e.key && keys.some((k) => `compass:${k}` === e.key)) cb()
  }
  window.addEventListener('storage', storageHandler)
  return () => {
    window.removeEventListener('compass:changed', handler)
    window.removeEventListener('storage', storageHandler)
  }
}

const KEYS = {
  days: 'days',
  reading: 'reading',
  reminders: 'reminders',
  settings: 'settings',
  distractions: 'distractions',
} as const

function uid(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  vault: {
    enabled: false,
    apiBase: 'http://127.0.0.1:27123',
    apiKey: '',
  },
  quickLinks: [
    { id: 'gh', label: 'GitHub', url: 'https://github.com' },
    { id: 'gmail', label: 'Gmail', url: 'https://mail.google.com' },
    { id: 'cal', label: 'Calendar', url: 'https://calendar.google.com' },
  ],
  tracking: { enabled: true },
  limits: [],
  theme: 'auto',
  // Cool muted slate — near-monochrome, developer-ish, easy on the eye in both
  // light and dark. A touch brighter dark variant is handled in CSS.
  accent: '#6B7686',
  categoryRules: [
    { domain: 'x.com', category: 'social' },
    { domain: 'twitter.com', category: 'social' },
    { domain: 'instagram.com', category: 'social' },
    { domain: 'reddit.com', category: 'social' },
    { domain: 'facebook.com', category: 'social' },
    { domain: 'linkedin.com', category: 'social' },
    { domain: 'youtube.com', category: 'entertainment' },
    { domain: 'netflix.com', category: 'entertainment' },
    { domain: 'twitch.tv', category: 'entertainment' },
    { domain: 'github.com', category: 'work' },
    { domain: 'gitlab.com', category: 'work' },
    { domain: 'linear.app', category: 'work' },
    { domain: 'notion.so', category: 'work' },
    { domain: 'gmail.com', category: 'work' },
    { domain: 'medium.com', category: 'reading' },
    { domain: 'substack.com', category: 'reading' },
    { domain: 'wikipedia.org', category: 'learning' },
    { domain: 'stackoverflow.com', category: 'learning' },
    { domain: 'docs.python.org', category: 'learning' },
    { domain: 'developer.mozilla.org', category: 'learning' },
  ],
}

const DEFAULT_REMINDERS: Reminder[] = [
  { id: 'r1', text: "Don't doomscroll. You opened this tab for a reason.", enabled: true },
  { id: 'r2', text: 'Closed tabs are free. Open one task at a time.', enabled: true },
  { id: 'r3', text: 'Build something today, not just consume.', enabled: true },
  { id: 'r4', text: 'Drink water. Sit up straight. Breathe.', enabled: true },
]

// ---------------------------------------------------------------------------
// Days / goals / intention
// ---------------------------------------------------------------------------

export async function getDay(date: string = toDateKey()): Promise<DayRecord> {
  const bag = await readAll([KEYS.days])
  const days = (bag[KEYS.days] as Record<string, DayRecord>) ?? {}
  return days[date] ?? { date, intention: '', goals: [] }
}

export async function getAllDays(): Promise<Record<string, DayRecord>> {
  const bag = await readAll([KEYS.days])
  return (bag[KEYS.days] as Record<string, DayRecord>) ?? {}
}

async function saveDay(record: DayRecord): Promise<void> {
  const bag = await readAll([KEYS.days])
  const days = (bag[KEYS.days] as Record<string, DayRecord>) ?? {}
  await writeAll({ [KEYS.days]: { ...days, [record.date]: record } })
}

export async function setIntention(date: string, intention: string): Promise<void> {
  const day = await getDay(date)
  await saveDay({ ...day, intention })
}

export async function addGoal(date: string, text: string): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) return
  const day = await getDay(date)
  const goal: DailyGoal = { id: uid(), text: trimmed, done: false, createdAt: Date.now() }
  await saveDay({ ...day, goals: [...day.goals, goal] })
}

export async function toggleGoal(date: string, id: string): Promise<void> {
  const day = await getDay(date)
  await saveDay({
    ...day,
    goals: day.goals.map((g) => (g.id === id ? { ...g, done: !g.done } : g)),
  })
}

export async function removeGoal(date: string, id: string): Promise<void> {
  const day = await getDay(date)
  await saveDay({ ...day, goals: day.goals.filter((g) => g.id !== id) })
}

export async function setCheckin(
  date: string,
  checkin: { mood: number; energy: number },
): Promise<void> {
  const day = await getDay(date)
  await saveDay({ ...day, checkin: { ...checkin, ts: Date.now() } })
}

// ---------------------------------------------------------------------------
// Reading hub
// ---------------------------------------------------------------------------

export async function getReading(): Promise<ReadingItem[]> {
  const bag = await readAll([KEYS.reading])
  return (bag[KEYS.reading] as ReadingItem[]) ?? []
}

async function saveReading(items: ReadingItem[]): Promise<void> {
  await writeAll({ [KEYS.reading]: items })
}

export type NewReadingItem = Pick<ReadingItem, 'title'> &
  Partial<Pick<ReadingItem, 'kind' | 'url' | 'author' | 'status' | 'progress' | 'source'>>

export async function addReadingItem(input: NewReadingItem): Promise<ReadingItem> {
  const items = await getReading()
  // De-dupe saved pages by URL — bump it back to the queue instead of duplicating.
  if (input.url) {
    const existing = items.find((i) => i.url === input.url)
    if (existing) return existing
  }
  const now = Date.now()
  const item: ReadingItem = {
    id: uid(),
    kind: input.kind ?? 'article',
    title: input.title.trim() || input.url || 'Untitled',
    url: input.url,
    author: input.author,
    status: input.status ?? 'queue',
    progress: input.progress,
    source: input.source ?? (input.url ? safeHost(input.url) : undefined),
    addedAt: now,
    updatedAt: now,
  }
  await saveReading([item, ...items])
  return item
}

export async function updateReadingItem(
  id: string,
  patch: Partial<ReadingItem>,
): Promise<void> {
  const items = await getReading()
  await saveReading(
    items.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: Date.now() } : i)),
  )
}

export async function removeReadingItem(id: string): Promise<void> {
  const items = await getReading()
  await saveReading(items.filter((i) => i.id !== id))
}

function safeHost(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

export async function getReminders(): Promise<Reminder[]> {
  const bag = await readAll([KEYS.reminders])
  return (bag[KEYS.reminders] as Reminder[]) ?? DEFAULT_REMINDERS
}

export async function saveReminders(reminders: Reminder[]): Promise<void> {
  await writeAll({ [KEYS.reminders]: reminders })
}

// ---------------------------------------------------------------------------
// Distraction log
// ---------------------------------------------------------------------------

export async function getDistractions(): Promise<Distraction[]> {
  const bag = await readAll([KEYS.distractions])
  return (bag[KEYS.distractions] as Distraction[]) ?? []
}

export async function addDistraction(
  input: Pick<Distraction, 'domain'> & Partial<Pick<Distraction, 'note'>>,
): Promise<void> {
  const items = await getDistractions()
  const d: Distraction = {
    id: uid(),
    ts: Date.now(),
    domain: input.domain,
    note: input.note,
  }
  await writeAll({ [KEYS.distractions]: [d, ...items] })
}

export async function clearDistractions(): Promise<void> {
  await writeAll({ [KEYS.distractions]: [] })
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function getSettings(): Promise<Settings> {
  const bag = await readAll([KEYS.settings])
  const stored = (bag[KEYS.settings] as Partial<Settings>) ?? {}
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    vault: { ...DEFAULT_SETTINGS.vault, ...stored.vault },
    tracking: { ...DEFAULT_SETTINGS.tracking, ...stored.tracking },
    quickLinks: stored.quickLinks ?? DEFAULT_SETTINGS.quickLinks,
    limits: stored.limits ?? DEFAULT_SETTINGS.limits,
    theme: stored.theme ?? DEFAULT_SETTINGS.theme,
    accent: stored.accent ?? DEFAULT_SETTINGS.accent,
    categoryRules: stored.categoryRules ?? DEFAULT_SETTINGS.categoryRules,
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await writeAll({ [KEYS.settings]: settings })
}

// ---------------------------------------------------------------------------
// Time-tracking state (background-only)
//
// `usageTick` is a lightweight change beacon: writers bump it after recording
// usage so the dashboard (which reads IndexedDB) knows to refresh. `session`
// and `trackerState` survive service-worker suspension by living in storage
// rather than module memory.
// ---------------------------------------------------------------------------

/** The active-domain segment currently being timed. */
export interface TrackerSession {
  domain: string | null
  since: number
}

/** Per-day escalation bookkeeping so we don't re-notify or re-block endlessly. */
export interface TrackerState {
  date: string
  /** Highest escalation stage we've already notified about, per domain. */
  notified: Record<string, number>
  /** Timestamp (ms) until which the overlay is snoozed, per domain. */
  snooze: Record<string, number>
}

export async function pingUsage(): Promise<void> {
  await writeAll({ usageTick: Date.now() })
}

export async function getSession(): Promise<TrackerSession | null> {
  const bag = await readAll(['session'])
  return (bag['session'] as TrackerSession) ?? null
}

export async function setSession(session: TrackerSession | null): Promise<void> {
  await writeAll({ session })
}

export async function getTrackerState(date: string): Promise<TrackerState> {
  const bag = await readAll(['trackerState'])
  const stored = bag['trackerState'] as TrackerState | undefined
  if (!stored || stored.date !== date) {
    return { date, notified: {}, snooze: {} }
  }
  return stored
}

export async function setTrackerState(state: TrackerState): Promise<void> {
  await writeAll({ trackerState: state })
}

// ---------------------------------------------------------------------------
// Vault sync state
//
// Remembers the last sync run so the settings panel can show "synced 2h ago"
// and the background can decide whether the 4h cadence has elapsed.
// ---------------------------------------------------------------------------

export interface VaultSyncState {
  lastSyncAt: number | null
  lastReport?: {
    ok: boolean
    error?: string
    readingPushed: number
    readingReconciled: number
    booksPushed: number
    booksReconciled: number
  }
}

export async function getVaultSyncState(): Promise<VaultSyncState> {
  const bag = await readAll(['vaultSyncState'])
  return (bag['vaultSyncState'] as VaultSyncState) ?? { lastSyncAt: null }
}

export async function setVaultSyncState(state: VaultSyncState): Promise<void> {
  await writeAll({ vaultSyncState: state })
}
