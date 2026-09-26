import { useState, type Ref } from 'react'
import { ListTodo, Star, Target, Timer, X } from 'lucide-react'
import type { DailyGoal, DayRecord, LongGoal } from '../../lib/types.ts'
import {
  addGoal,
  carryOver,
  dismissCarryOver,
  editGoal,
  findCarryOver,
  removeGoal,
  toggleGoal,
  updateGoal,
} from '../../lib/storage.ts'
import { mediumDate, shortDate } from '../../lib/dates.ts'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { AddField, CardHead, Check } from './bits.tsx'
import { useFeedback } from './feedback.tsx'

export function TasksCard({
  date,
  today,
  day,
  allDays,
  longGoals,
  onFocus,
  inputRef,
}: {
  date: string
  today: string
  day: DayRecord
  allDays: Record<string, DayRecord>
  longGoals: LongGoal[]
  onFocus: (label: string) => void
  inputRef?: Ref<HTMLInputElement>
}) {
  const { undoable, celebrate, toast } = useFeedback()
  const isToday = date === today
  const goals = day.goals.filter((g) => !g.movedTo)
  const done = goals.filter((g) => g.done).length
  const carry = isToday ? findCarryOver(allDays, today) : []

  // Important first, then in the order they were added; finished sink.
  const ordered = [...goals].sort(
    (a, b) => Number(a.done) - Number(b.done) || Number(!!b.priority) - Number(!!a.priority),
  )
  const moved = day.goals.filter((g) => g.movedTo && g.movedTo !== 'dismissed')

  function add(text: string) {
    const priority = text.startsWith('!')
    void addGoal(date, priority ? text.slice(1) : text, { priority })
  }

  function toggle(g: DailyGoal, e: React.MouseEvent) {
    void toggleGoal(date, g.id)
    const open = goals.filter((x) => !x.done).length
    if (!g.done && open === 1 && goals.length > 1) {
      celebrate({ x: e.clientX, y: e.clientY })
      toast(isToday ? 'Every task done. Take the win.' : 'Day complete.')
    }
  }

  return (
    <section className="card" style={{ '--i': 0 } as React.CSSProperties}>
      <CardHead icon={<ListTodo />} title={isToday ? 'Today’s tasks' : `Tasks · ${mediumDate(date)}`}>
        {goals.length > 0 && (
          <span>
            {done}/{goals.length}
          </span>
        )}
      </CardHead>

      {!isToday && day.intention?.trim() && (
        <p className="mb-2 font-serif text-[15px] italic text-muted-foreground">“{day.intention}”</p>
      )}

      {carry.length > 0 && (
        <div className="carry">
          <p>
            <b>{carry.length}</b> unfinished {carry.length === 1 ? 'task' : 'tasks'} from{' '}
            {carry.every((c) => c.date === carry[0].date) ? shortDate(carry[0].date) : 'earlier this week'}.
          </p>
          <Button type="button" size="xs" onClick={() => void carryOver(today, carry)}>
            Bring over
          </Button>
          <Button type="button" size="xs" variant="ghost" onClick={() => void dismissCarryOver(carry)}>
            Let go
          </Button>
        </div>
      )}

      {goals.length === 0 ? (
        <div className="empty">
          {isToday ? (
            <>
              <strong>A blank page.</strong>
              What are the one to three things that would make today a good day?
            </>
          ) : (
            'Nothing planned for this day.'
          )}
        </div>
      ) : (
        <div className="list scroll">
          {ordered.map((g, i) => (
            <TaskRow
              key={g.id}
              goal={g}
              index={i}
              goalTitle={longGoals.find((l) => l.id === g.goalId)?.text}
              longGoals={longGoals}
              onToggle={(e) => toggle(g, e)}
              onEdit={(text) => void editGoal(date, g.id, text)}
              onPatch={(patch) => void updateGoal(date, g.id, patch)}
              onRemove={() => void undoable('days', 'Task deleted', () => removeGoal(date, g.id))}
              onFocus={isToday && !g.done ? () => onFocus(g.text) : undefined}
            />
          ))}
        </div>
      )}

      {done === goals.length && goals.length > 1 && (
        <div className="all-done">
          <span aria-hidden>🌿</span> {isToday ? 'All done. The rest of the day is yours.' : 'Every task finished.'}
        </div>
      )}

      {moved.length > 0 && (
        <p className="mt-2 px-1 text-xs text-muted-foreground">
          {moved.length} carried forward to a later day.
        </p>
      )}

      <AddField
        ref={inputRef}
        placeholder={isToday ? 'Add a task…' : `Add a task for ${shortDate(date)}…`}
        hint="start with ! for important"
        onAdd={add}
      />
    </section>
  )
}

function TaskRow({
  goal,
  index,
  goalTitle,
  longGoals,
  onToggle,
  onEdit,
  onPatch,
  onRemove,
  onFocus,
}: {
  goal: DailyGoal
  index: number
  goalTitle?: string
  longGoals: LongGoal[]
  onToggle: (e: React.MouseEvent) => void
  onEdit: (text: string) => void
  onPatch: (patch: Partial<Pick<DailyGoal, 'priority' | 'goalId'>>) => void
  onRemove: () => void
  onFocus?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(goal.text)
  const [linkOpen, setLinkOpen] = useState(false)
  const openGoals = longGoals.filter((g) => !g.done)

  function commit() {
    setEditing(false)
    if (text.trim() && text !== goal.text) onEdit(text)
    else setText(goal.text)
  }

  return (
    <div className={cn('task', goal.done && 'done')} style={{ animationDelay: `${index * 25}ms` }}>
      <Check on={goal.done} onToggle={onToggle} label={goal.text} />
      <div className="task-body">
      {editing ? (
        <input
          className="task-edit"
          value={text}
          autoFocus
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') {
              setText(goal.text)
              setEditing(false)
            }
          }}
        />
      ) : (
        <span className="task-text" onClick={() => !goal.done && setEditing(true)} title="Click to edit">
          <span>{goal.text}</span>
        </span>
      )}
      {goalTitle && !editing && (
        <span className="goal-chip" title={`Moves “${goalTitle}” forward`}>
          <Target className="h-3 w-3 shrink-0" />
          <span className="truncate">{goalTitle}</span>
        </span>
      )}
      </div>
      <div className="task-actions">
        {onFocus && (
          <button type="button" className="icon-btn reveal" title="Focus on this" aria-label="Start a focus session on this task" onClick={onFocus}>
            <Timer />
          </button>
        )}
        {openGoals.length > 0 && (
          <Popover open={linkOpen} onOpenChange={setLinkOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="icon-btn reveal" title="Link to a goal" aria-label="Link to a long-term goal">
                <Target />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-1.5">
              <p className="px-2.5 pb-1 pt-1.5 text-xs text-muted-foreground">Which goal does this move forward?</p>
              <div className="menu">
                {openGoals.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className={cn(goal.goalId === g.id && 'on')}
                    onClick={() => {
                      onPatch({ goalId: goal.goalId === g.id ? undefined : g.id })
                      setLinkOpen(false)
                    }}
                  >
                    <Target className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{g.text}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
        <button
          type="button"
          className={cn('icon-btn star', goal.priority ? 'on' : 'reveal')}
          title={goal.priority ? 'Important' : 'Mark important'}
          aria-pressed={!!goal.priority}
          aria-label="Important"
          onClick={() => onPatch({ priority: !goal.priority })}
        >
          <Star />
        </button>
        <button type="button" className="icon-btn danger reveal" title="Delete" aria-label="Delete task" onClick={onRemove}>
          <X />
        </button>
      </div>
    </div>
  )
}
