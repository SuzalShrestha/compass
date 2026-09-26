import { Repeat, X } from 'lucide-react'
import type { Habit } from '../../lib/types.ts'
import { addHabit, habitStreak, removeHabit, toggleHabit } from '../../lib/storage.ts'
import { lastNDates, mediumDate } from '../../lib/dates.ts'
import { cn } from '@/lib/utils'
import { AddField, CardHead } from './bits.tsx'
import { useFeedback } from './feedback.tsx'

const MILESTONES = new Set([7, 21, 30, 50, 100, 365])

/** "📖 Read 20 pages" → emoji + name. */
export function parseHabit(text: string): { name: string; emoji?: string } {
  const m = /^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s*(.+)$/u.exec(text.trim())
  return m ? { emoji: m[1], name: m[2] } : { name: text.trim() }
}

export function HabitsCard({ habits, today }: { habits: Habit[]; today: string }) {
  const { undoable, toast, celebrate } = useFeedback()
  const week = lastNDates(7, new Date(`${today}T12:00:00`))
  const doneToday = habits.filter((h) => h.log[today]).length

  function toggle(h: Habit, date: string, e: React.MouseEvent) {
    void toggleHabit(h.id, date)
    if (date !== today || h.log[today]) return
    const streak = habitStreak({ ...h, log: { ...h.log, [today]: true } }, today)
    if (MILESTONES.has(streak)) {
      celebrate({ x: e.clientX, y: e.clientY })
      toast(`${streak}-day streak on “${h.name}”. Keep it going.`)
    }
  }

  return (
    <section className="card" style={{ '--i': 5 } as React.CSSProperties}>
      <CardHead icon={<Repeat />} title="Habits">
        {habits.length > 0 && (
          <span>
            {doneToday}/{habits.length} today
          </span>
        )}
      </CardHead>

      {habits.length === 0 ? (
        <div className="empty">
          <strong>Small things, every day.</strong>
          Add a habit — start it with an emoji if you like: “🏃 Run”, “📖 Read 20 pages”.
        </div>
      ) : (
        <div className="list">
          {habits.map((h, i) => {
            const streak = habitStreak(h, today)
            return (
              <div key={h.id} className="habit" style={{ animationDelay: `${i * 30}ms` }}>
                <span className="habit-name">
                  <span className="habit-emoji" aria-hidden>
                    {h.emoji ?? '•'}
                  </span>
                  <span title={h.name}>{h.name}</span>
                </span>
                <span className="habit-days">
                  {week.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={cn('hday', h.log[d] && 'on', d === today && 'today')}
                      aria-label={`${h.name} — ${mediumDate(d)}`}
                      aria-pressed={!!h.log[d]}
                      title={mediumDate(d)}
                      onClick={(e) => toggle(h, d, e)}
                    />
                  ))}
                </span>
                <span className={cn('streak', streak >= 3 && 'hot')} title={`${streak}-day streak`}>
                  <span className="n">
                    {streak >= 3 && <span className="flame">🔥</span>}
                    {streak > 0 ? streak : ''}
                  </span>
                  <button
                    type="button"
                    className="icon-btn danger h-6 w-6"
                    aria-label={`Delete habit ${h.name}`}
                    title="Delete habit"
                    onClick={() => void undoable('habits', 'Habit deleted', () => removeHabit(h.id))}
                  >
                    <X />
                  </button>
                </span>
              </div>
            )
          })}
        </div>
      )}

      <AddField
        placeholder="Add a habit…"
        onAdd={(t) => {
          const { name, emoji } = parseHabit(t)
          void addHabit(name, emoji)
        }}
      />
    </section>
  )
}
