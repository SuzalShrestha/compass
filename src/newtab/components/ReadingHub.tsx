import { useState } from 'react'
import type { ReadingItem, ReadingStatus } from '../../lib/types.ts'
import { addReadingItem, removeReadingItem, updateReadingItem } from '../../lib/storage.ts'

const GROUPS: { status: ReadingStatus; label: string }[] = [
  { status: 'reading', label: 'Currently reading' },
  { status: 'queue', label: 'Read later' },
]

export function ReadingHub({ items }: { items: ReadingItem[] }) {
  const [draft, setDraft] = useState('')

  function add() {
    const text = draft.trim()
    if (!text) return
    const looksLikeUrl = /^https?:\/\//i.test(text)
    void addReadingItem(
      looksLikeUrl ? { title: text, url: text, kind: 'article' } : { title: text, kind: 'book' },
    )
    setDraft('')
  }

  return (
    <section className="card">
      <h2>Reading</h2>

      {GROUPS.map(({ status, label }) => {
        const group = items.filter((i) => i.status === status)
        if (group.length === 0) return null
        return (
          <div className="reading-group" key={status}>
            <h3>{label}</h3>
            {group.map((item) => (
              <ReadingRow key={item.id} item={item} />
            ))}
          </div>
        )
      })}

      {items.filter((i) => i.status !== 'done').length === 0 && (
        <div className="empty">Nothing queued. Save a page from any site, or add one below.</div>
      )}

      <div className="add-row">
        <input
          type="text"
          value={draft}
          placeholder="Add a book title or paste a URL…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
        />
        <button className="btn" onClick={add}>
          Add
        </button>
      </div>
    </section>
  )
}

function ReadingRow({ item }: { item: ReadingItem }) {
  const isBook = item.kind === 'book'
  return (
    <div className="read-item">
      {item.url ? (
        <a className="title" href={item.url} title={item.title}>
          {item.title}
        </a>
      ) : (
        <span className="title" title={item.title}>
          {item.title}
        </span>
      )}

      {isBook && item.status === 'reading' && typeof item.progress === 'number' && (
        <div className="bar" title={`${item.progress}%`}>
          <span style={{ width: `${item.progress}%` }} />
        </div>
      )}
      {item.source && !isBook && <span className="meta">{item.source}</span>}

      <div className="actions">
        {item.status !== 'reading' && (
          <button
            title="Mark as currently reading"
            onClick={() => void updateReadingItem(item.id, { status: 'reading' })}
          >
            ▶
          </button>
        )}
        <button
          title="Mark as done"
          onClick={() => void updateReadingItem(item.id, { status: 'done', progress: 100 })}
        >
          ✓
        </button>
        <button title="Remove" onClick={() => void removeReadingItem(item.id)}>
          ✕
        </button>
      </div>
    </div>
  )
}
