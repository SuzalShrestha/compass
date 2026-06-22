import { useState } from 'react'
import { setCheckin } from '../../lib/storage.ts'

const SCALE = [
  { v: 1, label: 'Low' },
  { v: 2, label: '' },
  { v: 3, label: 'Mid' },
  { v: 4, label: '' },
  { v: 5, label: 'High' },
]

/**
 * Morning mood + energy check-in (1–5 each). Sits on the home page above the
 * grid. Once set for the day it collapses to a compact summary so it doesn't
 * crowd the morning.
 */
export function Checkin({ date, value }: { date: string; value?: { mood: number; energy: number } }) {
  const [mood, setMood] = useState<number | null>(value?.mood ?? null)
  const [energy, setEnergy] = useState<number | null>(value?.energy ?? null)

  // If storage updates from elsewhere, reflect it (unless we're mid-edit).
  // Cheap: just resync when value changes and we haven't picked yet.
  if (value && mood === null && energy === null) {
    setMood(value.mood)
    setEnergy(value.energy)
  }

  const done = mood != null && energy != null

  function pick(field: 'mood' | 'energy', v: number) {
    if (field === 'mood') setMood(v)
    else setEnergy(v)
    const next = field === 'mood' ? { mood: v, energy: energy ?? 0 } : { mood: mood ?? 0, energy: v }
    if ((field === 'mood' ? energy : mood) != null) {
      void setCheckin(date, next)
    }
  }

  return (
    <section className="card checkin">
      <h2>Check-in</h2>
      {done ? (
        <div className="checkin-summary">
          <span className="micro">Mood</span>
          <span className="checkin-val">{mood}/5</span>
          <span className="checkin-sep" />
          <span className="micro">Energy</span>
          <span className="checkin-val">{energy}/5</span>
          <button className="checkin-edit" onClick={() => { setMood(null); setEnergy(null) }}>
            Edit
          </button>
        </div>
      ) : (
        <div className="checkin-row">
          <div className="checkin-field">
            <span className="micro">Mood</span>
            <div className="seg">
              {SCALE.map((s) => (
                <button
                  key={s.v}
                  className={mood === s.v ? 'active' : ''}
                  onClick={() => pick('mood', s.v)}
                  title={s.label || `${s.v}`}
                >
                  {s.v}
                </button>
              ))}
            </div>
          </div>
          <div className="checkin-field">
            <span className="micro">Energy</span>
            <div className="seg">
              {SCALE.map((s) => (
                <button
                  key={s.v}
                  className={energy === s.v ? 'active' : ''}
                  onClick={() => pick('energy', s.v)}
                  title={s.label || `${s.v}`}
                >
                  {s.v}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
