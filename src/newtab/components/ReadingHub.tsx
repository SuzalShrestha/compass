import { useState } from 'react'
import { ArrowRight, Check, X } from 'lucide-react'
import type { ReadingItem, ReadingStatus } from '../../lib/types.ts'
import { addReadingItem, removeReadingItem, updateReadingItem } from '../../lib/storage.ts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'

const GROUPS: { status: ReadingStatus; label: string }[] = [
  { status: 'reading', label: 'Now' },
  { status: 'queue', label: 'Later' },
]

export function ReadingHub({ items, compact }: { items: ReadingItem[]; compact?: boolean }) {
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

  const shown = items.filter((i) => i.status !== 'done')

  return (
    <section className={compact ? 'col-body reading-block' : 'card'}>
      <div className="col-head">
        <h2>Reading</h2>
        {shown.length > 0 && <span className="progress-mini">{shown.length}</span>}
      </div>

      {shown.length === 0 ? (
        <div className="empty">Nothing queued.</div>
      ) : (
        <ScrollArea className="goal-list">
          {GROUPS.map(({ status, label }) => {
            const group = shown.filter((i) => i.status === status)
            if (group.length === 0) return null
            return (
              <div className="read-group" key={status}>
                <h3 className="micro">{label}</h3>
                {group.map((item) => (
                  <ReadingRow key={item.id} item={item} />
                ))}
              </div>
            )
          })}
        </ScrollArea>
      )}

      <div className="add-row">
        <Input
          type="text"
          value={draft}
          placeholder="Title or URL…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
        />
        <Button type="button" size="sm" disabled={!draft.trim()} onClick={add}>
          Add
        </Button>
      </div>
    </section>
  )
}

function ReadingRow({ item }: { item: ReadingItem }) {
  return (
    <div className="read-row group">
      <div className="flex items-center gap-2">
        {item.url ? (
          <a
            className="min-w-0 flex-1 truncate text-sm text-foreground no-underline hover:underline"
            href={item.url}
            title={item.title}
          >
            {item.title}
          </a>
        ) : (
          <span className="min-w-0 flex-1 truncate text-sm" title={item.title}>
            {item.title}
          </span>
        )}
        {item.progress != null && item.progress > 0 && (
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {item.progress}%
          </span>
        )}
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {item.status === 'queue' && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Start reading"
              onClick={() => void updateReadingItem(item.id, { status: 'reading' })}
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
          {item.status === 'reading' && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Mark done"
              onClick={() => void updateReadingItem(item.id, { status: 'done' })}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Remove"
            onClick={() => void removeReadingItem(item.id)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {item.progress != null && item.progress > 0 && (
        <Progress value={item.progress} className="mt-1" />
      )}
    </div>
  )
}
