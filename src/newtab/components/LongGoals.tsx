import { useState } from 'react'
import type { LongGoal } from '../../lib/types.ts'
import { addLongGoal, clearCompletedLongGoals, removeLongGoal, toggleLongGoal } from '../../lib/storage.ts'

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
    <section className="card long-goals">
      <div className="long-goals-head">
        <h2>Goals</h2>
        {done.length > 0 && (
          <button className="ghost tiny" title="Remove completed goals" onClick={() => void clearCompletedLongGoals()}>
            Clear done ({done.length})
          </button>
        )}
      </div>
      <p className="muted long-goals-sub">Long-term. Stays until you finish it.</p>

      {goals.length === 0 && (
        <div className="empty">No goals yet. Add something you’re working toward.</div>
      )}

      {open.map((g) => (
        <div key={g.id} className={`goal-row${g.done ? ' done' : ''}`}>
          <label>
            <input type="checkbox" checked={g.done} onChange={() => void toggleLongGoal(g.id)} />
            <span>{g.text}</span>
          </label>
          <button className="remove" title="Remove" onClick={() => void removeLongGoal(g.id)}>
            ✕
          </button>
        </div>
      ))}

      {done.length > 0 && (
        <>
          <div className="long-goals-done-label">Done</div>
          {done.map((g) => (
            <div key={g.id} className="goal-row done">
              <label>
                <input type="checkbox" checked={g.done} onChange={() => void toggleLongGoal(g.id)} />
                <span>{g.text}</span>
              </label>
              <button className="remove" title="Remove" onClick={() => void removeLongGoal(g.id)}>
                ✕
              </button>
            </div>
          ))}
        </>
      )}

      <div className="add-row">
        <input
          type="text"
          value={draft}
          placeholder="Add a goal you’re working toward…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
        />
        <button className="btn" onClick={submit}>
          Add
        </button>
      </div>
    </section>
  )
}