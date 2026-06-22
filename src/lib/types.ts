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

/** Everything tied to one calendar day. Keyed by `date` (YYYY-MM-DD). */
export interface DayRecord {
  date: string
  /** "What does winning today look like?" — one line. */
  intention: string
  goals: DailyGoal[]
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

export interface VaultSettings {
  enabled: boolean
  /** Base URL of the Obsidian Local REST API, e.g. http://127.0.0.1:27123 */
  apiBase: string
  apiKey: string
}

export interface Settings {
  name: string
  vault: VaultSettings
  quickLinks: QuickLink[]
}
