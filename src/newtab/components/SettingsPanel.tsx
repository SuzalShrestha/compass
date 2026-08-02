import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
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

const ACCENT_PRESETS = ['#6B7686', '#8B98AA', '#5B6470', '#4A5258', '#9CA3AF']

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

export function SettingsPanel({
  open,
  settings,
  reminders,
  onClose,
}: {
  open: boolean
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

  useEffect(() => {
    if (!open) return
    setDraft(settings)
    setReminderList(reminders)
    setTest({ kind: 'idle' })
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
          <DialogTitle className="text-base font-semibold tracking-tight">Settings</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Appearance, links, focus, and vault sync.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4">
          <Tabs defaultValue="general">
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="focus">Focus</TabsTrigger>
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
                <p className="text-xs text-muted-foreground">
                  Auto follows your system. Light is canonical Swiss.
                </p>
              </div>

              <div className="field">
                <Label>Accent</Label>
                <div className="accent-swatches items-center">
                  {ACCENT_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={cn(
                        'accent-swatch',
                        draft.accent.toLowerCase() === c.toLowerCase() && 'active',
                      )}
                      style={{ background: c }}
                      title={c}
                      onClick={() => setDraft((d) => ({ ...d, accent: c }))}
                      aria-label={`Accent ${c}`}
                    />
                  ))}
                  <Input
                    type="text"
                    value={draft.accent}
                    onChange={(e) => setDraft((d) => ({ ...d, accent: e.target.value }))}
                    placeholder="#6B7686"
                    className="ml-1 h-8 w-24"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Used sparingly — most hierarchy is typographic.
                </p>
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

            <TabsContent value="focus" className="settings-body">
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
