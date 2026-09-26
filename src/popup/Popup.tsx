import { useEffect, useState } from 'react'
import type { ReadingStatus } from '../lib/types.ts'
import { addGoal, addReadingItem, getDay, getSettings } from '../lib/storage.ts'
import { syncReadingItem } from '../lib/vault.ts'
import { toDateKey } from '../lib/dates.ts'

interface Tab {
  title: string
  url: string
}

type Mode = 'page' | 'task'

export function Popup() {
  const [tab, setTab] = useState<Tab | null>(null)
  const [mode, setMode] = useState<Mode>('page')
  const [title, setTitle] = useState('')
  const [task, setTask] = useState('')
  const [status, setStatus] = useState<ReadingStatus>('queue')
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<number | null>(null)

  useEffect(() => {
    void getSettings().then((s) => document.documentElement.style.setProperty('--accent', s.accent))
    void getDay(toDateKey()).then((d) => setOpen(d.goals.filter((g) => !g.done && !g.movedTo).length))
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      // Dev preview outside the extension.
      setTab({ title: 'Example page', url: 'https://example.com' })
      setTitle('Example page')
      return
    }
    void chrome.tabs.query({ active: true, currentWindow: true }).then(([t]) => {
      const info = { title: t?.title ?? '', url: t?.url ?? '' }
      setTab(info)
      setTitle(info.title)
      // Nothing to save on chrome:// and friends — start in task mode.
      if (!/^https?:/i.test(info.url)) setMode('task')
    })
  }, [])

  function finish(message: string) {
    setBusy(false)
    setDone(message)
    setTimeout(() => window.close(), 1100)
  }

  async function savePage() {
    if (!tab) return
    setBusy(true)
    const item = await addReadingItem({
      title: title || tab.title || tab.url,
      url: tab.url,
      kind: 'article',
      status,
    })
    // Best-effort vault push; failures don't block the local save.
    const settings = await getSettings()
    if (settings.vault.enabled) void syncReadingItem(settings.vault, item)
    finish(status === 'reading' ? 'Added to what you’re reading.' : 'Saved for later.')
  }

  async function saveTask() {
    const text = task.trim()
    if (!text) return
    setBusy(true)
    const priority = text.startsWith('!')
    await addGoal(toDateKey(), priority ? text.slice(1) : text, { priority })
    finish('Added to today.')
  }

  if (done) {
    return (
      <div className="popup">
        <div className="done">
          <svg className="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5 10 17.5 19 7" />
          </svg>
          <p>{done}</p>
        </div>
      </div>
    )
  }

  const canSavePage = !!tab && /^https?:/i.test(tab.url)

  return (
    <div className="popup">
      <div className="seg" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'page'} className={mode === 'page' ? 'on' : ''} onClick={() => setMode('page')}>
          Save page
        </button>
        <button type="button" role="tab" aria-selected={mode === 'task'} className={mode === 'task' ? 'on' : ''} onClick={() => setMode('task')}>
          Quick task
        </button>
      </div>

      {mode === 'page' ? (
        canSavePage ? (
          <>
            <label htmlFor="title">Title</label>
            <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && void savePage()} />
            <div className="url">{tab!.url.replace(/^https?:\/\/(www\.)?/, '')}</div>
            <div className="choice">
              <button type="button" className={status === 'queue' ? 'on' : ''} onClick={() => setStatus('queue')}>
                Read later
              </button>
              <button type="button" className={status === 'reading' ? 'on' : ''} onClick={() => setStatus('reading')}>
                Reading now
              </button>
            </div>
            <button type="button" className="primary" onClick={() => void savePage()} disabled={busy}>
              {busy ? 'Saving…' : 'Save to reading list'}
            </button>
            <p className="hint">Tip: right-click any page or link → “Save to Compass”.</p>
          </>
        ) : (
          <p className="hint">This page can’t be saved — try a regular website.</p>
        )
      ) : (
        <>
          <label htmlFor="task">What needs doing today?</label>
          <input
            id="task"
            type="text"
            value={task}
            placeholder="e.g. Reply to Sam’s email"
            onChange={(e) => setTask(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void saveTask()}
            autoFocus
          />
          <button type="button" className="primary" onClick={() => void saveTask()} disabled={busy || !task.trim()}>
            Add to today
          </button>
          <p className="hint">
            {open != null && open > 0 ? `${open} open ${open === 1 ? 'task' : 'tasks'} today. ` : ''}Start with ! to mark it
            important.
          </p>
        </>
      )}
    </div>
  )
}
