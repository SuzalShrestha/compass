import { useState } from 'react'
import type { QuickLink, Reminder, Settings } from '../../lib/types.ts'
import {
  getReading,
  getSettings,
  saveReminders,
  saveSettings,
} from '../../lib/storage.ts'
import { pingVault, syncReadingItem } from '../../lib/vault.ts'

type TestState = { kind: 'idle' | 'ok' | 'err' | 'busy'; msg?: string }

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

export function SettingsPanel({
  settings,
  reminders,
  onClose,
}: {
  settings: Settings
  reminders: Reminder[]
  onClose: () => void
}) {
  const [draft, setDraft] = useState<Settings>(settings)
  const [reminderList, setReminderList] = useState<Reminder[]>(reminders)
  const [newReminder, setNewReminder] = useState('')
  const [newLink, setNewLink] = useState({ label: '', url: '' })
  const [test, setTest] = useState<TestState>({ kind: 'idle' })

  function patchVault(patch: Partial<Settings['vault']>) {
    setDraft((d) => ({ ...d, vault: { ...d.vault, ...patch } }))
  }

  async function save() {
    await saveSettings(draft)
    await saveReminders(reminderList)
    onClose()
  }

  async function testConnection() {
    setTest({ kind: 'busy' })
    const res = await pingVault(draft.vault)
    setTest(
      res.ok
        ? { kind: 'ok', msg: 'Connected.' }
        : { kind: 'err', msg: res.error ?? 'Failed' },
    )
  }

  async function syncReadingNow() {
    setTest({ kind: 'busy' })
    // Persist current settings first so the sync uses the latest key/base.
    await saveSettings(draft)
    const fresh = await getSettings()
    const items = (await getReading()).filter((i) => i.status !== 'done')
    let ok = 0
    for (const item of items) {
      const r = await syncReadingItem(fresh.vault, item)
      if (r.ok) ok++
      else {
        setTest({ kind: 'err', msg: r.error ?? 'Sync failed' })
        return
      }
    }
    setTest({ kind: 'ok', msg: `Pushed ${ok} item(s) to the vault.` })
  }

  function addReminder() {
    const text = newReminder.trim()
    if (!text) return
    setReminderList((l) => [...l, { id: uid(), text, enabled: true }])
    setNewReminder('')
  }

  function addLink() {
    const label = newLink.label.trim()
    const url = newLink.url.trim()
    if (!label || !url) return
    const link: QuickLink = { id: uid(), label, url: /^https?:\/\//i.test(url) ? url : `https://${url}` }
    setDraft((d) => ({ ...d, quickLinks: [...d.quickLinks, link] }))
    setNewLink({ label: '', url: '' })
  }

  return (
    <div className="panel-backdrop" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>

        <div className="field">
          <label>Your name</label>
          <input
            type="text"
            value={draft.name}
            placeholder="What should I call you?"
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </div>

        {/* Quick links */}
        <div className="field">
          <label>Quick links</label>
          {draft.quickLinks.map((l) => (
            <div className="row" key={l.id} style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 14 }}>
                {l.label} <span className="muted">{l.url}</span>
              </span>
              <button
                className="icon-btn"
                style={{ width: 28, height: 28, fontSize: 13 }}
                onClick={() =>
                  setDraft((d) => ({ ...d, quickLinks: d.quickLinks.filter((x) => x.id !== l.id) }))
                }
              >
                ✕
              </button>
            </div>
          ))}
          <div className="add-row">
            <input
              type="text"
              placeholder="Label"
              value={newLink.label}
              onChange={(e) => setNewLink((n) => ({ ...n, label: e.target.value }))}
              style={{ flex: '0 0 30%' }}
            />
            <input
              type="text"
              placeholder="URL"
              value={newLink.url}
              onChange={(e) => setNewLink((n) => ({ ...n, url: e.target.value }))}
            />
            <button className="btn" onClick={addLink}>
              Add
            </button>
          </div>
        </div>

        {/* Reminders */}
        <div className="field">
          <label>Reminders</label>
          {reminderList.map((r) => (
            <div className="row" key={r.id} style={{ marginBottom: 6 }}>
              <label className="switch" style={{ fontSize: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={() =>
                    setReminderList((l) =>
                      l.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)),
                    )
                  }
                />
                {r.text}
              </label>
              <button
                className="icon-btn"
                style={{ width: 28, height: 28, fontSize: 13 }}
                onClick={() => setReminderList((l) => l.filter((x) => x.id !== r.id))}
              >
                ✕
              </button>
            </div>
          ))}
          <div className="add-row">
            <input
              type="text"
              placeholder="Add a reminder…"
              value={newReminder}
              onChange={(e) => setNewReminder(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addReminder()
              }}
            />
            <button className="btn" onClick={addReminder}>
              Add
            </button>
          </div>
        </div>

        {/* Vault sync */}
        <div className="field">
          <label className="switch" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={draft.vault.enabled}
              onChange={(e) => patchVault({ enabled: e.target.checked })}
            />
            Sync to Obsidian vault
          </label>
          <p className="muted">
            Needs the Local REST API plugin with its HTTP server enabled. Paste the API key from the
            plugin's settings.
          </p>
        </div>

        {draft.vault.enabled && (
          <>
            <div className="field">
              <label>API base URL</label>
              <input
                type="text"
                value={draft.vault.apiBase}
                onChange={(e) => patchVault({ apiBase: e.target.value })}
              />
            </div>
            <div className="field">
              <label>API key</label>
              <input
                type="password"
                value={draft.vault.apiKey}
                placeholder="Bearer token from the plugin"
                onChange={(e) => patchVault({ apiKey: e.target.value })}
              />
            </div>
            <div className="row">
              <button className="btn" onClick={testConnection} disabled={test.kind === 'busy'}>
                Test connection
              </button>
              <button className="btn" onClick={syncReadingNow} disabled={test.kind === 'busy'}>
                Sync reading list now
              </button>
            </div>
            {test.msg && (
              <p className={`muted ${test.kind === 'ok' ? 'status-ok' : test.kind === 'err' ? 'status-err' : ''}`}>
                {test.kind === 'busy' ? 'Working…' : test.msg}
              </p>
            )}
          </>
        )}

        <div className="panel-actions">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
