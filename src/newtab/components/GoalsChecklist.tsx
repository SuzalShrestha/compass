import { useState } from 'react'
import type { DailyGoal } from '../../lib/types.ts'
import { addGoal, removeGoal, toggleGoal } from '../../lib/storage.ts'

export function GoalsChecklist({ date, goals }: { date: string; goals: DailyGoal[] }) {
  const [draft, setDraft] = useState('')

  function submit() {
    const text = draft.trim()
    if (!text) return
    void addGoal(date, text)
    setDraft('')
  }

  const done = goals.filter((g) => g.done).length

  return (
    <section className="card">
      <h2>Today's goals</h2>

      {goals.length === 0 && <div className="empty">No goals yet. Add the first one below.</div>}

      {goals.map((g) => (
        <div key={g.id} className={`goal-row${g.done ? ' done' : ''}`}>
          <label>
            <input
              type="checkbox"
              checked={g.done}
              onChange={() => void toggleGoal(date, g.id)}
            />
            <span>{g.text}</span>
          </label>
          <button className="remove" title="Remove" onClick={() => void removeGoal(date, g.id)}>
            ✕
          </button>
        </div>
      ))}

      <div className="add-row">
        <input
          type="text"
          value={draft}
          placeholder="Add a goal…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
        />
        <button className="btn" onClick={submit}>
          Add
        </button>
      </div>

      {goals.length > 0 && (
        <div className="progress-mini">
          {done} of {goals.length} done
        </div>
      )}
    </section>
  )
}
