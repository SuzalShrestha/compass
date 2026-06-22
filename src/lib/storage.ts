import type {
  DailyGoal,
  DayRecord,
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
// Settings
// ---------------------------------------------------------------------------

export async function getSettings(): Promise<Settings> {
  const bag = await readAll([KEYS.settings])
  const stored = (bag[KEYS.settings] as Partial<Settings>) ?? {}
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    vault: { ...DEFAULT_SETTINGS.vault, ...stored.vault },
    quickLinks: stored.quickLinks ?? DEFAULT_SETTINGS.quickLinks,
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await writeAll({ [KEYS.settings]: settings })
}
