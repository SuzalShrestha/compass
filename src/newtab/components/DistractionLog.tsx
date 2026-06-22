import { useState } from 'react'
import { addDistraction } from '../../lib/storage.ts'

/**
 * "I caught myself" — a one-tap awareness log. Pressing it records a slip
 * (optionally tagged with the current domain) so the dashboard can surface
 * patterns by time-of-day and site. Lives at the bottom of the home page,
 * next to the reminders.
 */
export function DistractionLog({ currentDomain }: { currentDomain?: string }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [justLogged, setJustLogged] = useState(false)

  function log() {
    void addDistraction({ domain: currentDomain, note: note.trim() || undefined })
    setNote('')
    setOpen(false)
    setJustLogged(true)
    setTimeout(() => setJustLogged(false), 1800)
  }

  return (
    <div className="distraction">
      {open ? (
        <div className="distraction-form">
          <span className="micro">I caught myself{currentDomain ? ` on ${currentDomain}` : ''}</span>
          <input
            type="text"
            placeholder="What pulled you away? (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') log()
              if (e.key === 'Escape') setOpen(false)
            }}
            autoFocus
          />
          <div className="distraction-actions">
            <button className="btn" onClick={log}>Log it</button>
            <button className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="distraction-btn" onClick={() => setOpen(true)}>
          <span className="dot" />
          {justLogged ? 'Logged. Good catch.' : 'I caught myself slipping'}
        </button>
      )}
    </div>
  )
}
