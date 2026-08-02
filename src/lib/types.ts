// Shared domain types for Compass.
// Storage is keyed by these shapes; phases 3–4 (time tracking, dashboard)
// extend this file rather than reworking it.

/** A single checklist item for a given day. */
export interface DailyGoal {
  id: string
  text: string
  done: boolean
  createdAt: number
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
}

/** Everything tied to one calendar day. Keyed by `date` (YYYY-MM-DD). */
export interface DayRecord {
  date: string
  /** "What does winning today look like?" — one line. */
  intention: string
  goals: DailyGoal[]
  /** Optional morning check-in. Additive — older records simply lack it. */
  checkin?: { mood: number; energy: number; ts: number }
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
  addedAt: number
  updatedAt: number
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
