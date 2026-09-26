import { useEffect, useRef, useState } from 'react'
import type { DayRecord } from '../../lib/types.ts'
import { setCheckin, setIntention, setReflection } from '../../lib/storage.ts'
import { cn } from '@/lib/utils'
import { Ring } from './bits.tsx'

const MOODS = [
  { v: 1, face: '😣', label: 'Rough' },
  { v: 2, face: '🙁', label: 'Low' },
  { v: 3, face: '😐', label: 'Okay' },
  { v: 4, face: '🙂', label: 'Good' },
  { v: 5, face: '😄', label: 'Great' },
]

/** A text field that saves on blur/Enter and doesn't fight live storage updates. */
function useDraft(value: string, save: (v: string) => void) {
  const [text, setText] = useState(value)
  const dirty = useRef(false)
  useEffect(() => {
    if (!dirty.current) setText(value)
  }, [value])
  return {
    value: text,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      dirty.current = true
      setText(e.target.value)
    },
    onBlur: () => {
      dirty.current = false
      if (text !== value) save(text)
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') e.currentTarget.blur()
    },
  }
}

export function Hero({ date, day, hour }: { date: string; day: DayRecord; hour: number }) {
  const intention = useDraft(day.intention, (v) => void setIntention(date, v))
  const reflection = useDraft(day.reflection ?? '', (v) => void setReflection(date, v))
  const goals = day.goals.filter((g) => !g.movedTo)
  const done = goals.filter((g) => g.done).length
  const pct = goals.length ? done / goals.length : 0

  const [mood, setMood] = useState<number | null>(day.checkin?.mood ?? null)
  const [energy, setEnergy] = useState<number | null>(day.checkin?.energy ?? null)
  useEffect(() => {
    setMood(day.checkin?.mood ?? null)
    setEnergy(day.checkin?.energy ?? null)
  }, [day.checkin?.mood, day.checkin?.energy])

  function pick(m: number | null, e: number | null) {
    setMood(m)
    setEnergy(e)
    if (m != null && e != null) void setCheckin(date, { mood: m, energy: e })
  }

  const evening = hour >= 18 || !!day.reflection
  const moodLabel = MOODS.find((m) => m.v === mood)?.label

  return (
    <section className="card hero" style={{ '--i': 0 } as React.CSSProperties}>
      <div className="min-w-0">
        <label className="hero-label" htmlFor="intention">
          Today’s intention
        </label>
        <input
          id="intention"
          className="intent-input"
          placeholder="What would make today a win?"
          autoComplete="off"
          {...intention}
        />
        {evening && (
          <div className="reflect">
            <span className="text-xs font-semibold text-muted-foreground">Evening</span>
            <input
              className="reflect-input"
              placeholder="How did today go? One line is enough."
              aria-label="Evening reflection"
              {...reflection}
            />
          </div>
        )}
      </div>

      <div className="hero-progress">
        <Ring value={pct} size={58} stroke={6}>
          <b>{goals.length ? `${Math.round(pct * 100)}%` : '–'}</b>
        </Ring>
        <div>
          <strong>
            {goals.length === 0 ? 'No tasks yet' : done === goals.length ? 'Day complete' : `${done} of ${goals.length} done`}
          </strong>
          {goals.length === 0
            ? 'Add a few below.'
            : done === goals.length
              ? 'Nicely done.'
              : pct >= 0.5
                ? 'Past halfway.'
                : 'One at a time.'}
        </div>
      </div>

      <div className="checkin" aria-label="Daily check-in">
        <span className="checkin-q">
          {mood != null ? `Feeling ${moodLabel?.toLowerCase()}` : 'How are you feeling?'}
        </span>
        <div className="faces" role="radiogroup" aria-label="Mood">
          {MOODS.map((m) => (
            <button
              key={m.v}
              type="button"
              role="radio"
              aria-checked={mood === m.v}
              aria-label={m.label}
              title={m.label}
              className={cn('face', mood === m.v && 'on')}
              onClick={() => pick(m.v, energy)}
            >
              {m.face}
            </button>
          ))}
        </div>
        <div className="checkin-row">
          <span>Energy</span>
          <div className="energy" role="radiogroup" aria-label="Energy">
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={energy === v}
                aria-label={`Energy ${v} of 5`}
                className={cn(energy != null && v <= energy && 'on')}
                style={{ height: 6 + v * 2.4 }}
                onClick={() => pick(mood, v)}
              />
            ))}
          </div>
          {mood != null && energy == null && <span className="text-[11px]">← and energy?</span>}
        </div>
      </div>
    </section>
  )
}
