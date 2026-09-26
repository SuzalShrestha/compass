import { openDB, type IDBPDatabase } from 'idb'
import { DATA_KEYS, readAll, writeAll } from './storage.ts'
import { toDateKey } from './dates.ts'
import type { Settings } from './types.ts'

// ---------------------------------------------------------------------------
// Backups.
//
// 1. Daily snapshots: the background copies every user-data key into its own
//    IndexedDB once a day and keeps the last KEEP. One bad write or a mistaken
//    "clear" is then at most a day of lost work, restorable from Settings.
// 2. Export / import: a JSON file you keep yourself. Exports leave out the
//    Obsidian API key, since these files tend to end up in synced folders.
// ---------------------------------------------------------------------------

const DB_NAME = 'compass-backups'
const STORE = 'snapshots'
const KEEP = 14

export interface Snapshot {
  /** YYYY-MM-DD, or YYYY-MM-DD-before-restore for the safety copy. */
  id: string
  ts: number
  data: Record<string, unknown>
}

export interface ExportFile {
  app: 'compass'
  version: 1
  exportedAt: string
  data: Record<string, unknown>
}

let dbPromise: Promise<IDBPDatabase> | null = null

function db(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, 1, {
    upgrade(database) {
      database.createObjectStore(STORE, { keyPath: 'id' })
    },
  })
  return dbPromise
}

async function currentData(): Promise<Record<string, unknown>> {
  return readAll([...DATA_KEYS])
}

export async function takeSnapshot(id: string = toDateKey()): Promise<void> {
  const d = await db()
  await d.put(STORE, { id, ts: Date.now(), data: await currentData() } satisfies Snapshot)
  const all = ((await d.getAll(STORE)) as Snapshot[]).sort((a, b) => b.ts - a.ts)
  for (const old of all.slice(KEEP)) await d.delete(STORE, old.id)
}

/** Take today's snapshot unless one already exists. */
export async function ensureDailySnapshot(): Promise<void> {
  const d = await db()
  if (!(await d.get(STORE, toDateKey()))) await takeSnapshot()
}

export async function listSnapshots(): Promise<Snapshot[]> {
  const all = (await (await db()).getAll(STORE)) as Snapshot[]
  return all.sort((a, b) => b.ts - a.ts)
}

export async function restoreSnapshot(id: string): Promise<void> {
  const snap = (await (await db()).get(STORE, id)) as Snapshot | undefined
  if (!snap) throw new Error('That snapshot no longer exists.')
  await takeSnapshot(`${toDateKey()}-before-restore`)
  await writeAll(pickDataKeys(snap.data))
}

export async function exportData(): Promise<ExportFile> {
  const data = await currentData()
  const settings = data.settings as Partial<Settings> | undefined
  if (settings?.vault) data.settings = { ...settings, vault: { ...settings.vault, apiKey: '' } }
  return { app: 'compass', version: 1, exportedAt: new Date().toISOString(), data }
}

const SHAPES: Record<(typeof DATA_KEYS)[number], 'array' | 'object'> = {
  days: 'object',
  reading: 'array',
  reminders: 'array',
  settings: 'object',
  distractions: 'array',
  longGoals: 'array',
  notes: 'array',
  habits: 'array',
}

function pickDataKeys(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of DATA_KEYS) {
    const v = data[key]
    if (v === undefined) continue
    const ok = SHAPES[key] === 'array' ? Array.isArray(v) : v !== null && typeof v === 'object' && !Array.isArray(v)
    if (ok) out[key] = v
  }
  return out
}

/**
 * Validate an export file and write it over current data. Takes a safety
 * snapshot first, and keeps the current vault API key (exports never carry
 * one). Returns the keys that were restored.
 */
export async function importData(raw: unknown): Promise<string[]> {
  const file = raw as Partial<ExportFile> | null
  if (!file || file.app !== 'compass' || typeof file.data !== 'object' || file.data === null) {
    throw new Error("This isn't a Compass export file.")
  }
  const data = pickDataKeys(file.data)
  const keys = Object.keys(data)
  if (keys.length === 0) throw new Error('The file has no Compass data in it.')

  const incoming = data.settings as Partial<Settings> | undefined
  if (incoming?.vault && !incoming.vault.apiKey) {
    const { settings: current } = (await readAll(['settings'])) as { settings?: Partial<Settings> }
    const apiKey = current?.vault?.apiKey ?? ''
    data.settings = { ...incoming, vault: { ...incoming.vault, apiKey } }
  }

  await takeSnapshot(`${toDateKey()}-before-restore`)
  await writeAll(data)
  return keys
}
