import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, RefreshCw } from 'lucide-react'
import type { CalEvent, CalendarFeed, DayRecord } from '../../lib/types.ts'
import { mediumDate, monthGrid, monthLabel, shiftMonth, toDateKey } from '../../lib/dates.ts'
import { eventsOn, refreshCalendars } from '../../lib/calendar.ts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CardHead } from './bits.tsx'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

/** "now", "in 25 min", "in 2 h", or "at 4:30 PM" for later in the day. */
export function relativeMinutes(start: number, now: number): string {
  const mins = Math.round((start - now) / 60_000)
  if (mins <= 0) return 'now'
  if (mins < 60) return `in ${mins} min`
  if (mins < 180) return `in ${Math.floor(mins / 60)} h ${mins % 60 ? `${mins % 60} min` : ''}`.trim()
  return `at ${clock(start)}`
}

export function AgendaCard({
  now,
  selected,
  onSelect,
  days,
  events,
  feeds,
  fetchedAt,
  onConnect,
}: {
  now: Date
  selected: string
  onSelect: (date: string) => void
  days: Record<string, DayRecord>
  events: CalEvent[]
  feeds: CalendarFeed[]
  fetchedAt: number | null
  onConnect: () => void
}) {
  const today = toDateKey(now)
  const isToday = selected === today
  const nowMs = now.getTime()
  const colors = useMemo(() => new Map(feeds.map((f) => [f.id, f.color])), [feeds])
  const shown = eventsOn(
    events.filter((e) => feeds.some((f) => f.id === e.feedId && f.enabled)),
    selected,
  )
  const [refreshing, setRefreshing] = useState(false)
  const connected = feeds.some((f) => f.enabled)

  async function refresh() {
    setRefreshing(true)
    try {
      await refreshCalendars()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <section className="card" style={{ '--i': 1 } as React.CSSProperties}>
      <CardHead icon={<CalendarDays />} title={isToday ? 'Today’s agenda' : mediumDate(selected)}>
        {connected && (
          <button
            type="button"
            className="icon-btn"
            onClick={refresh}
            title={fetchedAt ? `Updated ${clock(fetchedAt)} — refresh now` : 'Refresh'}
            aria-label="Refresh calendars"
          >
            <RefreshCw className={cn(refreshing && 'animate-spin')} />
          </button>
        )}
      </CardHead>

      {!connected ? (
        <div className="empty">
          <strong>Your calendar isn’t connected yet.</strong>
          Paste your calendar’s iCal link and your meetings show up here, every new tab.
          <div className="mt-3">
            <Button type="button" size="sm" onClick={onConnect}>
              Connect a calendar
            </Button>
          </div>
        </div>
      ) : shown.length === 0 ? (
        <div className="empty">
          <strong>{isToday ? 'Nothing on the calendar.' : 'A clear day.'}</strong>
          {isToday ? 'A good day for deep work.' : 'No events scheduled.'}
        </div>
      ) : (
        <div className="agenda scroll">
          {shown.map((e, i) => {
            const past = isToday && !e.allDay && e.end <= nowMs
            const live = isToday && !e.allDay && e.start <= nowMs && e.end > nowMs
            const soon = isToday && !e.allDay && e.start > nowMs && e.start - nowMs <= 60 * 60_000
            return (
              <div
                key={e.id}
                className={cn('event', past && 'past', live && 'now')}
                style={{ '--c': colors.get(e.feedId), animationDelay: `${i * 30}ms` } as React.CSSProperties}
              >
                <div className="event-time">
                  {e.allDay ? <b>All day</b> : <b>{clock(e.start)}</b>}
                </div>
                <span className="event-bar" />
                <div className="min-w-0">
                  <div className="event-title">{e.title}</div>
                  <div className="event-meta">
                    {live && <span className="live">Happening now</span>}
                    {soon && <span className="soon">{relativeMinutes(e.start, nowMs)}</span>}
                    {!e.allDay && (
                      <span>
                        {clock(e.start)} – {clock(e.end)}
                      </span>
                    )}
                    {e.location && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{e.location}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <MonthCalendar
        selected={selected}
        today={today}
        onSelect={onSelect}
        days={days}
        events={events}
        colors={colors}
      />
    </section>
  )
}

function MonthCalendar({
  selected,
  today,
  onSelect,
  days,
  events,
  colors,
}: {
  selected: string
  today: string
  onSelect: (date: string) => void
  days: Record<string, DayRecord>
  events: CalEvent[]
  colors: Map<string, string>
}) {
  const [y, m] = selected.split('-').map(Number)
  const [view, setView] = useState({ year: y, month: m - 1 })
  const cells = useMemo(() => monthGrid(view.year, view.month), [view.year, view.month])

  // Which feed colours touch each day of the visible month.
  const eventDots = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const e of events) {
      const color = colors.get(e.feedId)
      if (!color) continue
      const d = new Date(e.start)
      d.setHours(0, 0, 0, 0)
      for (let n = 0; n < 14 && d.getTime() < Math.max(e.end, e.start + 1); n++) {
        const key = toDateKey(d)
        if (!map.has(key)) map.set(key, new Set())
        map.get(key)!.add(color)
        d.setDate(d.getDate() + 1)
      }
    }
    return map
  }, [events, colors])

  return (
    <div className="cal">
      <div className="cal-head">
        <h3>{monthLabel(view.year, view.month)}</h3>
        <div className="cal-nav">
          {selected !== today && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => {
                const [ty, tm] = today.split('-').map(Number)
                setView({ year: ty, month: tm - 1 })
                onSelect(today)
              }}
            >
              Today
            </Button>
          )}
          <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => setView((v) => shiftMonth(v.year, v.month, -1))}>
            <ChevronLeft />
          </button>
          <button type="button" className="icon-btn" aria-label="Next month" onClick={() => setView((v) => shiftMonth(v.year, v.month, 1))}>
            <ChevronRight />
          </button>
        </div>
      </div>
      <div className="cal-weekdays">
        {WEEKDAYS.map((d) => (
          <span key={d} className="cal-wd">
            {d}
          </span>
        ))}
      </div>
      <div className="cal-grid">
        {cells.map((key, i) => {
          if (!key) return <span key={`e-${i}`} className="cal-cell empty" />
          const goals = (days[key]?.goals ?? []).filter((g) => !g.movedTo)
          const open = goals.filter((g) => !g.done).length
          const dots = [...(eventDots.get(key) ?? [])].slice(0, 2)
          if (goals.length > 0) dots.push(open === 0 ? 'var(--user-accent)' : 'var(--muted-foreground)')
          const weekend = i % 7 >= 5
          return (
            <button
              key={key}
              type="button"
              className={cn('cal-cell', weekend && 'weekend', key === today && 'today', key === selected && 'selected')}
              onClick={() => onSelect(key)}
              title={goals.length > 0 ? `${goals.length - open}/${goals.length} tasks done` : undefined}
              aria-label={mediumDate(key)}
              aria-pressed={key === selected}
            >
              {Number(key.slice(-2))}
              {dots.length > 0 && (
                <span className="cal-dots" aria-hidden>
                  {dots.map((c, j) => (
                    <i key={j} style={{ '--c': c } as React.CSSProperties} />
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
