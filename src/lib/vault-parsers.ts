// ---------------------------------------------------------------------------
// Parsers for the two-way Obsidian vault sync.
//
// These are the only pieces of logic that can silently corrupt a real vault
// note, so they're isolated, pure, and unit-tested. The reading-list parser
// round-trips the exact line format that `vault.readingLine()` emits, plus a
// few tolerant variants a human might hand-edit. The book parser reads the
// frontmatter that `vault.bookNote()` writes.
// ---------------------------------------------------------------------------

import type { ReadingItem } from './types.ts'

///////////////////////////////////////////////////////////////////////////////
// Reading-list lines
//
// Emitted format:  - [ ] [Title](url) — _author · source · saved 2024-01-01_
// Tolerated:       - [x] [Title](url)
//                  - [x] Title
//                  - [ ] [Title](url) — _meta with · separators_
///////////////////////////////////////////////////////////////////////////////

export interface ParsedReadingLine {
  done: boolean
  title: string
  url?: string
  /** Raw meta text inside the trailing _…_, if present. */
  meta?: string
}

const LINE_RE =
  /^\s*[-*]\s+\[(?<check>[ xX])\]\s+(?<body>.+?)(?:\s+—\s+_(?<meta>[^_]+)_)?\s*$/

/** Markdown link: [text](url). Captures text + url, or returns the raw string. */
function parseLink(body: string): { title: string; url?: string } {
  const m = body.match(/^\[(?<title>[^\]]+)\]\((?<url>[^)]+)\)$/)
  if (m && m.groups) return { title: m.groups.title, url: m.groups.url }
  return { title: body.trim() }
}

export function parseReadingLine(line: string): ParsedReadingLine | null {
  const m = line.match(LINE_RE)
  if (!m || !m.groups) return null
  const check = m.groups.check.toLowerCase()
  const { title, url } = parseLink(m.groups.body)
  return {
    done: check === 'x',
    title,
    url,
    meta: m.groups.meta,
  }
}

export interface ReadingLineMatch {
  line: ParsedReadingLine
  /** Index in the original lines array. */
  index: number
}

/**
 * Find a vault line that matches a Compass reading item. Match key is URL when
 * present, otherwise the title (slugified, case-insensitive) — so a book
 * renamed in either place still reconciles.
 */
export function matchReadingLine(
  lines: ParsedReadingLine[],
  item: Pick<ReadingItem, 'title' | 'url'>,
): ReadingLineMatch | null {
  if (item.url) {
    const i = lines.findIndex((l) => l.url && l.url === item.url)
    if (i >= 0) return { line: lines[i], index: i }
  }
  const slug = slugify(item.title)
  const i = lines.findIndex((l) => !l.url && slugify(l.title) === slug)
  if (i >= 0) return { line: lines[i], index: i }
  return null
}

/** Flip the checkbox of a single line in a note's body, preserving the rest. */
export function setLineDone(originalLines: string[], index: number, done: boolean): string[] {
  const out = [...originalLines]
  const target = originalLines[index]
  if (!target) return out
  out[index] = target.replace(/\[( |x|X)\]/, done ? '[x]' : '[ ]')
  return out
}

///////////////////////////////////////////////////////////////////////////////
// Book frontmatter
//
// Emitted format:
//   ---
//   status: reading
//   progress: 42
//   author: Author Name
//   updated_at: 2024-01-15T10:30:00.000Z
//   compass_id: abc-123
//   ---
//   # Book Title
///////////////////////////////////////////////////////////////////////////////

export interface BookFrontmatter {
  status?: string
  progress?: number
  author?: string
  updatedAt?: string
  compassId?: string
  /** The H1 title from the body, if present. */
  title?: string
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/

export function parseBookNote(md: string): BookFrontmatter | null {
  const m = md.match(FRONTMATTER_RE)
  if (!m) return null
  const yaml = m[1]
  const body = m[2]
  const out: BookFrontmatter = {}

  for (const raw of yaml.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const ci = line.indexOf(':')
    if (ci < 0) continue
    const key = line.slice(0, ci).trim()
    const val = line.slice(ci + 1).trim()
    switch (key) {
      case 'status':
        out.status = val
        break
      case 'progress':
        out.progress = Number(val) || undefined
        break
      case 'author':
        out.author = val
        break
      case 'updated_at':
        out.updatedAt = val
        break
      case 'compass_id':
        out.compassId = val
        break
    }
  }

  const h1 = body.match(/^#\s+(.+?)\s*$/m)
  if (h1) out.title = h1[1]

  return out
}

///////////////////////////////////////////////////////////////////////////////
// Shared helpers
///////////////////////////////////////////////////////////////////////////////

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Book note path in the vault: knowledge/books/<slug>.md */
export function bookNotePath(title: string): string {
  return `knowledge/books/${slugify(title)}.md`
}
