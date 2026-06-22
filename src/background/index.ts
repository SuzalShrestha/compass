import { toDateKey } from '../lib/dates.ts'
import { computeStage, domainOf, SNOOZE_MINUTES, type Stage } from '../lib/tracker.ts'
import { addUsage, getDomainSeconds } from '../lib/usage.ts'
import {
  addReadingItem,
  getSession,
  getSettings,
  getTrackerState,
  pingUsage,
  setSession,
  setTrackerState,
} from '../lib/storage.ts'
import { syncReadingItem } from '../lib/vault.ts'
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
  })
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return
  const url = info.linkUrl ?? info.pageUrl ?? tab?.url
  if (!url) return

  const item = await addReadingItem({ title: tab?.title ?? url, url, kind: 'article', status: 'queue' })
  const settings = await getSettings()
  if (settings.vault.enabled) await syncReadingItem(settings.vault, item)

  await chrome.action.setBadgeText({ text: '✓' })
  await chrome.action.setBadgeBackgroundColor({ color: '#5ed29a' })
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
const IDLE_THRESHOLD_SECONDS = 30
/** Cap a single commit so a slept/suspended machine can't bank hours of "use". */
const MAX_SEGMENT_SECONDS = 300

function ensureAlarm() {
  chrome.alarms.create(ALARM, { periodInMinutes: 1 })
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

async function setBadge(text: string, color = '#5ed29a'): Promise<void> {
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

  // Badge reflects how close you are: minutes left (amber), then "!" amber, then red.
  if (stage === 0) {
    await setBadge('')
  } else if (stage === 1) {
    const left = Math.max(0, Math.ceil((limit.minutes * 60 - used) / 60))
    await setBadge(`${left}m`, '#e0a84e')
  } else {
    await setBadge('!', stage === 3 ? '#ff5c5c' : '#e0a84e')
  }

  if (stage < 2) return

  const state = await getTrackerState(toDateKey())
  if (now < (state.snooze[domain] ?? 0)) return // snoozed — leave the page alone

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: renderLimitOverlay,
      args: [stage as 2 | 3, domain, Math.round(used / 60), limit.minutes, quoteForDay().text],
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
  type: 'compass-snooze' | 'compass-close'
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
      await setBadge('💤', '#e0a84e')
    })()
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
})
chrome.runtime.onStartup.addListener(() => {
  ensureAlarm()
  void recompute()
})

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === ALARM) void recompute()
})

chrome.tabs.onActivated.addListener(() => void recompute())
chrome.tabs.onUpdated.addListener((_tabId, change, tab) => {
  if ((change.url || change.status === 'complete') && tab.active) void recompute()
})
chrome.windows.onFocusChanged.addListener(() => void recompute())

chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS)
chrome.idle.onStateChanged.addListener(() => void recompute())
