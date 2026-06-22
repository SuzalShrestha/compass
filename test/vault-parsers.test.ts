import { describe, expect, it } from 'vitest'
import {
  bookNotePath,
  matchReadingLine,
  parseBookNote,
  parseReadingLine,
  setLineDone,
  slugify,
} from '../src/lib/vault-parsers.ts'

describe('parseReadingLine', () => {
  it('parses an emitted queue line with full meta', () => {
    const line = '- [ ] [Meditations](https://en.wikipedia.org/wiki/Meditations) — _Marcus Aurelius · en.wikipedia.org · saved 2024-01-01_'
    expect(parseReadingLine(line)).toEqual({
      done: false,
      title: 'Meditations',
      url: 'https://en.wikipedia.org/wiki/Meditations',
      meta: 'Marcus Aurelius · en.wikipedia.org · saved 2024-01-01',
    })
  })

  it('parses a checked-off line with no meta', () => {
    expect(parseReadingLine('- [x] [Title](https://x.com)')).toEqual({
      done: true,
      title: 'Title',
      url: 'https://x.com',
      meta: undefined,
    })
  })

  it('parses a book with no url', () => {
    expect(parseReadingLine('- [ ] The Daily Stoic')).toEqual({
      done: false,
      title: 'The Daily Stoic',
      url: undefined,
      meta: undefined,
    })
  })

  it('tolerates uppercase X and asterisk bullets', () => {
    expect(parseReadingLine('* [X] [T](https://t.com)')).toEqual({
      done: true,
      title: 'T',
      url: 'https://t.com',
      meta: undefined,
    })
  })

  it('returns null for non-checklist lines', () => {
    expect(parseReadingLine('## Reading list')).toBeNull()
    expect(parseReadingLine('Some prose sentence.')).toBeNull()
    expect(parseReadingLine('')).toBeNull()
  })
})

describe('matchReadingLine', () => {
  const lines = [
    { done: false, title: 'Meditations', url: 'https://en.wikipedia.org/wiki/Meditations' },
    { done: false, title: 'The Daily Stoic', url: undefined },
    { done: true, title: 'Old Article', url: 'https://old.com' },
  ]

  it('matches by url first', () => {
    const m = matchReadingLine(lines, { title: 'whatever', url: 'https://old.com' })
    expect(m?.line.title).toBe('Old Article')
    expect(m?.line.done).toBe(true)
  })

  it('falls back to slugified title for url-less books', () => {
    const m = matchReadingLine(lines, { title: 'the daily stoic', url: undefined })
    expect(m?.line.title).toBe('The Daily Stoic')
  })

  it('returns null when nothing matches', () => {
    expect(matchReadingLine(lines, { title: 'Unknown', url: undefined })).toBeNull()
  })
})

describe('setLineDone', () => {
  it('flips an unchecked line to checked, preserving meta', () => {
    const lines = [
      '- [ ] [A](https://a.com) — _meta_',
      '- [x] [B](https://b.com)',
    ]
    expect(setLineDone(lines, 0, true)).toEqual([
      '- [x] [A](https://a.com) — _meta_',
      '- [x] [B](https://b.com)',
    ])
  })

  it('flips a checked line back to unchecked', () => {
    const lines = ['- [X] [B](https://b.com)']
    expect(setLineDone(lines, 0, false)).toEqual(['- [ ] [B](https://b.com)'])
  })

  it('handles out-of-range index gracefully', () => {
    expect(setLineDone(['- [ ] x'], 5, true)).toEqual(['- [ ] x'])
  })
})

describe('parseBookNote', () => {
  const note = `---
status: reading
progress: 42
author: Marcus Aurelius
updated_at: 2024-01-15T10:30:00.000Z
compass_id: abc-123
---
# Meditations

Some notes here.`

  it('parses all frontmatter fields', () => {
    expect(parseBookNote(note)).toEqual({
      status: 'reading',
      progress: 42,
      author: 'Marcus Aurelius',
      updatedAt: '2024-01-15T10:30:00.000Z',
      compassId: 'abc-123',
      title: 'Meditations',
    })
  })

  it('extracts the H1 title', () => {
    const fm = parseBookNote(note)
    expect(fm?.title).toBe('Meditations')
  })

  it('returns null when there is no frontmatter', () => {
    expect(parseBookNote('# Just a heading')).toBeNull()
    expect(parseBookNote('plain text')).toBeNull()
  })

  it('tolerates missing fields', () => {
    const partial = `---
status: queue
---
# A Book`
    expect(parseBookNote(partial)).toEqual({
      status: 'queue',
      title: 'A Book',
    })
  })

  it('ignores comment lines in yaml', () => {
    const withComment = `---
# a comment
status: done
---
# Title`
    expect(parseBookNote(withComment)?.status).toBe('done')
  })
})

describe('slugify / bookNotePath', () => {
  it('slugifies titles', () => {
    expect(slugify('The Daily Stoic')).toBe('the-daily-stoic')
    expect(slugify('Meditations! (Vol. 1)')).toBe('meditations-vol-1')
  })

  it('builds a vault path', () => {
    expect(bookNotePath('The Daily Stoic')).toBe('knowledge/books/the-daily-stoic.md')
  })
})
