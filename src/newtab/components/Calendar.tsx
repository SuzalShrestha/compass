import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { DayRecord } from '../../lib/types.ts'
import { monthGrid, monthLabel, shiftMonth, toDateKey } from '../../lib/dates.ts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export function Calendar({
  selected,
  days,
  onSelect,
}: {
  selected: string
  days: Record<string, DayRecord>
  onSelect: (dateKey: string) => void
}) {
  const today = toDateKey()
  const initial = selected.split('-').map(Number)
  const [view, setView] = useState({ year: initial[0], month: initial[1] - 1 })

  const cells = useMemo(
    () => monthGrid(view.year, view.month),
    [view.year, view.month],
  )

  function go(delta: number) {
    setView((v) => shiftMonth(v.year, v.month, delta))
  }

  function jumpToday() {
    const [y, m] = today.split('-').map(Number)
    setView({ year: y, month: m - 1 })
    onSelect(today)
  }

  return (
    <section className="cal">
      <div className="cal-head">
        <h2>{monthLabel(view.year, view.month)}</h2>
        <div className="cal-nav">
          {selected !== today && (
            <Button type="button" variant="ghost" size="xs" onClick={jumpToday}>
              Today
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => go(-1)}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => go(1)}
            aria-label="Next month"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
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
          const rec = days[key]
          const open = rec?.goals.filter((g) => !g.done).length ?? 0
          const total = rec?.goals.length ?? 0
          const hasIntent = Boolean(rec?.intention?.trim())
          const isToday = key === today
          const isSelected = key === selected
          const hasActivity = total > 0 || hasIntent || Boolean(rec?.checkin)

          return (
            <button
              key={key}
              type="button"
              className={cn(
                'cal-cell',
                isToday && 'today',
                isSelected && 'selected',
                hasActivity && 'has-data',
              )}
              onClick={() => onSelect(key)}
              title={
                total > 0
                  ? `${open} open · ${total} todos`
                  : hasIntent
                    ? 'Has intention'
                    : undefined
              }
            >
              <span className="cal-day-num">{Number(key.slice(-2))}</span>
              {total > 0 && (
                <span className={cn('cal-dot', open === 0 && 'done')} aria-hidden />
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
