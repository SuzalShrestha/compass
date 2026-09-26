import { useMemo, useState } from 'react'
import { ChevronDown, Mountain, X } from 'lucide-react'
import type { DayRecord, LongGoal } from '../../lib/types.ts'
import {
  addLongGoal,
  addMilestone,
  clearCompletedLongGoals,
  goalProgress,
  removeLongGoal,
  removeMilestone,
  toggleLongGoal,
  toggleMilestone,
  updateLongGoal,
} from '../../lib/storage.ts'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AddField, CardHead, Check } from './bits.tsx'
import { useFeedback } from './feedback.tsx'

const DAY = 86_400_000

function dueLabel(targetDate: string, today: string): { text: string; soon: boolean } {
  const days = Math.round(
    (new Date(`${targetDate}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / DAY,
  )
  const when = new Date(`${targetDate}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: days > 300 ? 'numeric' : undefined,
  })
  if (days < 0) return { text: `${when} · ${-days}d overdue`, soon: true }
  if (days === 0) return { text: 'Due today', soon: true }
  if (days < 60) return { text: `${when} · ${days}d left`, soon: days <= 14 }
  return { text: `${when} · ${Math.round(days / 30)} mo left`, soon: false }
}

export function GoalsCard({
  goals,
  allDays,
  today,
}: {
  goals: LongGoal[]
  allDays: Record<string, DayRecord>
  today: string
}) {
  const { undoable, celebrate } = useFeedback()
  const [openId, setOpenId] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)
  const open = goals.filter((g) => !g.done)
  const done = goals.filter((g) => g.done)

  // Finished tasks linked to each goal, across all days.
  const tasksDone = useMemo(() => {
    const counts = new Map<string, number>()
    for (const day of Object.values(allDays)) {
      for (const t of day.goals) {
        if (t.done && t.goalId) counts.set(t.goalId, (counts.get(t.goalId) ?? 0) + 1)
      }
    }
    return counts
  }, [allDays])

  const row = (g: LongGoal, i: number) => (
    <GoalRow
      key={g.id}
      goal={g}
      index={i}
      today={today}
      tasksDone={tasksDone.get(g.id) ?? 0}
      open={openId === g.id}
      onOpen={() => setOpenId(openId === g.id ? null : g.id)}
      onToggle={(e) => {
        if (!g.done) celebrate({ x: e.clientX, y: e.clientY })
        void toggleLongGoal(g.id)
      }}
      onRemove={() => void undoable('longGoals', 'Goal deleted', () => removeLongGoal(g.id))}
    />
  )

  return (
    <section className="card" style={{ '--i': 3 } as React.CSSProperties}>
      <CardHead icon={<Mountain />} title="Long-term goals">
        {open.length > 0 && <span>{open.length} active</span>}
      </CardHead>

      {goals.length === 0 && (
        <div className="empty">
          <strong>Where do you want to be in a year?</strong>
          Add a goal, then break it into milestones. Link daily tasks to it to see it move.
        </div>
      )}

      <div className="list">{open.map(row)}</div>

      {done.length > 0 && (
        <div className="mt-2 flex items-center justify-between px-1">
          <button
            type="button"
            className="inline-flex items-center gap-1 border-0 bg-transparent p-0 text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setShowDone((v) => !v)}
            aria-expanded={showDone}
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !showDone && '-rotate-90')} />
            Achieved ({done.length})
          </button>
          {showDone && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => void undoable('longGoals', 'Cleared achieved goals', clearCompletedLongGoals)}
            >
              Clear
            </Button>
          )}
        </div>
      )}
      {showDone && <div className="list">{done.map(row)}</div>}

      <AddField placeholder="Add a long-term goal…" onAdd={(t) => void addLongGoal(t)} />
    </section>
  )
}

function GoalRow({
  goal,
  index,
  today,
  tasksDone,
  open,
  onOpen,
  onToggle,
  onRemove,
}: {
  goal: LongGoal
  index: number
  today: string
  tasksDone: number
  open: boolean
  onOpen: () => void
  onToggle: (e: React.MouseEvent) => void
  onRemove: () => void
}) {
  const progress = goalProgress(goal)
  const ms = goal.milestones ?? []
  const due = goal.targetDate && !goal.done ? dueLabel(goal.targetDate, today) : null
  const [why, setWhy] = useState(goal.why ?? '')

  return (
    <div className={cn('lgoal', open && 'open', goal.done && 'done')} style={{ animationDelay: `${index * 30}ms` }}>
      <div className="lgoal-head">
        <div className="pt-0.5">
          <Check on={goal.done} onToggle={onToggle} label={goal.text} square />
        </div>
        <button type="button" className="lgoal-main" onClick={onOpen} aria-expanded={open}>
          <div className="lgoal-title">{goal.text}</div>
          {goal.why && !open && <div className="lgoal-why">{goal.why}</div>}
          {!goal.done && (ms.length > 0 || due || tasksDone > 0) && (
            <div className="lgoal-meta">
              {ms.length > 0 && (
                <>
                  <span className="bar">
                    <i style={{ width: `${progress * 100}%` }} />
                  </span>
                  <span>
                    {ms.filter((m) => m.done).length}/{ms.length}
                  </span>
                </>
              )}
              {due && <span className={cn(due.soon && 'due-soon')}>{due.text}</span>}
              {tasksDone > 0 && <span>{tasksDone} tasks done</span>}
            </div>
          )}
        </button>
        <button type="button" className="icon-btn danger reveal" title="Delete goal" aria-label="Delete goal" onClick={onRemove}>
          <X />
        </button>
      </div>

      {open && (
        <div className="lgoal-body">
          <div className="inline-fields">
            <label>
              Why it matters
              <Input
                value={why}
                placeholder="So that…"
                onChange={(e) => setWhy(e.target.value)}
                onBlur={() => why !== (goal.why ?? '') && void updateLongGoal(goal.id, { why: why.trim() || undefined })}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                className="h-8"
              />
            </label>
            <label>
              Target date
              <Input
                type="date"
                value={goal.targetDate ?? ''}
                onChange={(e) => void updateLongGoal(goal.id, { targetDate: e.target.value || undefined })}
                className="h-8"
              />
            </label>
          </div>
          <div>
            {ms.map((m) => (
              <div key={m.id} className={cn('milestone', m.done && 'done')}>
                <Check on={m.done} onToggle={() => void toggleMilestone(goal.id, m.id)} label={m.text} square />
                <span>{m.text}</span>
                <button
                  type="button"
                  className="icon-btn danger reveal"
                  aria-label="Remove milestone"
                  onClick={() => void removeMilestone(goal.id, m.id)}
                >
                  <X />
                </button>
              </div>
            ))}
            <AddField placeholder="Add a milestone…" onAdd={(t) => void addMilestone(goal.id, t)} />
          </div>
        </div>
      )}
    </div>
  )
}
