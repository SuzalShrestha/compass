// Shared domain types for Compass.
// Storage is keyed by these shapes. New fields are always optional so data
// written by older versions keeps loading without a migration.

/** A single checklist item for a given day. */
export interface DailyGoal {
  id: string
  text: string
  done: boolean
  createdAt: number
  /** Flagged as one of the day's important tasks — sorts to the top. */
  priority?: boolean
  /** Long-term goal this task moves forward. */
  goalId?: string
  doneAt?: number
  /** Set on an unfinished task that was carried over to a later day. */
  movedTo?: string
}

/**
 * A long-term goal that persists across days until completed (and removed).
 * Unlike `DailyGoal`, these are not keyed by date — they stay on the home page
 * every day until you mark them done and clear them.
 */
export interface LongGoal {
  id: string
  text: string
  done: boolean
  createdAt: number
  /** Set when the goal was checked off, for sorting / archive display. */
  completedAt?: number
  /** Optional deadline, YYYY-MM-DD. */
  targetDate?: string
  /** One line on why this matters — shown under the goal as a nudge. */
  why?: string
  /** Steps toward the goal. Progress is derived from these. */
  milestones?: Milestone[]
}

export interface Milestone {
  id: string
  text: string
  done: boolean
}

/** Everything tied to one calendar day. Keyed by `date` (YYYY-MM-DD). */
export interface DayRecord {
  date: string
  /** "What does winning today look like?" — one line. */
  intention: string
  goals: DailyGoal[]
  /** Optional morning check-in. Additive — older records simply lack it. */
  checkin?: { mood: number; energy: number; ts: number }
  /** Minutes of completed focus sessions. */
  focusMinutes?: number
  /** Evening reflection — one line on how the day went. */
  reflection?: string
}

export type ReadingKind = 'book' | 'article'
export type ReadingStatus = 'reading' | 'queue' | 'done'

/** A book, article, or saved page in the reading hub. */
export interface ReadingItem {
  id: string
  kind: ReadingKind
  title: string
  url?: string
  author?: string
  status: ReadingStatus
  /** 0–100, used for books that are currently being read. */
  progress?: number
  /** Hostname the item was saved from, when applicable. */
  source?: string
  /** Books: page tracking. When both are set, `progress` is derived from them. */
  pageCurrent?: number
  pageTotal?: number
  /** 1–5 stars, set when finished. */
  rating?: number
  finishedAt?: number
  addedAt: number
  updatedAt: number
}

/** A daily habit. `log` holds the date keys it was done on. */
export interface Habit {
  id: string
  name: string
  emoji?: string
  createdAt: number
  log: Record<string, true>
}

/** Pomodoro-style timer. Lives in storage so it survives the tab closing. */
export interface FocusState {
  status: 'idle' | 'running' | 'paused'
  kind: 'focus' | 'break'
  /** Epoch ms the running timer ends at. */
  endsAt?: number
  /** Ms left when paused. */
  remaining?: number
  /** Full length of the current session, minutes. */
  minutes: number
  /** What the session is for — usually a task. */
  label?: string
}

/** A subscribed calendar feed (the "secret address in iCal format"). */
export interface CalendarFeed {
  id: string
  name: string
  url: string
  color: string
  enabled: boolean
}

/** One concrete occurrence of a calendar event (recurrences are pre-expanded). */
export interface CalEvent {
  id: string
  feedId: string
  title: string
  /** Epoch ms. All-day events start at local midnight. */
  start: number
  end: number
  allDay: boolean
  location?: string
}

export interface CalendarCache {
  fetchedAt: number | null
  events: CalEvent[]
  /** Last error per feed id; absent when the feed fetched fine. */
  errors: Record<string, string>
}

/** A rotating nudge shown in the reminders strip. */
export interface Reminder {
  id: string
  text: string
  enabled: boolean
}

/** A quick-link shortcut. */
export interface QuickLink {
  id: string
  label: string
  url: string
}

/** A freeform scratch note. */
export interface Note {
  id: string
  text: string
  updatedAt: number
}

export interface VaultSettings {
  enabled: boolean
  /** Base URL of the Obsidian Local REST API, e.g. http://127.0.0.1:27123 */
  apiBase: string
  apiKey: string
}

/** A per-day time budget for a distracting site, by bare hostname. */
export interface SiteLimit {
  domain: string
  minutes: number
  enabled: boolean
}

export interface TrackingSettings {
  enabled: boolean
}

/** 'auto' follows the OS preference. */
export type ThemeMode = 'auto' | 'light' | 'dark'

export interface Settings {
  name: string
  vault: VaultSettings
  quickLinks: QuickLink[]
  tracking: TrackingSettings
  limits: SiteLimit[]
  /** Swiss theme override. `auto` defers to prefers-color-scheme. */
  theme: ThemeMode
  /** Strong accent hex, applied via --accent. Near-monochrome default. */
  accent: string
  /** Domain → category rules for time-by-category analytics. */
  categoryRules: CategoryRule[]
  calendars: CalendarFeed[]
  /** Books to finish this year. 0 hides the counter. */
  readingGoal: number
  focus: { focusMinutes: number; breakMinutes: number }
}

/** One day's accumulated active time per domain, in seconds. Stored in IndexedDB. */
export interface DayUsage {
  date: string
  domains: Record<string, number>
}

/** A logged "I caught myself" distraction slip. Stored in chrome.storage. */
export interface Distraction {
  id: string
  ts: number
  domain?: string
  note?: string
}

/** A domain → category mapping rule. Domains match by suffix (e.g. "x.com"). */
export interface CategoryRule {
  domain: string
  category: Category
}

export type Category = 'social' | 'work' | 'reading' | 'learning' | 'entertainment' | 'other'
