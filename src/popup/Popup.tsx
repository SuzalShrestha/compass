import { useEffect, useState } from 'react'
import type { ReadingStatus } from '../lib/types.ts'
import { addReadingItem, getSettings } from '../lib/storage.ts'
import { syncReadingItem } from '../lib/vault.ts'

interface Tab {
  title: string
  url: string
}

export function Popup() {
  const [tab, setTab] = useState<Tab | null>(null)
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<ReadingStatus>('queue')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      // Dev preview outside the extension.
      setTab({ title: 'Example page', url: 'https://example.com' })
      setTitle('Example page')
      return
    }
    chrome.tabs.query({ active: true, currentWindow: true }).then(([t]) => {
      const info = { title: t?.title ?? '', url: t?.url ?? '' }
      setTab(info)
      setTitle(info.title)
    })
  }, [])

  async function save() {
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
    if (settings.vault.enabled) {
      void syncReadingItem(settings.vault, item)
    }
    setBusy(false)
    setSaved(true)
    setTimeout(() => window.close(), 900)
  }

  if (!tab) {
    return (
      <div className="popup">
        <h1>Save to Compass</h1>
        <p className="url">Reading the current tab…</p>
      </div>
    )
  }

  if (saved) {
    return (
      <div className="popup">
        <div className="done">
          <div className="check">✓</div>
          <p>Saved to your reading list.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="popup">
      <h1>Save this page</h1>

      <label>Title</label>
      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />

      <label>From</label>
      <div className="url">{tab.url || '—'}</div>

      <div className="seg">
        <button
          className={status === 'queue' ? 'active' : ''}
          onClick={() => setStatus('queue')}
        >
          Read later
        </button>
        <button
          className={status === 'reading' ? 'active' : ''}
          onClick={() => setStatus('reading')}
        >
          Reading now
        </button>
      </div>

      <button className="save-btn" onClick={save} disabled={busy}>
        {busy ? 'Saving…' : 'Save'}
      </button>
      <p className="hint">Tip: right-click any page → “Save to Compass”.</p>
    </div>
  )
}
