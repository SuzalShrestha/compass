import type { DayRecord, ReadingItem, VaultSettings } from './types.ts'
import { bookNotePath, slugify } from './vault-parsers.ts'

// ---------------------------------------------------------------------------
// Obsidian Local REST API client.
//
// Talks to the "Local REST API" community plugin. Default base is plain HTTP on
// port 27123 (the HTTPS server on 27124 uses a self-signed cert that the
// extension can't trust without extra setup). Reading-list and journal writes
// are append-only; book notes are PUT (Compass owns those files). We never
// overwrite a human-edited reading-list or journal note.
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
/** Managed note that highlight captures append to. */
export const HIGHLIGHTS_NOTE = 'knowledge/learning/highlights.md'

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
  accept?: string,
): Promise<VaultResult> {
  const bad = configError(s)
  if (bad) return bad
  const url = `${s.apiBase.replace(/\/$/, '')}${path}`
  try {
    const headers: Record<string, string> = { Authorization: `Bearer ${s.apiKey}` }
    if (contentType) headers['Content-Type'] = contentType
    if (accept) headers['Accept'] = accept
    const res = await fetch(url, { method, headers, body })
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}` }
    }
    return { ok: true, status: res.status }
  } catch (e) {
    // Almost always: plugin not running, wrong port, or HTTP server disabled.
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' }
  }
}

/** GET a note's body as markdown. Returns the text in `data`. */
export async function getNote(
  s: VaultSettings,
  path: string,
): Promise<VaultResult & { data?: string }> {
  const bad = configError(s)
  if (bad) return bad
  const url = `${s.apiBase.replace(/\/$/, '')}/vault/${encodePath(path)}`
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${s.apiKey}`, Accept: 'text/markdown' },
    })
    if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` }
    const data = await res.text()
    return { ok: true, status: res.status, data }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' }
  }
}

/** PUT (overwrite) a note's body. Used for book notes Compass owns. */
export async function putNote(
  s: VaultSettings,
  path: string,
  markdown: string,
): Promise<VaultResult> {
  const bad = configError(s)
  if (bad) return bad
  const url = `${s.apiBase.replace(/\/$/, '')}/vault/${encodePath(path)}`
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${s.apiKey}`, 'Content-Type': 'text/markdown' },
      body: markdown,
    })
    if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` }
    return { ok: true, status: res.status }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' }
  }
}

/** List files under a vault directory. Returns filenames in `data`. */
export async function listDir(
  s: VaultSettings,
  path: string,
): Promise<VaultResult & { data?: string[] }> {
  const bad = configError(s)
  if (bad) return bad
  const url = `${s.apiBase.replace(/\/$/, '')}/vault/${encodePath(path)}/`
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${s.apiKey}`, Accept: 'application/vnd.olrapi.dir+json' },
    })
    if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` }
    const json = (await res.json()) as { files?: { path: string }[] } | string[]
    const files = Array.isArray(json) ? json : (json.files ?? []).map((f) => f.path)
    return { ok: true, status: res.status, data: files }
  } catch (e) {
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

/** Append a captured highlight (quote) with its source to the highlights note. */
export async function syncHighlight(
  s: VaultSettings,
  quote: string,
  source: { url?: string; title?: string },
): Promise<VaultResult> {
  const link = source.url ? `[${source.title ?? source.url}](${source.url})` : (source.title ?? '')
  const body = `\n> ${quote.replace(/\n/g, '\n> ')}\n\n— ${link}\n`
  return appendToNote(s, HIGHLIGHTS_NOTE, body)
}

/**
 * Build the markdown body for a book note. Compass owns these files (PUT, not
 * append), so the format is fully specified here and round-trips through
 * `parseBookNote`.
 */
export function bookNoteBody(item: ReadingItem): string {
  const lines = [
    '---',
    `status: ${item.status}`,
    item.kind === 'book' && typeof item.progress === 'number' ? `progress: ${item.progress}` : null,
    item.author ? `author: ${item.author}` : null,
    `updated_at: ${new Date(item.updatedAt).toISOString()}`,
    `compass_id: ${item.id}`,
    '---',
    '',
    `# ${item.title}`,
    '',
  ]
  return lines.filter((l) => l !== null).join('\n')
}

/** Vault path for a book note: knowledge/books/<slug>.md */
export function bookPath(item: ReadingItem): string {
  return bookNotePath(item.title)
}

export { slugify }
