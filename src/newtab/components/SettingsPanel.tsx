import { useEffect, useState } from 'react'
import { Download, RotateCcw, Upload, X } from 'lucide-react'
import type { CalendarFeed, QuickLink, Reminder, Settings, SiteLimit, ThemeMode } from '../../lib/types.ts'
import { FEED_COLORS, fetchFeed, refreshCalendars } from '../../lib/calendar.ts'
import { exportData, importData, listSnapshots, restoreSnapshot, type Snapshot } from '../../lib/backup.ts'
import {
  getReading,
  getSettings,
  saveReminders,
  saveSettings,
} from '../../lib/storage.ts'
import { pingVault, syncDay } from '../../lib/vault.ts'
import { syncAll } from '../../lib/vault-sync.ts'
import { toDateKey } from '../../lib/dates.ts'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

type TestState = { kind: 'idle' | 'ok' | 'err' | 'busy'; msg?: string }

const ACCENT_PRESETS = [
  { hex: '#B4532A', name: 'Terracotta' },
  { hex: '#4F7A5C', name: 'Sage' },
  { hex: '#2F6F9F', name: 'Harbour' },
  { hex: '#7A4E8C', name: 'Plum' },
  { hex: '#A07A1F', name: 'Ochre' },
  { hex: '#5B6470', name: 'Slate' },
]

export type SettingsTab = 'general' | 'calendar' | 'focus' | 'data' | 'vault'

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

export function SettingsPanel({
  open,
  tab,
  settings,
  reminders,
  calendarErrors,
  onClose,
}: {
  open: boolean
  tab: SettingsTab
  settings: Settings
  reminders: Reminder[]
  calendarErrors: Record<string, string>
  onClose: () => void
}) {
  const [active, setActive] = useState<SettingsTab>(tab)
  const [draft, setDraft] = useState<Settings>(settings)
  const [reminderList, setReminderList] = useState<Reminder[]>(reminders)
  const [newReminder, setNewReminder] = useState('')
  const [newLink, setNewLink] = useState({ label: '', url: '' })
  const [newLimit, setNewLimit] = useState({ domain: '', minutes: '30' })
  const [test, setTest] = useState<TestState>({ kind: 'idle' })

  useEffect(() => {
    if (!open) return
    setDraft(settings)
    setReminderList(reminders)
    setTest({ kind: 'idle' })
    setActive(tab)
    // Reset form only when the panel opens, not on every live storage tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [open])

  function patchVault(patch: Partial<Settings['vault']>) {
    setDraft((d) => ({ ...d, vault: { ...d.vault, ...patch } }))
  }

  async function save() {
    await saveSettings(draft)
    await saveReminders(reminderList)
    onClose()
    if (JSON.stringify(draft.calendars) !== JSON.stringify(settings.calendars)) void refreshCalendars()
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
    setTest(
      r.ok
        ? { kind: 'ok', msg: `Journal entry appended to records/journal/${toDateKey()}.md` }
        : { kind: 'err', msg: r.error ?? 'Sync failed' },
    )
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
    const link: QuickLink = {
      id: uid(),
      label,
      url: /^https?:\/\//i.test(url) ? url : `https://${url}`,
    }
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="font-serif text-xl font-medium">Settings</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Make Compass yours. Changes apply when you press Save.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4">
          <Tabs value={active} onValueChange={(v) => setActive(v as SettingsTab)}>
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
              <TabsTrigger value="focus">Focus</TabsTrigger>
              <TabsTrigger value="data">Data</TabsTrigger>
              <TabsTrigger value="vault">Vault</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="settings-body">
              <div className="field">
                <Label>Theme</Label>
                <ToggleGroup
                  type="single"
                  value={draft.theme}
                  onValueChange={(v) => {
                    if (v) setDraft((d) => ({ ...d, theme: v as ThemeMode }))
                  }}
                  className="justify-start"
                >
                  {(['auto', 'light', 'dark'] as ThemeMode[]).map((m) => (
                    <ToggleGroupItem key={m} value={m} className="px-3 capitalize">
                      {m}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <p className="text-xs text-muted-foreground">Auto follows your system, day and night.</p>
              </div>

              <div className="field">
                <Label>Accent</Label>
                <div className="accent-swatches items-center">
                  {ACCENT_PRESETS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      className={cn(
                        'accent-swatch',
                        draft.accent.toLowerCase() === c.hex.toLowerCase() && 'active',
                      )}
                      style={{ background: c.hex }}
                      title={c.name}
                      onClick={() => setDraft((d) => ({ ...d, accent: c.hex }))}
                      aria-label={`${c.name} accent`}
                    />
                  ))}
                  <input
                    type="color"
                    value={/^#[0-9a-f]{6}$/i.test(draft.accent) ? draft.accent : '#b4532a'}
                    onChange={(e) => setDraft((d) => ({ ...d, accent: e.target.value }))}
                    className="h-7 w-9 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
                    aria-label="Custom accent colour"
                    title="Pick any colour"
                  />
                </div>
              </div>

              <div className="field">
                <Label htmlFor="name">Your name</Label>
                <Input
                  id="name"
                  type="text"
                  value={draft.name}
                  placeholder="What should I call you?"
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </div>

              <div className="field">
                <Label htmlFor="readingGoal">Books to read this year</Label>
                <Input
                  id="readingGoal"
                  type="number"
                  min={0}
                  max={365}
                  value={draft.readingGoal}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, readingGoal: Math.max(0, parseInt(e.target.value, 10) || 0) }))
                  }
                  className="w-24"
                />
                <p className="text-xs text-muted-foreground">0 hides the yearly counter.</p>
              </div>

              <div className="field">
                <Label>Quick links</Label>
                {draft.quickLinks.map((l) => (
                  <div className="settings-row" key={l.id}>
                    <span className="min-w-0 truncate text-sm">
                      {l.label}{' '}
                      <span className="text-muted-foreground">{l.url}</span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          quickLinks: d.quickLinks.filter((x) => x.id !== l.id),
                        }))
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <div className="add-row">
                  <Input
                    type="text"
                    placeholder="Label"
                    value={newLink.label}
                    onChange={(e) => setNewLink((n) => ({ ...n, label: e.target.value }))}
                    className="max-w-[30%]"
                  />
                  <Input
                    type="text"
                    placeholder="URL"
                    value={newLink.url}
                    onChange={(e) => setNewLink((n) => ({ ...n, url: e.target.value }))}
                  />
                  <Button type="button" size="sm" onClick={addLink}>
                    Add
                  </Button>
                </div>
              </div>

              <div className="field">
                <Label>Reminders</Label>
                {reminderList.map((r) => (
                  <div className="settings-row" key={r.id}>
                    <div className="flex min-w-0 items-center gap-2">
                      <Switch
                        checked={r.enabled}
                        onCheckedChange={() =>
                          setReminderList((l) =>
                            l.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)),
                          )
                        }
                      />
                      <span className="truncate text-sm">{r.text}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => setReminderList((l) => l.filter((x) => x.id !== r.id))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <div className="add-row">
                  <Input
                    type="text"
                    placeholder="Add a reminder…"
                    value={newReminder}
                    onChange={(e) => setNewReminder(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addReminder()
                    }}
                  />
                  <Button type="button" size="sm" onClick={addReminder}>
                    Add
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="calendar" className="settings-body">
              <CalendarSettings
                feeds={draft.calendars}
                errors={calendarErrors}
                onChange={(calendars) => setDraft((d) => ({ ...d, calendars }))}
              />
            </TabsContent>

            <TabsContent value="data" className="settings-body">
              <DataSettings open={open && active === 'data'} />
            </TabsContent>

            <TabsContent value="focus" className="settings-body">
              <div className="field">
                <Label>Focus timer</Label>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    Focus
                    <Input
                      type="number"
                      min={5}
                      max={180}
                      value={draft.focus.focusMinutes}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          focus: { ...d.focus, focusMinutes: Math.min(180, Math.max(5, parseInt(e.target.value, 10) || 25)) },
                        }))
                      }
                      className="h-8 w-20"
                    />
                    min
                  </label>
                  <label className="flex items-center gap-2">
                    Break
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={draft.focus.breakMinutes}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          focus: { ...d.focus, breakMinutes: Math.min(60, Math.max(1, parseInt(e.target.value, 10) || 5)) },
                        }))
                      }
                      className="h-8 w-20"
                    />
                    min
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  The timer keeps running with every tab closed and sends a notification when it ends.
                </p>
              </div>

              <div className="settings-row border-0">
                <div>
                  <Label className="text-sm normal-case tracking-normal">Track time on sites</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Times how long each site is focused. Limited sites escalate: badge, banner, then
                    full-screen block.
                  </p>
                </div>
                <Switch
                  checked={draft.tracking.enabled}
                  onCheckedChange={(checked) =>
                    setDraft((d) => ({ ...d, tracking: { ...d.tracking, enabled: checked } }))
                  }
                />
              </div>

              {draft.tracking.enabled && (
                <div className="field">
                  <Label>Daily limits</Label>
                  {draft.limits.length === 0 && (
                    <p className="text-xs text-muted-foreground">No limits yet.</p>
                  )}
                  {draft.limits.map((l) => (
                    <div className="settings-row" key={l.domain}>
                      <div className="flex min-w-0 items-center gap-2">
                        <Switch
                          checked={l.enabled}
                          onCheckedChange={() =>
                            setDraft((d) => ({
                              ...d,
                              limits: d.limits.map((x) =>
                                x.domain === l.domain ? { ...x, enabled: !x.enabled } : x,
                              ),
                            }))
                          }
                        />
                        <span className="truncate text-sm">
                          {l.domain}{' '}
                          <span className="text-muted-foreground">{l.minutes}m/day</span>
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            limits: d.limits.filter((x) => x.domain !== l.domain),
                          }))
                        }
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <div className="add-row">
                    <Input
                      type="text"
                      placeholder="domain, e.g. youtube.com"
                      value={newLimit.domain}
                      onChange={(e) => setNewLimit((n) => ({ ...n, domain: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addLimit()
                      }}
                    />
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="min"
                      value={newLimit.minutes}
                      onChange={(e) => setNewLimit((n) => ({ ...n, minutes: e.target.value }))}
                      className="w-16 shrink-0"
                    />
                    <Button type="button" size="sm" onClick={addLimit}>
                      Add
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="vault" className="settings-body">
              <div className="settings-row border-0">
                <div>
                  <Label className="text-sm normal-case tracking-normal">
                    Sync to Obsidian vault
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Needs Local REST API plugin with HTTP server enabled.
                  </p>
                </div>
                <Switch
                  checked={draft.vault.enabled}
                  onCheckedChange={(checked) => patchVault({ enabled: checked })}
                />
              </div>

              {draft.vault.enabled && (
                <>
                  <div className="field">
                    <Label htmlFor="apiBase">API base URL</Label>
                    <Input
                      id="apiBase"
                      type="text"
                      value={draft.vault.apiBase}
                      onChange={(e) => patchVault({ apiBase: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <Label htmlFor="apiKey">API key</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      value={draft.vault.apiKey}
                      placeholder="Bearer token from the plugin"
                      onChange={(e) => patchVault({ apiKey: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={testConnection}
                      disabled={test.kind === 'busy'}
                    >
                      Test connection
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={syncNow}
                      disabled={test.kind === 'busy'}
                    >
                      Sync now
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={syncJournalNow}
                      disabled={test.kind === 'busy'}
                    >
                      Sync today to journal
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sync reconciles reading + books both ways. Journal appends today&apos;s
                    intention + goals. Auto every 4h and each evening.
                  </p>
                  {test.msg && (
                    <p
                      className={cn(
                        'text-xs',
                        test.kind === 'ok' && 'text-foreground',
                        test.kind === 'err' && 'text-destructive',
                        test.kind === 'busy' && 'text-muted-foreground',
                      )}
                    >
                      {test.kind === 'busy' ? 'Working…' : test.msg}
                    </p>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={save}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CalendarSettings({
  feeds,
  errors,
  onChange,
}: {
  feeds: CalendarFeed[]
  errors: Record<string, string>
  onChange: (feeds: CalendarFeed[]) => void
}) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [state, setState] = useState<TestState>({ kind: 'idle' })

  async function add() {
    const link = url.trim()
    if (!link) return
    if (!/^(https?|webcal):\/\//i.test(link)) {
      setState({ kind: 'err', msg: 'That should be a link starting with https:// or webcal://.' })
      return
    }
    setState({ kind: 'busy' })
    const id = uid()
    try {
      const now = Date.now()
      const events = await fetchFeed(link, id, now, now + 30 * 86_400_000)
      onChange([
        ...feeds,
        {
          id,
          name: name.trim() || `Calendar ${feeds.length + 1}`,
          url: link,
          color: FEED_COLORS[feeds.length % FEED_COLORS.length],
          enabled: true,
        },
      ])
      setName('')
      setUrl('')
      setState({
        kind: 'ok',
        msg: `Connected — ${events.length} event${events.length === 1 ? '' : 's'} in the next 30 days. Press Save to keep it.`,
      })
    } catch (e) {
      setState({ kind: 'err', msg: e instanceof Error ? e.message : 'Could not read that calendar.' })
    }
  }

  const patch = (id: string, p: Partial<CalendarFeed>) =>
    onChange(feeds.map((f) => (f.id === id ? { ...f, ...p } : f)))

  return (
    <>
      <div className="field">
        <Label>Connected calendars</Label>
        {feeds.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
        {feeds.map((f) => (
          <div key={f.id} className="settings-row">
            <div className="flex min-w-0 items-center gap-2.5">
              <Switch checked={f.enabled} onCheckedChange={(enabled) => patch(f.id, { enabled })} />
              <label className="relative">
                <span className="feed-dot block" style={{ background: f.color }} />
                <input
                  type="color"
                  value={f.color}
                  onChange={(e) => patch(f.id, { color: e.target.value })}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label={`Colour for ${f.name}`}
                />
              </label>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{f.name}</div>
                {errors[f.id] ? (
                  <div className="text-xs status-err">{errors[f.id]}</div>
                ) : (
                  <div className="truncate text-xs text-muted-foreground">{f.url.replace(/^\w+:\/\//, '').slice(0, 48)}…</div>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              aria-label={`Remove ${f.name}`}
              onClick={() => onChange(feeds.filter((x) => x.id !== f.id))}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="field">
        <Label>Add a calendar</Label>
        <Input placeholder="Name (e.g. Work)" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="add-row">
          <Input
            placeholder="iCal link (https://… .ics)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void add()}
          />
          <Button type="button" size="sm" onClick={() => void add()} disabled={state.kind === 'busy' || !url.trim()}>
            {state.kind === 'busy' ? 'Checking…' : 'Connect'}
          </Button>
        </div>
        {state.msg && <p className={cn('text-xs', state.kind === 'err' ? 'status-err' : 'text-muted-foreground')}>{state.msg}</p>}
        <details className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">Where do I find the link?</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>
              <b>Google Calendar</b>: Settings → pick your calendar → Integrate calendar → copy the{' '}
              <i>Secret address in iCal format</i>.
            </li>
            <li>
              <b>Outlook</b>: Settings → Calendar → Shared calendars → Publish a calendar → copy the ICS link.
            </li>
            <li>
              <b>Apple iCloud</b>: Calendar → share icon next to a calendar → Public Calendar → copy the link.
            </li>
          </ul>
          <p className="mt-2">
            The link is private — it’s stored only in this browser and fetched directly from your calendar provider every
            15 minutes. Compass only reads it.
          </p>
        </details>
      </div>
    </>
  )
}

function DataSettings({ open }: { open: boolean }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [msg, setMsg] = useState<TestState>({ kind: 'idle' })

  useEffect(() => {
    if (open) void listSnapshots().then(setSnapshots).catch(() => setSnapshots([]))
  }, [open])

  async function doExport() {
    const file = await exportData()
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `compass-backup-${file.exportedAt.slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    setMsg({ kind: 'ok', msg: 'Exported. Your Obsidian API key is left out of the file.' })
  }

  async function doImport(f: File) {
    try {
      const keys = await importData(JSON.parse(await f.text()))
      setMsg({ kind: 'ok', msg: `Restored ${keys.join(', ')}. A safety snapshot was taken first.` })
      setSnapshots(await listSnapshots())
    } catch (e) {
      setMsg({ kind: 'err', msg: e instanceof Error ? e.message : 'Import failed.' })
    }
  }

  async function doRestore(s: Snapshot) {
    const when = new Date(s.ts).toLocaleString()
    if (!window.confirm(`Replace your current data with the snapshot from ${when}? A safety snapshot of today is taken first.`)) return
    try {
      await restoreSnapshot(s.id)
      setMsg({ kind: 'ok', msg: `Restored the snapshot from ${when}.` })
      setSnapshots(await listSnapshots())
    } catch (e) {
      setMsg({ kind: 'err', msg: e instanceof Error ? e.message : 'Restore failed.' })
    }
  }

  return (
    <>
      <div className="field">
        <Label>Backup file</Label>
        <p className="text-xs text-muted-foreground">
          Everything — tasks, goals, books, habits, notes, settings — in one JSON file you keep.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void doExport()}>
            <Download /> Export
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <label>
              <Upload /> Import…
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void doImport(f)
                  e.target.value = ''
                }}
              />
            </label>
          </Button>
        </div>
      </div>

      <div className="field">
        <Label>Daily snapshots</Label>
        <p className="text-xs text-muted-foreground">
          Compass saves a copy of your data once a day and keeps the last 14, in case something goes wrong.
        </p>
        {snapshots.length === 0 ? (
          <p className="text-sm text-muted-foreground">The first snapshot is taken shortly after install.</p>
        ) : (
          snapshots.map((s) => (
            <div key={s.id} className="settings-row">
              <span className="text-sm">
                {new Date(s.ts).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                {s.id.endsWith('before-restore') && <span className="ml-2 text-xs text-muted-foreground">before a restore</span>}
              </span>
              <Button type="button" variant="ghost" size="xs" onClick={() => void doRestore(s)}>
                <RotateCcw /> Restore
              </Button>
            </div>
          ))
        )}
      </div>
      {msg.msg && <p className={cn('text-xs', msg.kind === 'err' ? 'status-err' : 'text-muted-foreground')}>{msg.msg}</p>}
    </>
  )
}
