import type {
  CalendarCache,
  DailyGoal,
  DayRecord,
  Distraction,
  FocusState,
  Habit,
  LongGoal,
  Milestone,
  Note,
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

export async function readAll(keys: string[]): Promise<Bag> {
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

export async function writeAll(values: Bag): Promise<void> {
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
  longGoals: 'longGoals',
  notes: 'notes',
  habits: 'habits',
  focus: 'focus',
  calendarCache: 'calendarCache',
} as const

/** Every key that holds user data — what backups and exports cover. */
export const DATA_KEYS = [
  KEYS.days,
  KEYS.reading,
  KEYS.reminders,
  KEYS.settings,
  KEYS.distractions,
  KEYS.longGoals,
  KEYS.notes,
  KEYS.habits,
] as const

export function uid(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
}

// ---------------------------------------------------------------------------
// Serialized writes
//
// Every mutation is read → modify → write. Two quick clicks used to race: both
// read the same old list and the second write dropped the first change. All
// writes in this context now go through one promise chain, so each sees the
// previous one's result.
// ponytail: per-context queue only. The background and a new tab can still
// interleave on the same key; route writes through the service worker if that
// ever shows up in practice.
// ---------------------------------------------------------------------------

let queue: Promise<unknown> = Promise.resolve()

function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn)
  queue = run.catch(() => undefined)
  return run
}

async function mutate<T>(key: string, fallback: T, fn: (current: T) => T): Promise<T> {
  return serial(async () => {
    const bag = await readAll([key])
    const next = fn((bag[key] as T | undefined) ?? fallback)
    await writeAll({ [key]: next })
    return next
  })
}

/**
 * Capture a key's current value and return a function that puts it back.
 * Powers "Undo" on destructive actions; anything written to the same key in
 * between is rolled back too, which is fine for a few-second undo window.
 */
export async function snapshotKey(key: string): Promise<() => Promise<void>> {
  const bag = await readAll([key])
  const before = bag[key]
  return () => serial(() => writeAll({ [key]: before }))
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** The v0.2 default accent; migrated to the new default on update. */
const LEGACY_ACCENT = '#6B7686'

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
  // Warm terracotta — reads as human rather than corporate, and holds 4.5:1
  // against white for text on buttons.
  accent: '#B4532A',
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
  calendars: [],
  readingGoal: 12,
  focus: { focusMinutes: 25, breakMinutes: 5 },
}

const DEFAULT_REMINDERS: Reminder[] = [
  { id: 'r1', text: "Don't doomscroll. You opened this tab for a reason.", enabled: true },
  { id: 'r2', text: 'Closed tabs are free. Open one task at a time.', enabled: true },
  { id: 'r3', text: 'Build something today, not just consume.', enabled: true },
  { id: 'r4', text: 'Drink water. Sit up straight. Breathe.', enabled: true },
]

/** One-off data upgrades, run by the background on install/update. Idempotent. */
export async function migrate(): Promise<void> {
  await mutate<Partial<Settings>>(KEYS.settings, {}, (s) =>
    s.accent?.toLowerCase() === LEGACY_ACCENT.toLowerCase()
      ? { ...s, accent: DEFAULT_SETTINGS.accent }
      : s,
  )
}

// ---------------------------------------------------------------------------
// Days / tasks / intention
//
// "Goals" in the per-day record are the day's tasks; the name is kept for
// storage compatibility with existing data and the vault journal.
// ---------------------------------------------------------------------------

const emptyDay = (date: string): DayRecord => ({ date, intention: '', goals: [] })

export async function getDay(date: string = toDateKey()): Promise<DayRecord> {
  const days = await getAllDays()
  return days[date] ?? emptyDay(date)
}

export async function getAllDays(): Promise<Record<string, DayRecord>> {
  const bag = await readAll([KEYS.days])
  return (bag[KEYS.days] as Record<string, DayRecord>) ?? {}
}

async function mutateDays(
  fn: (days: Record<string, DayRecord>) => Record<string, DayRecord>,
): Promise<void> {
  await mutate<Record<string, DayRecord>>(KEYS.days, {}, fn)
}

async function mutateDay(date: string, fn: (day: DayRecord) => DayRecord): Promise<void> {
  await mutateDays((days) => ({ ...days, [date]: fn(days[date] ?? emptyDay(date)) }))
}

function patchGoal(date: string, id: string, fn: (g: DailyGoal) => DailyGoal) {
  return mutateDay(date, (day) => ({
    ...day,
    goals: day.goals.map((g) => (g.id === id ? fn(g) : g)),
  }))
}

export async function setIntention(date: string, intention: string): Promise<void> {
  await mutateDay(date, (day) => ({ ...day, intention }))
}

export async function setReflection(date: string, reflection: string): Promise<void> {
  await mutateDay(date, (day) => ({ ...day, reflection }))
}

export async function addGoal(
  date: string,
  text: string,
  extra: Partial<Pick<DailyGoal, 'priority' | 'goalId'>> = {},
): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) return
  const goal: DailyGoal = { id: uid(), text: trimmed, done: false, createdAt: Date.now(), ...extra }
  await mutateDay(date, (day) => ({ ...day, goals: [...day.goals, goal] }))
}

export async function toggleGoal(date: string, id: string): Promise<void> {
  await patchGoal(date, id, (g) => ({ ...g, done: !g.done, doneAt: !g.done ? Date.now() : undefined }))
}

export async function editGoal(date: string, id: string, text: string): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) return
  await patchGoal(date, id, (g) => ({ ...g, text: trimmed }))
}

export async function updateGoal(
  date: string,
  id: string,
  patch: Partial<Pick<DailyGoal, 'priority' | 'goalId'>>,
): Promise<void> {
  await patchGoal(date, id, (g) => ({ ...g, ...patch }))
}

export async function removeGoal(date: string, id: string): Promise<void> {
  await mutateDay(date, (day) => ({ ...day, goals: day.goals.filter((g) => g.id !== id) }))
}

export async function setCheckin(
  date: string,
  checkin: { mood: number; energy: number },
): Promise<void> {
  await mutateDay(date, (day) => ({ ...day, checkin: { ...checkin, ts: Date.now() } }))
}

export async function addFocusMinutes(date: string, minutes: number): Promise<void> {
  await mutateDay(date, (day) => ({ ...day, focusMinutes: (day.focusMinutes ?? 0) + minutes }))
}

export interface CarryItem {
  date: string
  goal: DailyGoal
}

/**
 * Unfinished tasks from the last `lookback` days that haven't been carried
 * forward yet, newest day first. Pure — the home page asks this once a day.
 */
export function findCarryOver(
  days: Record<string, DayRecord>,
  today: string,
  lookback = 7,
): CarryItem[] {
  const start = new Date(`${today}T00:00:00`)
  start.setDate(start.getDate() - lookback)
  const floor = toDateKey(start)
  return Object.keys(days)
    .filter((d) => d < today && d >= floor)
    .sort()
    .reverse()
    .flatMap((date) =>
      days[date].goals.filter((g) => !g.done && !g.movedTo).map((goal) => ({ date, goal })),
    )
}

/** Copy unfinished tasks onto `today` and mark the originals as moved. */
export async function carryOver(today: string, items: CarryItem[]): Promise<void> {
  if (items.length === 0) return
  const ids = new Set(items.map((i) => i.goal.id))
  await mutateDays((days) => {
    const next = { ...days }
    for (const date of new Set(items.map((i) => i.date))) {
      const day = next[date]
      if (!day) continue
      next[date] = {
        ...day,
        goals: day.goals.map((g) => (ids.has(g.id) ? { ...g, movedTo: today } : g)),
      }
    }
    const target = next[today] ?? emptyDay(today)
    const copies: DailyGoal[] = items.map(({ goal }) => ({
      id: uid(),
      text: goal.text,
      done: false,
      createdAt: Date.now(),
      priority: goal.priority,
      goalId: goal.goalId,
    }))
    next[today] = { ...target, goals: [...target.goals, ...copies] }
    return next
  })
}

/** Leave old unfinished tasks where they are, but stop offering to carry them. */
export async function dismissCarryOver(items: CarryItem[]): Promise<void> {
  const ids = new Set(items.map((i) => i.goal.id))
  await mutateDays((days) => {
    const next = { ...days }
    for (const date of new Set(items.map((i) => i.date))) {
      const day = next[date]
      if (!day) continue
      next[date] = {
        ...day,
        goals: day.goals.map((g) => (ids.has(g.id) ? { ...g, movedTo: 'dismissed' } : g)),
      }
    }
    return next
  })
}

// ---------------------------------------------------------------------------
// Long-term goals
//
// These persist across days — they stay on the home page until marked done
// (and then cleared). Stored at the top level like the reading list, not
// inside a per-day record, so a new day does not wipe them.
// ---------------------------------------------------------------------------

export async function getLongGoals(): Promise<LongGoal[]> {
  const bag = await readAll([KEYS.longGoals])
  return (bag[KEYS.longGoals] as LongGoal[]) ?? []
}

function mutateLongGoals(fn: (goals: LongGoal[]) => LongGoal[]) {
  return mutate<LongGoal[]>(KEYS.longGoals, [], fn)
}

function patchLongGoal(id: string, fn: (g: LongGoal) => LongGoal) {
  return mutateLongGoals((goals) => goals.map((g) => (g.id === id ? fn(g) : g)))
}

export async function addLongGoal(
  text: string,
  extra: Partial<Pick<LongGoal, 'targetDate' | 'why'>> = {},
): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) return
  const goal: LongGoal = { id: uid(), text: trimmed, done: false, createdAt: Date.now(), ...extra }
  await mutateLongGoals((goals) => [goal, ...goals])
}

export async function toggleLongGoal(id: string): Promise<void> {
  await patchLongGoal(id, (g) => ({
    ...g,
    done: !g.done,
    completedAt: !g.done ? Date.now() : undefined,
  }))
}

export async function updateLongGoal(
  id: string,
  patch: Partial<Pick<LongGoal, 'text' | 'targetDate' | 'why'>>,
): Promise<void> {
  await patchLongGoal(id, (g) => ({ ...g, ...patch }))
}

export async function removeLongGoal(id: string): Promise<void> {
  await mutateLongGoals((goals) => goals.filter((g) => g.id !== id))
}

export async function clearCompletedLongGoals(): Promise<void> {
  await mutateLongGoals((goals) => goals.filter((g) => !g.done))
}

export async function addMilestone(goalId: string, text: string): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) return
  const m: Milestone = { id: uid(), text: trimmed, done: false }
  await patchLongGoal(goalId, (g) => ({ ...g, milestones: [...(g.milestones ?? []), m] }))
}

export async function toggleMilestone(goalId: string, id: string): Promise<void> {
  await patchLongGoal(goalId, (g) => ({
    ...g,
    milestones: g.milestones?.map((m) => (m.id === id ? { ...m, done: !m.done } : m)),
  }))
}

export async function removeMilestone(goalId: string, id: string): Promise<void> {
  await patchLongGoal(goalId, (g) => ({
    ...g,
    milestones: g.milestones?.filter((m) => m.id !== id),
  }))
}

/** 0–1. Milestones drive it; a goal without any is simply 0 or 1. */
export function goalProgress(goal: LongGoal): number {
  if (goal.done) return 1
  const ms = goal.milestones ?? []
  if (ms.length === 0) return 0
  return ms.filter((m) => m.done).length / ms.length
}

// ---------------------------------------------------------------------------
// Reading hub
// ---------------------------------------------------------------------------

export async function getReading(): Promise<ReadingItem[]> {
  const bag = await readAll([KEYS.reading])
  return (bag[KEYS.reading] as ReadingItem[]) ?? []
}

function mutateReading(fn: (items: ReadingItem[]) => ReadingItem[]) {
  return mutate<ReadingItem[]>(KEYS.reading, [], fn)
}

export type NewReadingItem = Pick<ReadingItem, 'title'> &
  Partial<
    Pick<ReadingItem, 'kind' | 'url' | 'author' | 'status' | 'progress' | 'source' | 'pageTotal'>
  >

export async function addReadingItem(input: NewReadingItem): Promise<ReadingItem> {
  const now = Date.now()
  const fresh: ReadingItem = {
    id: uid(),
    kind: input.kind ?? 'article',
    title: input.title.trim() || input.url || 'Untitled',
    url: input.url,
    author: input.author?.trim() || undefined,
    status: input.status ?? 'queue',
    progress: input.progress,
    pageTotal: input.pageTotal,
    source: input.source ?? (input.url ? safeHost(input.url) : undefined),
    addedAt: now,
    updatedAt: now,
  }
  let result = fresh
  await mutateReading((items) => {
    // De-dupe saved pages by URL instead of adding the same link twice.
    const existing = input.url ? items.find((i) => i.url === input.url) : undefined
    if (existing) {
      result = existing
      return items
    }
    return [fresh, ...items]
  })
  return result
}

/** Keep `progress` in sync with pages, and stamp `finishedAt` on completion. */
export function applyReadingPatch(item: ReadingItem, patch: Partial<ReadingItem>): ReadingItem {
  const next = { ...item, ...patch, updatedAt: Date.now() }
  if (next.pageTotal && next.pageTotal > 0 && next.pageCurrent != null) {
    next.pageCurrent = Math.max(0, Math.min(next.pageCurrent, next.pageTotal))
    next.progress = Math.round((next.pageCurrent / next.pageTotal) * 100)
  }
  if (patch.status === 'done' && item.status !== 'done') {
    next.finishedAt = Date.now()
    next.progress = 100
    if (next.pageTotal) next.pageCurrent = next.pageTotal
  } else if (patch.status && patch.status !== 'done') {
    next.finishedAt = undefined
  }
  if (patch.status === 'reading' && item.status === 'queue' && next.progress == null) {
    next.progress = 0
  }
  return next
}

export async function updateReadingItem(
  id: string,
  patch: Partial<ReadingItem>,
): Promise<void> {
  await mutateReading((items) => items.map((i) => (i.id === id ? applyReadingPatch(i, patch) : i)))
}

export async function removeReadingItem(id: string): Promise<void> {
  await mutateReading((items) => items.filter((i) => i.id !== id))
}

function safeHost(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// Habits
// ---------------------------------------------------------------------------

export async function getHabits(): Promise<Habit[]> {
  const bag = await readAll([KEYS.habits])
  return (bag[KEYS.habits] as Habit[]) ?? []
}

function mutateHabits(fn: (habits: Habit[]) => Habit[]) {
  return mutate<Habit[]>(KEYS.habits, [], fn)
}

export async function addHabit(name: string, emoji?: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) return
  const habit: Habit = { id: uid(), name: trimmed, emoji: emoji?.trim() || undefined, createdAt: Date.now(), log: {} }
  await mutateHabits((habits) => [...habits, habit])
}

export async function toggleHabit(id: string, date: string = toDateKey()): Promise<void> {
  await mutateHabits((habits) =>
    habits.map((h) => {
      if (h.id !== id) return h
      const log = { ...h.log }
      if (log[date]) delete log[date]
      else log[date] = true
      return { ...h, log }
    }),
  )
}

export async function removeHabit(id: string): Promise<void> {
  await mutateHabits((habits) => habits.filter((h) => h.id !== id))
}

/**
 * Consecutive days done, ending today. A streak stays alive through today
 * until midnight — not ticking it yet this morning shouldn't read as broken.
 */
export function habitStreak(habit: Habit, today: string = toDateKey()): number {
  const d = new Date(`${today}T00:00:00`)
  if (!habit.log[today]) d.setDate(d.getDate() - 1)
  let n = 0
  while (habit.log[toDateKey(d)]) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

// ---------------------------------------------------------------------------
// Focus timer + calendar cache (plain state blobs)
// ---------------------------------------------------------------------------

export const IDLE_FOCUS: FocusState = { status: 'idle', kind: 'focus', minutes: 25 }

export async function getFocus(): Promise<FocusState> {
  const bag = await readAll([KEYS.focus])
  return (bag[KEYS.focus] as FocusState) ?? IDLE_FOCUS
}

export async function saveFocus(state: FocusState): Promise<void> {
  await serial(() => writeAll({ [KEYS.focus]: state }))
}

export async function getCalendarCache(): Promise<CalendarCache> {
  const bag = await readAll([KEYS.calendarCache])
  return (bag[KEYS.calendarCache] as CalendarCache) ?? { fetchedAt: null, events: [], errors: {} }
}

export async function saveCalendarCache(cache: CalendarCache): Promise<void> {
  await serial(() => writeAll({ [KEYS.calendarCache]: cache }))
}

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

export async function getReminders(): Promise<Reminder[]> {
  const bag = await readAll([KEYS.reminders])
  return (bag[KEYS.reminders] as Reminder[]) ?? DEFAULT_REMINDERS
}

export async function saveReminders(reminders: Reminder[]): Promise<void> {
  await serial(() => writeAll({ [KEYS.reminders]: reminders }))
}

// ---------------------------------------------------------------------------
// Notes (scratchpad list)
// ---------------------------------------------------------------------------

export async function getNotes(): Promise<Note[]> {
  const bag = await readAll([KEYS.notes])
  return (bag[KEYS.notes] as Note[]) ?? []
}

function mutateNotes(fn: (notes: Note[]) => Note[]) {
  return mutate<Note[]>(KEYS.notes, [], fn)
}

export async function addNote(text: string): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) return
  const note: Note = { id: uid(), text: trimmed, updatedAt: Date.now() }
  await mutateNotes((notes) => [note, ...notes])
}

export async function updateNote(id: string, text: string): Promise<void> {
  await mutateNotes((notes) =>
    notes.map((n) => (n.id === id ? { ...n, text, updatedAt: Date.now() } : n)),
  )
}

export async function removeNote(id: string): Promise<void> {
  await mutateNotes((notes) => notes.filter((n) => n.id !== id))
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
  const d: Distraction = {
    id: uid(),
    ts: Date.now(),
    domain: input.domain,
    note: input.note,
  }
  await mutate<Distraction[]>(KEYS.distractions, [], (items) => [d, ...items])
}

export async function clearDistractions(): Promise<void> {
  await serial(() => writeAll({ [KEYS.distractions]: [] }))
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function withSettingsDefaults(stored: Partial<Settings>): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    vault: { ...DEFAULT_SETTINGS.vault, ...stored.vault },
    tracking: { ...DEFAULT_SETTINGS.tracking, ...stored.tracking },
    focus: { ...DEFAULT_SETTINGS.focus, ...stored.focus },
    quickLinks: stored.quickLinks ?? DEFAULT_SETTINGS.quickLinks,
    limits: stored.limits ?? DEFAULT_SETTINGS.limits,
    theme: stored.theme ?? DEFAULT_SETTINGS.theme,
    accent: stored.accent ?? DEFAULT_SETTINGS.accent,
    categoryRules: stored.categoryRules ?? DEFAULT_SETTINGS.categoryRules,
    calendars: stored.calendars ?? DEFAULT_SETTINGS.calendars,
    readingGoal: stored.readingGoal ?? DEFAULT_SETTINGS.readingGoal,
  }
}

export async function getSettings(): Promise<Settings> {
  const bag = await readAll([KEYS.settings])
  return withSettingsDefaults((bag[KEYS.settings] as Partial<Settings>) ?? {})
}

export async function saveSettings(settings: Settings): Promise<void> {
  await serial(() => writeAll({ [KEYS.settings]: settings }))
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
