import { useState } from 'react'
import { BookOpen, Check as CheckIcon, Play, X } from 'lucide-react'
import type { ReadingItem, ReadingStatus } from '../../lib/types.ts'
import { addReadingItem, removeReadingItem, updateReadingItem } from '../../lib/storage.ts'
import { cn } from '@/lib/utils'
import { AddField, CardHead, colorFor } from './bits.tsx'
import { useFeedback } from './feedback.tsx'
import { faviconFor } from './LinksPopover.tsx'

type Tab = ReadingStatus

const TABS: { id: Tab; label: string }[] = [
  { id: 'reading', label: 'Reading' },
  { id: 'queue', label: 'Up next' },
  { id: 'done', label: 'Finished' },
]

/**
 * "Deep Work by Cal Newport" → title + author. Only a lowercase "by" splits,
 * at its last occurrence, so "Stand By Me" stays a title.
 */
export function parseBook(text: string): { title: string; author?: string } {
  const m = /^(.+)\s+by\s+(.+)$/.exec(text.trim())
  return m ? { title: m[1].trim(), author: m[2].trim() } : { title: text.trim() }
}

export function ReadingCard({ items, readingGoal }: { items: ReadingItem[]; readingGoal: number }) {
  const { undoable, celebrate, toast } = useFeedback()
  const year = new Date().getFullYear()
  const finishedThisYear = items.filter(
    (i) => i.kind === 'book' && i.status === 'done' && i.finishedAt && new Date(i.finishedAt).getFullYear() === year,
  )
  const reading = items.filter((i) => i.status === 'reading')
  const [tab, setTab] = useState<Tab>(reading.length > 0 ? 'reading' : 'queue')

  const shown =
    tab === 'done'
      ? items.filter((i) => i.status === 'done').sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0)).slice(0, 30)
      : items.filter((i) => i.status === tab)

  function add(text: string) {
    if (/^https?:\/\//i.test(text)) {
      void addReadingItem({ title: text, url: text, kind: 'article', status: 'queue' })
      setTab('queue')
      return
    }
    const { title, author } = parseBook(text)
    const status = tab === 'reading' ? 'reading' : 'queue'
    void addReadingItem({ title, author, kind: 'book', status, progress: status === 'reading' ? 0 : undefined })
    if (tab === 'done') setTab('queue')
  }

  function finish(item: ReadingItem, e: React.MouseEvent) {
    void updateReadingItem(item.id, { status: 'done' })
    if (item.kind === 'book') {
      celebrate({ x: e.clientX, y: e.clientY })
      const n = finishedThisYear.length + 1
      toast(`Finished “${item.title}” — book ${n} of ${year}.`)
    }
  }

  return (
    <section className="card" style={{ '--i': 4 } as React.CSSProperties}>
      <CardHead icon={<BookOpen />} title="Reading">
        <div className="seg" role="tablist">
          {TABS.map((t) => {
            const n = t.id === 'done' ? 0 : items.filter((i) => i.status === t.id).length
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={cn(tab === t.id && 'on')}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {n > 0 && <span className="ml-1 opacity-60">{n}</span>}
              </button>
            )
          })}
        </div>
      </CardHead>

      {readingGoal > 0 && (
        <div className="year-goal">
          <span>
            <b>{finishedThisYear.length}</b> of {readingGoal} books in {year}
          </span>
          <span className="bar">
            <i style={{ width: `${Math.min(100, (finishedThisYear.length / readingGoal) * 100)}%` }} />
          </span>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="empty">
          {tab === 'reading' && (
            <>
              <strong>No book on the go.</strong>
              Add one below, or start something from Up next.
            </>
          )}
          {tab === 'queue' && (
            <>
              <strong>Your reading list is empty.</strong>
              Add a book (“Title by Author”), paste a link, or right-click any page → Save to Compass.
            </>
          )}
          {tab === 'done' && 'Finished books and articles land here.'}
        </div>
      ) : (
        <div className="list scroll">
          {shown.map((item, i) => (
            <BookRow
              key={item.id}
              item={item}
              index={i}
              onStart={() => void updateReadingItem(item.id, { status: 'reading' })}
              onFinish={(e) => finish(item, e)}
              onRemove={() => void undoable('reading', 'Removed from reading', () => removeReadingItem(item.id))}
            />
          ))}
        </div>
      )}

      <AddField placeholder="Add a book (Title by Author) or paste a link…" onAdd={add} />
    </section>
  )
}

function BookRow({
  item,
  index,
  onStart,
  onFinish,
  onRemove,
}: {
  item: ReadingItem
  index: number
  onStart: () => void
  onFinish: (e: React.MouseEvent) => void
  onRemove: () => void
}) {
  const book = item.kind === 'book'
  const sub = [item.author, !book && item.source].filter(Boolean).join(' · ')

  return (
    <div className="book" style={{ animationDelay: `${index * 30}ms` }}>
      {book ? (
        <span className="spine" style={{ '--c': colorFor(item.title) } as React.CSSProperties} aria-hidden>
          {item.title.replace(/^(the|a|an)\s+/i, '').charAt(0).toUpperCase()}
        </span>
      ) : (
        <span className="spine article" aria-hidden>
          {item.url && faviconFor(item.url) ? <img src={faviconFor(item.url)} alt="" /> : <BookOpen className="h-4 w-4" />}
        </span>
      )}

      <div className="book-info">
        {item.url ? (
          <a className="book-title" href={item.url} title={item.title}>
            {item.title}
          </a>
        ) : (
          <span className="book-title" title={item.title}>
            {item.title}
          </span>
        )}
        {sub && <div className="book-sub">{sub}</div>}
        {item.status === 'reading' && book && <PageTracker item={item} />}
        {item.status === 'done' && (
          <div className="book-progress">
            {book && <Stars item={item} />}
            {item.finishedAt && (
              <span>
                {new Date(item.finishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="task-actions">
        {item.status === 'queue' && (
          <button type="button" className="icon-btn reveal" title="Start reading" aria-label="Start reading" onClick={onStart}>
            <Play />
          </button>
        )}
        {item.status !== 'done' && (
          <button type="button" className="icon-btn reveal" title="Mark finished" aria-label="Mark finished" onClick={onFinish}>
            <CheckIcon />
          </button>
        )}
        <button type="button" className="icon-btn danger reveal" title="Remove" aria-label="Remove" onClick={onRemove}>
          <X />
        </button>
      </div>
    </div>
  )
}

function PageTracker({ item }: { item: ReadingItem }) {
  const [cur, setCur] = useState(String(item.pageCurrent ?? ''))
  const [total, setTotal] = useState(String(item.pageTotal ?? ''))

  function save() {
    const pageCurrent = parseInt(cur, 10)
    const pageTotal = parseInt(total, 10)
    void updateReadingItem(item.id, {
      pageCurrent: Number.isFinite(pageCurrent) ? pageCurrent : undefined,
      pageTotal: Number.isFinite(pageTotal) && pageTotal > 0 ? pageTotal : undefined,
    })
  }

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && e.currentTarget.blur()

  return (
    <div className="book-progress">
      <span>p.</span>
      <input
        className="page-input"
        inputMode="numeric"
        aria-label="Current page"
        value={cur}
        placeholder="0"
        onChange={(e) => setCur(e.target.value.replace(/\D/g, ''))}
        onBlur={save}
        onKeyDown={onKey}
      />
      <span>of</span>
      <input
        className="page-input"
        inputMode="numeric"
        aria-label="Total pages"
        value={total}
        placeholder="?"
        onChange={(e) => setTotal(e.target.value.replace(/\D/g, ''))}
        onBlur={save}
        onKeyDown={onKey}
      />
      {item.progress != null && item.pageTotal ? (
        <>
          <span className="bar">
            <i style={{ width: `${item.progress}%` }} />
          </span>
          <span>{item.progress}%</span>
        </>
      ) : null}
    </div>
  )
}

function Stars({ item }: { item: ReadingItem }) {
  return (
    <span className="stars" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={cn((item.rating ?? 0) >= n && 'on')}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => void updateReadingItem(item.id, { rating: item.rating === n ? undefined : n })}
        >
          ★
        </button>
      ))}
    </span>
  )
}
