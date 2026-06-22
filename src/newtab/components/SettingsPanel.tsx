import { useState } from 'react'
import type { QuickLink, Reminder, Settings, SiteLimit, ThemeMode } from '../../lib/types.ts'
import {
  getReading,
  getSettings,
  saveReminders,
  saveSettings,
} from '../../lib/storage.ts'
import { pingVault, syncDay } from '../../lib/vault.ts'
import { syncAll } from '../../lib/vault-sync.ts'
import { toDateKey } from '../../lib/dates.ts'

type TestState = { kind: 'idle' | 'ok' | 'err' | 'busy'; msg?: string }

const ACCENT_PRESETS = ['#6B7686', '#8B98AA', '#5B6470', '#4A5258', '#9CA3AF']

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
  const [newLimit, setNewLimit] = useState({ domain: '', minutes: '30' })
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

  async function syncNow() {
    setTest({ kind: 'busy' })
    // Persist current settings first so the sync uses the latest key/base.
    await saveSettings(draft)
    const fresh = await getSettings()
    const items = await getReading()
    const report = await syncAll(fresh.vault, items)
    if (!report.ok) {
      setTest({ kind: 'err', msg: report.error ?? 'Sync failed' })
      return
    }
    setTest({
      kind: 'ok',
      msg: `Reading: +${report.readingPushed} pushed, ${report.readingReconciled} reconciled · Books: ${report.booksPushed} pushed, ${report.booksReconciled} reconciled.`,
    })
  }

  async function syncJournalNow() {
    setTest({ kind: 'busy' })
    await saveSettings(draft)
    const fresh = await getSettings()
    const { getAllDays } = await import('../../lib/storage.ts')
    const days = await getAllDays()
    const day = days[toDateKey()]
    if (!day || (day.goals.length === 0 && !day.intention)) {
      setTest({ kind: 'err', msg: 'Nothing to sync — add an intention or goals first.' })
      return
    }
    const r = await syncDay(fresh.vault, day)
    setTest(r.ok ? { kind: 'ok', msg: `Journal entry appended to records/journal/${toDateKey()}.md` } : { kind: 'err', msg: r.error ?? 'Sync failed' })
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

  function addLimit() {
    const domain = newLimit.domain
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/.*$/, '')
    const minutes = parseInt(newLimit.minutes, 10)
    if (!domain || !minutes || minutes <= 0) return
    if (draft.limits.some((l) => l.domain === domain)) return
    const limit: SiteLimit = { domain, minutes, enabled: true }
    setDraft((d) => ({ ...d, limits: [...d.limits, limit] }))
    setNewLimit({ domain: '', minutes: '30' })
  }

  return (
    <div className="panel-backdrop" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>

        {/* Appearance */}
        <div className="field">
          <label>Theme</label>
          <div className="seg">
            {(['auto', 'light', 'dark'] as ThemeMode[]).map((m) => (
              <button
                key={m}
                className={draft.theme === m ? 'active' : ''}
                onClick={() => setDraft((d) => ({ ...d, theme: m }))}
              >
                {m}
              </button>
            ))}
          </div>
          <p className="muted">Auto follows your system. Light is canonical Swiss.</p>
        </div>

        <div className="field">
          <label>Accent</label>
          <div className="swatch-row">
            {ACCENT_PRESETS.map((c) => (
              <button
                key={c}
                className={`swatch${draft.accent.toLowerCase() === c.toLowerCase() ? ' selected' : ''}`}
                style={{ background: c }}
                title={c}
                onClick={() => setDraft((d) => ({ ...d, accent: c }))}
                aria-label={`Accent ${c}`}
              />
            ))}
            <input
              type="text"
              value={draft.accent}
              onChange={(e) => setDraft((d) => ({ ...d, accent: e.target.value }))}
              placeholder="#6B7686"
              style={{ width: 90, marginLeft: 8 }}
            />
          </div>
          <p className="muted">Used sparingly — most hierarchy is typographic.</p>
        </div>

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

        {/* Focus & limits */}
        <div className="field">
          <label className="switch" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={draft.tracking.enabled}
              onChange={(e) =>
                setDraft((d) => ({ ...d, tracking: { ...d.tracking, enabled: e.target.checked } }))
              }
            />
            Track time on sites
          </label>
          <p className="muted">
            Times how long each site is focused, shown on the new tab. Limited sites escalate: a
            badge countdown, then a banner, then a full-screen block.
          </p>
        </div>

        {draft.tracking.enabled && (
          <div className="field">
            <label>Daily limits</label>
            {draft.limits.length === 0 && <p className="muted">No limits yet.</p>}
            {draft.limits.map((l) => (
              <div className="row" key={l.domain} style={{ marginBottom: 6 }}>
                <label
                  className="switch"
                  style={{ fontSize: 14, display: 'flex', gap: 8, alignItems: 'center' }}
                >
                  <input
                    type="checkbox"
                    checked={l.enabled}
                    onChange={() =>
                      setDraft((d) => ({
                        ...d,
                        limits: d.limits.map((x) =>
                          x.domain === l.domain ? { ...x, enabled: !x.enabled } : x,
                        ),
                      }))
                    }
                  />
                  {l.domain} <span className="muted">{l.minutes}m/day</span>
                </label>
                <button
                  className="icon-btn"
                  style={{ width: 28, height: 28, fontSize: 13 }}
                  onClick={() =>
                    setDraft((d) => ({ ...d, limits: d.limits.filter((x) => x.domain !== l.domain) }))
                  }
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="add-row">
              <input
                type="text"
                placeholder="domain, e.g. youtube.com"
                value={newLimit.domain}
                onChange={(e) => setNewLimit((n) => ({ ...n, domain: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addLimit()
                }}
              />
              <input
                type="text"
                inputMode="numeric"
                placeholder="min"
                value={newLimit.minutes}
                onChange={(e) => setNewLimit((n) => ({ ...n, minutes: e.target.value }))}
                style={{ flex: '0 0 64px' }}
              />
              <button className="btn" onClick={addLimit}>
                Add
              </button>
            </div>
          </div>
        )}

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
              <button className="btn" onClick={syncNow} disabled={test.kind === 'busy'}>
                Sync now
              </button>
              <button className="btn ghost" onClick={syncJournalNow} disabled={test.kind === 'busy'}>
                Sync today to journal
              </button>
            </div>
            <p className="muted">
              Sync now reconciles reading + books both ways (newest edit wins).
              Journal appends today's intention + goals to your daily note.
              Runs automatically every 4h and each evening.
            </p>
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
