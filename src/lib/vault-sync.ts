import type { ReadingItem, VaultSettings } from './types.ts'
import {
  bookPath,
  bookNoteBody,
  getNote,
  listDir,
  putNote,
  READING_NOTE,
  syncReadingItem,
} from './vault.ts'
import {
  matchReadingLine,
  parseBookNote,
  parseReadingLine,
  setLineDone,
  slugify,
} from './vault-parsers.ts'
import { updateReadingItem } from './storage.ts'

// ---------------------------------------------------------------------------
// Two-way reconciliation between Compass and an Obsidian vault.
//
// Reading list (knowledge/learning/reading-list.md):
//   - Compass → vault: append new items; flip a vault checkbox when Compass
//     marks an item done (read-modify-write on the note body).
//   - Vault → Compass: any vault [x] matching a Compass queue/reading item
//     marks the Compass item done. Match key: URL, else slugified title.
//
// Books (knowledge/books/<slug>.md, one per book):
//   - Compass owns these files (PUT). Newest updated_at wins on conflict.
//   - Vault → Compass: parse frontmatter, reconcile by newest timestamp.
//
// Journal, highlights, rollups stay one-way (Compass → vault, append-only).
// ---------------------------------------------------------------------------

export interface SyncReport {
  ok: boolean
  error?: string
  readingPushed: number
  readingReconciled: number
  booksPushed: number
  booksReconciled: number
  at: number
}

export async function syncReadingList(
  s: VaultSettings,
  items: ReadingItem[],
): Promise<{ pushed: number; reconciled: number; error?: string }> {
  // 1. Push any Compass items not yet in the vault note (append-only).
  let pushed = 0
  const note = await getNote(s, READING_NOTE)
  let vaultLines: string[] = []
  if (note.ok && note.data != null) {
    vaultLines = note.data.split(/\r?\n/)
  } else if (!note.ok && note.status !== 404) {
    return { pushed: 0, reconciled: 0, error: note.error }
  }

  const parsed = vaultLines.map(parseReadingLine).filter((l): l is NonNullable<typeof l> => l !== null)

  for (const item of items) {
    if (item.status === 'done') continue // done items already reconciled
    const match = matchReadingLine(parsed, item)
    if (!match) {
      const r = await syncReadingItem(s, item)
      if (r.ok) pushed++
      else return { pushed, reconciled: 0, error: r.error }
    }
  }

  // 2. Re-read after appends and reconcile done-state both ways.
  const after = await getNote(s, READING_NOTE)
  if (!after.ok || after.data == null) {
    return { pushed, reconciled: 0, error: after.error }
  }
  const lines = after.data.split(/\r?\n/)
  const parsedAfter = lines.map(parseReadingLine).filter((l): l is NonNullable<typeof l> => l !== null)

  let reconciled = 0
  let dirty = false
  let body = lines

  for (const item of items) {
    const match = matchReadingLine(parsedAfter, item)
    if (!match) continue

    // Vault says done but Compass doesn't → mark Compass done.
    if (match.line.done && item.status !== 'done') {
      await updateReadingItem(item.id, { status: 'done', progress: 100 })
      reconciled++
      continue
    }

    // Compass says done but vault doesn't → flip the vault checkbox.
    if (item.status === 'done' && !match.line.done) {
      body = setLineDone(body, match.index, true)
      dirty = true
      reconciled++
    }
  }

  if (dirty) {
    const r = await putNote(s, READING_NOTE, body.join('\n'))
    if (!r.ok) return { pushed, reconciled, error: r.error }
  }

  return { pushed, reconciled }
}

export async function syncBooks(
  s: VaultSettings,
  items: ReadingItem[],
): Promise<{ pushed: number; reconciled: number; error?: string }> {
  const books = items.filter((i) => i.kind === 'book')

  // 1. Push/refresh every book note Compass owns.
  let pushed = 0
  for (const book of books) {
    const body = bookNoteBody(book)
    const r = await putNote(s, bookPath(book), body)
    if (r.ok) pushed++
    else if (r.status !== 404) return { pushed, reconciled: 0, error: r.error }
  }

  // 2. Read the vault's books/ folder and reconcile frontmatter back.
  const dir = await listDir(s, 'knowledge/books')
  if (!dir.ok) {
    // Folder may not exist yet — fine, nothing to read back.
    return { pushed, reconciled: 0 }
  }

  let reconciled = 0
  const vaultFiles = (dir.data ?? []).filter((p) => p.endsWith('.md'))

  for (const file of vaultFiles) {
    const note = await getNote(s, `knowledge/books/${file}`)
    if (!note.ok || note.data == null) continue
    const fm = parseBookNote(note.data)
    if (!fm?.compassId) continue

    const book = books.find((b) => b.id === fm.compassId)
    if (!book) continue

    const vaultTs = fm.updatedAt ? new Date(fm.updatedAt).getTime() : 0
    // Newest updated_at wins.
    if (vaultTs > book.updatedAt) {
      const patch: Partial<ReadingItem> = {}
      if (fm.status && fm.status !== book.status) {
        patch.status = fm.status as ReadingItem['status']
      }
      if (typeof fm.progress === 'number' && fm.progress !== book.progress) {
        patch.progress = fm.progress
      }
      if (fm.author && fm.author !== book.author) patch.author = fm.author
      if (Object.keys(patch).length > 0) {
        await updateReadingItem(book.id, patch)
        reconciled++
      }
    }
  }

  return { pushed, reconciled }
}

export async function syncAll(
  s: VaultSettings,
  items: ReadingItem[],
): Promise<SyncReport> {
  if (!s.enabled) return { ok: false, error: 'Vault sync is off', readingPushed: 0, readingReconciled: 0, booksPushed: 0, booksReconciled: 0, at: Date.now() }

  const reading = await syncReadingList(s, items)
  if (reading.error) {
    return { ok: false, error: reading.error, readingPushed: reading.pushed, readingReconciled: reading.reconciled, booksPushed: 0, booksReconciled: 0, at: Date.now() }
  }

  const books = await syncBooks(s, items)
  if (books.error) {
    return { ok: false, error: books.error, readingPushed: reading.pushed, readingReconciled: reading.reconciled, booksPushed: books.pushed, booksReconciled: books.reconciled, at: Date.now() }
  }

  return {
    ok: true,
    readingPushed: reading.pushed,
    readingReconciled: reading.reconciled,
    booksPushed: books.pushed,
    booksReconciled: books.reconciled,
    at: Date.now(),
  }
}

export { slugify }
