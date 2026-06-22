import type { DayRecord, ReadingItem, VaultSettings } from './types.ts'

// ---------------------------------------------------------------------------
// Obsidian Local REST API client.
//
// Talks to the "Local REST API" community plugin. Default base is plain HTTP on
// port 27123 (the HTTPS server on 27124 uses a self-signed cert that the
// extension can't trust without extra setup). All writes here are append-only —
// we never overwrite the user's raw notes.
//
// Every call returns a VaultResult instead of throwing, so callers can surface
// a friendly status without try/catch noise.
// ---------------------------------------------------------------------------

export interface VaultResult {
  ok: boolean
  status?: number
  error?: string
}

/** Managed note that Compass appends saved reading items to. */
export const READING_NOTE = 'knowledge/learning/reading-list.md'

function authHeaders(s: VaultSettings, contentType?: string): HeadersInit {
  const h: Record<string, string> = { Authorization: `Bearer ${s.apiKey}` }
  if (contentType) h['Content-Type'] = contentType
  return h
}

/** Encode a vault path while preserving the folder separators. */
function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

function configError(s: VaultSettings): VaultResult | null {
  if (!s.enabled) return { ok: false, error: 'Vault sync is off' }
  if (!s.apiKey) return { ok: false, error: 'Missing API key' }
  if (!s.apiBase) return { ok: false, error: 'Missing API base URL' }
  return null
}

async function request(
  s: VaultSettings,
  method: string,
  path: string,
  body?: string,
  contentType?: string,
): Promise<VaultResult> {
  const bad = configError(s)
  if (bad) return bad
  const url = `${s.apiBase.replace(/\/$/, '')}${path}`
  try {
    const res = await fetch(url, {
      method,
      headers: authHeaders(s, contentType),
      body,
    })
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}` }
    }
    return { ok: true, status: res.status }
  } catch (e) {
    // Almost always: plugin not running, wrong port, or HTTP server disabled.
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' }
  }
}

/** Is the API reachable and the key accepted? */
export async function pingVault(s: VaultSettings): Promise<VaultResult> {
  return request(s, 'GET', '/')
}

/** Append markdown to the end of a note, creating it if it doesn't exist. */
export async function appendToNote(
  s: VaultSettings,
  path: string,
  markdown: string,
): Promise<VaultResult> {
  return request(s, 'POST', `/vault/${encodePath(path)}`, markdown, 'text/markdown')
}

function readingLine(item: ReadingItem): string {
  const link = item.url ? `[${item.title}](${item.url})` : item.title
  const meta = [
    item.author,
    item.source,
    `saved ${new Date(item.addedAt).toISOString().slice(0, 10)}`,
  ]
    .filter(Boolean)
    .join(' · ')
  return `- [ ] ${link}${meta ? ` — _${meta}_` : ''}`
}

/** Push a single saved reading item to the reading-list note. */
export async function syncReadingItem(
  s: VaultSettings,
  item: ReadingItem,
): Promise<VaultResult> {
  return appendToNote(s, READING_NOTE, `\n${readingLine(item)}`)
}

/** Append the day's intention + goals to that day's journal note. */
export async function syncDay(s: VaultSettings, day: DayRecord): Promise<VaultResult> {
  const lines = [
    `\n## Compass — ${day.date}`,
    day.intention ? `**Intention:** ${day.intention}` : '',
    ...day.goals.map((g) => `- [${g.done ? 'x' : ' '}] ${g.text}`),
    '',
  ].filter(Boolean)
  return appendToNote(s, `records/journal/${day.date}.md`, lines.join('\n'))
}
