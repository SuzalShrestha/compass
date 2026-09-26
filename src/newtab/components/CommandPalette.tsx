import { useMemo, useState, type ReactNode } from 'react'
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckSquare,
  ExternalLink,
  Moon,
  Mountain,
  NotebookPen,
  Search,
  Settings,
  Timer,
} from 'lucide-react'
import type { DayRecord, QuickLink, ReadingItem } from '../../lib/types.ts'
import { addGoal, addLongGoal, addNote, addReadingItem } from '../../lib/storage.ts'
import { shortDate } from '../../lib/dates.ts'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { parseBook } from './ReadingCard.tsx'

interface Item {
  id: string
  group: string
  icon: ReactNode
  label: ReactNode
  hint?: string
  run: () => void
}

export function CommandPalette({
  open,
  onOpenChange,
  today,
  days,
  reading,
  links,
  onToast,
  onSelectDate,
  onOpenDashboard,
  onOpenSettings,
  onStartFocus,
  onToggleTheme,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  today: string
  days: Record<string, DayRecord>
  reading: ReadingItem[]
  links: QuickLink[]
  onToast: (text: string) => void
  onSelectDate: (date: string) => void
  onOpenDashboard: () => void
  onOpenSettings: () => void
  onStartFocus: () => void
  onToggleTheme: () => void
}) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const text = q.trim()

  const items = useMemo<Item[]>(() => {
    const out: Item[] = []
    const quoted = <b className="font-medium">“{text}”</b>
    if (text) {
      out.push(
        {
          id: 'add-task',
          group: 'Add',
          icon: <CheckSquare />,
          label: <>Add task {quoted}</>,
          hint: 'today',
          run: () => {
            const priority = text.startsWith('!')
            void addGoal(today, priority ? text.slice(1) : text, { priority })
            onToast('Task added')
          },
        },
        {
          id: 'add-goal',
          group: 'Add',
          icon: <Mountain />,
          label: <>Add long-term goal {quoted}</>,
          run: () => {
            void addLongGoal(text)
            onToast('Goal added')
          },
        },
        {
          id: 'add-read',
          group: 'Add',
          icon: <BookOpen />,
          label: <>Add to reading {quoted}</>,
          run: () => {
            const isUrl = /^https?:\/\//i.test(text)
            void addReadingItem(isUrl ? { title: text, url: text, kind: 'article' } : { ...parseBook(text), kind: 'book' })
            onToast('Added to your reading list')
          },
        },
        {
          id: 'add-note',
          group: 'Add',
          icon: <NotebookPen />,
          label: <>Save note {quoted}</>,
          run: () => {
            void addNote(text)
            onToast('Note saved')
          },
        },
      )
    }

    const nav: Item[] = [
      { id: 'today', group: 'Go to', icon: <CalendarDays />, label: 'Today', run: () => onSelectDate(today) },
      { id: 'focus', group: 'Go to', icon: <Timer />, label: 'Start a focus session', run: onStartFocus },
      { id: 'dash', group: 'Go to', icon: <BarChart3 />, label: 'Dashboard', run: onOpenDashboard },
      { id: 'settings', group: 'Go to', icon: <Settings />, label: 'Settings', run: onOpenSettings },
      { id: 'theme', group: 'Go to', icon: <Moon />, label: 'Toggle light / dark', run: onToggleTheme },
      ...links.map((l) => ({
        id: `link-${l.id}`,
        group: 'Links',
        icon: <ExternalLink />,
        label: l.label,
        hint: l.url.replace(/^https?:\/\/(www\.)?/, ''),
        run: () => void (location.href = l.url),
      })),
    ]
    const needle = text.toLowerCase()
    out.push(...nav.filter((n) => !needle || String(n.label).toLowerCase().includes(needle)))

    if (needle.length >= 2) {
      const tasks = Object.values(days)
        .flatMap((d) => d.goals.filter((g) => !g.movedTo).map((g) => ({ date: d.date, g })))
        .filter(({ g }) => g.text.toLowerCase().includes(needle))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 6)
      out.push(
        ...tasks.map(({ date, g }) => ({
          id: `t-${g.id}`,
          group: 'Tasks',
          icon: <CheckSquare />,
          label: <span className={cn(g.done && 'line-through opacity-60')}>{g.text}</span>,
          hint: date === today ? 'today' : shortDate(date),
          run: () => onSelectDate(date),
        })),
      )
      out.push(
        ...reading
          .filter((r) => r.url && `${r.title} ${r.author ?? ''}`.toLowerCase().includes(needle))
          .slice(0, 5)
          .map((r) => ({
            id: `r-${r.id}`,
            group: 'Reading',
            icon: <BookOpen />,
            label: r.title,
            hint: r.source,
            run: () => void (location.href = r.url!),
          })),
      )
    }
    return out
  }, [text, today, days, reading, links, onToast, onSelectDate, onOpenDashboard, onOpenSettings, onStartFocus, onToggleTheme])

  const current = Math.min(active, Math.max(0, items.length - 1))

  function run(item: Item | undefined) {
    if (!item) return
    item.run()
    setQ('')
    onOpenChange(false)
  }

  let lastGroup = ''
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setQ('')
      }}
    >
      <DialogContent className="cmdk [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">Search or add</DialogTitle>
        <DialogDescription className="sr-only">Type to add a task, goal, book or note, or jump somewhere.</DialogDescription>
        <div className="cmdk-input">
          <Search />
          <input
            autoFocus
            value={q}
            placeholder="Add a task, find anything, jump anywhere…"
            onChange={(e) => {
              setQ(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, items.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                run(items[current])
              }
            }}
          />
        </div>
        <div className="cmdk-list" role="listbox">
          {items.map((item, i) => {
            const head = item.group !== lastGroup ? item.group : null
            lastGroup = item.group
            return (
              <div key={item.id}>
                {head && <div className="cmdk-group">{head}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === current}
                  className={cn('cmdk-item', i === current && 'active')}
                  onMouseMove={() => setActive(i)}
                  onClick={() => run(item)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.hint && <small>{item.hint}</small>}
                </button>
              </div>
            )
          })}
        </div>
        <div className="cmdk-foot">
          <span>
            <span className="kbd">↑↓</span> move
          </span>
          <span>
            <span className="kbd">↵</span> choose
          </span>
          <span>
            <span className="kbd">!</span> at the start = important task
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
