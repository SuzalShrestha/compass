import { toDateKey } from '../lib/dates.ts'
import { importHistory } from '../lib/history.ts'
import { computeStage, domainOf, SNOOZE_MINUTES, type Stage } from '../lib/tracker.ts'
import { addUsage, getDomainSeconds } from '../lib/usage.ts'
import {
  addDistraction,
  addReadingItem,
  getAllDays,
  getReading,
  getSession,
  getSettings,
  getTrackerState,
  pingUsage,
  setSession,
  setTrackerState,
  setVaultSyncState,
} from '../lib/storage.ts'
import { syncReadingItem, syncHighlight } from '../lib/vault.ts'
import { syncAll } from '../lib/vault-sync.ts'
import { quoteForDay } from '../lib/quotes.ts'
import { renderLimitOverlay } from '../content/overlay.ts'
import type { Settings } from '../lib/types.ts'

// ---------------------------------------------------------------------------
// Save to read later (context menu)
// ---------------------------------------------------------------------------

const MENU_ID = 'compass-save-page'

function setupMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Save to Compass (read later)',
      contexts: ['page', 'link', 'selection'],
    })
    chrome.contextMenus.create({
      id: HIGHLIGHT_MENU,
      title: 'Save highlight to vault',
      contexts: ['selection'],
    })
  })
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === HIGHLIGHT_MENU) {
    const text = info.selectionText?.trim()
    if (!text) return
    const settings = await getSettings()
    if (!settings.vault.enabled) return
    await syncHighlight(settings.vault, text, {
      url: info.pageUrl ?? tab?.url,
      title: tab?.title,
    })
    return
  }
  if (info.menuItemId !== MENU_ID) return
  const url = info.linkUrl ?? info.pageUrl ?? tab?.url
  if (!url) return

  const item = await addReadingItem({ title: tab?.title ?? url, url, kind: 'article', status: 'queue' })
  const settings = await getSettings()
  if (settings.vault.enabled) await syncReadingItem(settings.vault, item)

  await chrome.action.setBadgeText({ text: '✓' })
  await chrome.action.setBadgeBackgroundColor({ color: '#6B7686' })
  setTimeout(() => void recompute(), 1600) // restore the limit badge afterwards
})

// ---------------------------------------------------------------------------
// Time tracking
//
// Timestamp-based accumulation that survives service-worker suspension: the
// active segment lives in storage as { domain, since }. On every relevant
// event (and once a minute via an alarm) we commit the elapsed delta to the
// current domain, then recompute which domain is active now.
// ---------------------------------------------------------------------------

const ALARM = 'compass-tracker'
const HISTORY_ALARM = 'compass-history'
const VAULT_SYNC_ALARM = 'compass-vault-sync'
const JOURNAL_ALARM = 'compass-journal'
const HIGHLIGHT_MENU = 'compass-save-highlight'
const IDLE_THRESHOLD_SECONDS = 30
/** Cap a single commit so a slept/suspended machine can't bank hours of "use". */
const MAX_SEGMENT_SECONDS = 300

// ---------------------------------------------------------------------------
// Vault sync + journal capture
//
// syncAll runs every 4h (and on startup) and reconciles reading + books both
// ways. The journal alarm fires once an evening (default 21:00) to append the
// day's intention + goals into records/journal/<date>.md — the evening bookend
// to the morning page.
// ---------------------------------------------------------------------------

async function runVaultSync(): Promise<void> {
  const settings = await getSettings()
  if (!settings.vault.enabled) return
  const items = await getReading()
  const report = await syncAll(settings.vault, items)
  await setVaultSyncState({ lastSyncAt: Date.now(), lastReport: report })
}

async function runJournalSync(): Promise<void> {
  const settings = await getSettings()
  if (!settings.vault.enabled) return
  const days = await getAllDays()
  const day = days[toDateKey()]
  if (!day || (day.goals.length === 0 && !day.intention)) return
  // syncDay is append-only, so re-running is safe (it just adds another block).
  const { syncDay } = await import('../lib/vault.ts')
  await syncDay(settings.vault, day)
}

function ensureAlarm() {
  chrome.alarms.create(ALARM, { periodInMinutes: 1 })
  // Refresh history insights once a day (full re-scan is cheap).
  chrome.alarms.create(HISTORY_ALARM, { periodInMinutes: 60 * 24 })
  // Two-way vault sync every 4 hours.
  chrome.alarms.create(VAULT_SYNC_ALARM, { periodInMinutes: 60 * 4 })
  // Evening journal capture — fires every hour but only writes ~21:00.
  chrome.alarms.create(JOURNAL_ALARM, { periodInMinutes: 60 })
}

async function commit(now: number): Promise<void> {
  const session = await getSession()
  if (!session?.domain || !session.since) return
  const delta = Math.min((now - session.since) / 1000, MAX_SEGMENT_SECONDS)
  if (delta >= 1) {
    await addUsage(toDateKey(), session.domain, delta)
    await pingUsage()
  }
}

async function activeDomain(): Promise<{ domain: string | null; tabId?: number }> {
  const idle = (await chrome.idle.queryState(IDLE_THRESHOLD_SECONDS)) !== 'active'
  let focused = false
  try {
    focused = (await chrome.windows.getLastFocused()).focused
  } catch {
    focused = false
  }
  if (idle || !focused) return { domain: null }
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  return { domain: domainOf(tab?.url), tabId: tab?.id }
}

async function recompute(): Promise<void> {
  const now = Date.now()
  await commit(now)

  const settings = await getSettings()
  if (!settings.tracking.enabled) {
    await setSession(null)
    await setBadge('')
    return
  }

  const { domain, tabId } = await activeDomain()
  await setSession({ domain, since: now })

  if (domain && tabId != null) await enforce(domain, tabId, now, settings)
  else await setBadge('')
}

// ---------------------------------------------------------------------------
// Escalating limits
// ---------------------------------------------------------------------------

async function setBadge(text: string, color = '#6B7686'): Promise<void> {
  await chrome.action.setBadgeText({ text })
  if (text) await chrome.action.setBadgeBackgroundColor({ color })
}

async function enforce(
  domain: string,
  tabId: number,
  now: number,
  settings: Settings,
): Promise<void> {
  const limit = settings.limits.find((l) => l.enabled && l.domain === domain)
  if (!limit) {
    await setBadge('')
    return
  }

  const used = await getDomainSeconds(toDateKey(), domain)
  const stage = computeStage(used, limit.minutes)

  // Badge reflects how close you are: minutes left (accent), then "!" (ink).
  if (stage === 0) {
    await setBadge('')
  } else if (stage === 1) {
    const left = Math.max(0, Math.ceil((limit.minutes * 60 - used) / 60))
    await setBadge(`${left}m`, settings.accent)
  } else {
    await setBadge('!', stage === 3 ? '#0a0a0a' : '#71717a')
  }

  if (stage < 2) return

  const state = await getTrackerState(toDateKey())
  if (now < (state.snooze[domain] ?? 0)) return // snoozed — leave the page alone

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: renderLimitOverlay,
      args: [stage as 2 | 3, domain, Math.round(used / 60), limit.minutes, quoteForDay().text, settings.accent],
    })
    await setTrackerState({
      ...state,
      notified: { ...state.notified, [domain]: stage as Stage },
    })
  } catch {
    // Restricted page (chrome://, web store, PDF viewer, …) — can't inject.
  }
}

// ---------------------------------------------------------------------------
// Messages from the injected overlay
// ---------------------------------------------------------------------------

interface OverlayMessage {
  type: 'compass-snooze' | 'compass-close' | 'compass-distraction'
  domain?: string
}

chrome.runtime.onMessage.addListener((raw, sender) => {
  const msg = raw as OverlayMessage
  if (msg?.type === 'compass-snooze' && msg.domain) {
    void (async () => {
      const state = await getTrackerState(toDateKey())
      await setTrackerState({
        ...state,
        snooze: { ...state.snooze, [msg.domain!]: Date.now() + SNOOZE_MINUTES * 60_000 },
      })
      await setBadge('💤', '#71717a')
    })()
  } else if (msg?.type === 'compass-distraction' && msg.domain) {
    void addDistraction({ domain: msg.domain })
  } else if (msg?.type === 'compass-close' && sender.tab?.id != null) {
    void chrome.tabs.remove(sender.tab.id)
  }
})

// ---------------------------------------------------------------------------
// Lifecycle wiring
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(() => {
  setupMenu()
  ensureAlarm()
  void recompute()
  // One-time full history import on install/update.
  void importHistory()
  // Kick off a vault sync shortly after install.
  setTimeout(() => void runVaultSync(), 5000)
})
chrome.runtime.onStartup.addListener(() => {
  ensureAlarm()
  void recompute()
  void runVaultSync()
})

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === ALARM) void recompute()
  else if (a.name === HISTORY_ALARM) void importHistory()
  else if (a.name === VAULT_SYNC_ALARM) void runVaultSync()
  else if (a.name === JOURNAL_ALARM) {
    // Only write the journal entry in the evening (20–22h) so a lunchtime
    // alarm tick doesn't capture a half-finished day.
    const h = new Date().getHours()
    if (h >= 20 && h <= 22) void runJournalSync()
  }
})

chrome.tabs.onActivated.addListener(() => void recompute())
chrome.tabs.onUpdated.addListener((_tabId, change, tab) => {
  if ((change.url || change.status === 'complete') && tab.active) void recompute()
})
chrome.windows.onFocusChanged.addListener(() => void recompute())

chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS)
chrome.idle.onStateChanged.addListener(() => void recompute())
