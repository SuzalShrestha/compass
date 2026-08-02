import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { DailyGoal } from '../../lib/types.ts'
import { addGoal, removeGoal, toggleGoal } from '../../lib/storage.ts'
import { mediumDate, toDateKey } from '../../lib/dates.ts'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'

export function GoalsChecklist({
  date,
  goals,
  intention,
}: {
  date: string
  goals: DailyGoal[]
  intention?: string
}) {
  const [draft, setDraft] = useState('')
  const today = toDateKey()
  const isToday = date === today
  const done = goals.filter((g) => g.done).length

  useEffect(() => {
    setDraft('')
  }, [date])

  function submit() {
    const text = draft.trim()
    if (!text) return
    void addGoal(date, text)
    setDraft('')
  }

  return (
    <section className="col-body">
      <div className="col-head">
        <h2>{isToday ? 'Today' : mediumDate(date)}</h2>
        {goals.length > 0 && (
          <span className="progress-mini">
            {done}/{goals.length}
          </span>
        )}
      </div>

      {!isToday && intention?.trim() && <p className="day-intention">{intention}</p>}

      {goals.length === 0 ? (
        <div className="empty">
          {isToday ? 'Nothing yet. Name the first one.' : 'Nothing planned for this day.'}
        </div>
      ) : (
        <ScrollArea className="goal-list">
          {goals.map((g) => (
            <div key={g.id} className={`goal-row${g.done ? ' done' : ''}`}>
              <label>
                <Checkbox
                  checked={g.done}
                  onCheckedChange={() => void toggleGoal(date, g.id)}
                  aria-label={g.text}
                />
                <span>{g.text}</span>
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="goal-remove"
                title="Remove"
                onClick={() => void removeGoal(date, g.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </ScrollArea>
      )}

      <div className="add-row">
        <Input
          type="text"
          value={draft}
          placeholder={isToday ? 'Add a todo…' : 'Add a todo for this day…'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
        />
        <Button type="button" size="sm" disabled={!draft.trim()} onClick={submit}>
          Add
        </Button>
      </div>
    </section>
  )
}
