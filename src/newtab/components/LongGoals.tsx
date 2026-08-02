import { useState } from 'react'
import { X } from 'lucide-react'
import type { LongGoal } from '../../lib/types.ts'
import {
  addLongGoal,
  clearCompletedLongGoals,
  removeLongGoal,
  toggleLongGoal,
} from '../../lib/storage.ts'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'

export function LongGoals({ goals }: { goals: LongGoal[] }) {
  const [draft, setDraft] = useState('')

  function submit() {
    const text = draft.trim()
    if (!text) return
    void addLongGoal(text)
    setDraft('')
  }

  const open = goals.filter((g) => !g.done)
  const done = goals.filter((g) => g.done)

  return (
    <section className="col-body">
      <div className="col-head">
        <h2>Goals</h2>
        {open.length > 0 && <span className="progress-mini">{open.length}</span>}
      </div>

      {goals.length === 0 && <div className="empty">Nothing long-term yet.</div>}

      <ScrollArea className="goal-list">
        {open.map((g) => (
          <div key={g.id} className="goal-row">
            <label>
              <Checkbox
                checked={g.done}
                onCheckedChange={() => void toggleLongGoal(g.id)}
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
              onClick={() => void removeLongGoal(g.id)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        {done.length > 0 && (
          <>
            <div className="done-head">
              <span className="micro">Done</span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                title="Remove completed goals"
                onClick={() => void clearCompletedLongGoals()}
              >
                Clear ({done.length})
              </Button>
            </div>
            {done.map((g) => (
              <div key={g.id} className="goal-row done">
                <label>
                  <Checkbox
                    checked={g.done}
                    onCheckedChange={() => void toggleLongGoal(g.id)}
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
                  onClick={() => void removeLongGoal(g.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </>
        )}
      </ScrollArea>

      <div className="add-row">
        <Input
          type="text"
          value={draft}
          placeholder="Add a goal…"
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
