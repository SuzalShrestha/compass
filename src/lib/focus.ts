import type { FocusState } from './types.ts'
import { addFocusMinutes, getFocus, getSettings, saveFocus } from './storage.ts'
import { toDateKey } from './dates.ts'

// ---------------------------------------------------------------------------
// Focus timer.
//
// State lives in storage with an absolute `endsAt`, and a chrome alarm fires
// at that instant — so the timer keeps running with every tab closed, and the
// background (not the page) records the minutes and sends the notification.
// ---------------------------------------------------------------------------

export const FOCUS_ALARM = 'compass-focus'

const hasAlarms = () => typeof chrome !== 'undefined' && !!chrome.alarms

export async function startFocus(kind: FocusState['kind'], minutes: number, label?: string): Promise<void> {
  const endsAt = Date.now() + minutes * 60_000
  await saveFocus({ status: 'running', kind, minutes, endsAt, label: label?.trim() || undefined })
  if (hasAlarms()) await chrome.alarms.create(FOCUS_ALARM, { when: endsAt })
}

export async function pauseFocus(): Promise<void> {
  const f = await getFocus()
  if (f.status !== 'running' || !f.endsAt) return
  await saveFocus({ ...f, status: 'paused', remaining: Math.max(0, f.endsAt - Date.now()), endsAt: undefined })
  if (hasAlarms()) await chrome.alarms.clear(FOCUS_ALARM)
}

export async function resumeFocus(): Promise<void> {
  const f = await getFocus()
  if (f.status !== 'paused' || f.remaining == null) return
  const endsAt = Date.now() + f.remaining
  await saveFocus({ ...f, status: 'running', endsAt, remaining: undefined })
  if (hasAlarms()) await chrome.alarms.create(FOCUS_ALARM, { when: endsAt })
}

export async function stopFocus(): Promise<void> {
  const f = await getFocus()
  await saveFocus({ status: 'idle', kind: f.kind, minutes: f.minutes, label: f.label })
  if (hasAlarms()) await chrome.alarms.clear(FOCUS_ALARM)
}

let completing: Promise<FocusState | null> = Promise.resolve(null)

/**
 * Finish a running session whose time is up: bank focus minutes and queue up
 * the opposite kind. Returns the finished session, or null if nothing was due.
 * Chained so the startup check and a missed alarm firing together can't both
 * see "running" and count the minutes twice.
 */
export function completeFocus(): Promise<FocusState | null> {
  completing = completing.then(finishIfDue, finishIfDue)
  return completing
}

async function finishIfDue(): Promise<FocusState | null> {
  const f = await getFocus()
  if (f.status !== 'running' || !f.endsAt || f.endsAt > Date.now() + 1000) return null
  if (f.kind === 'focus') await addFocusMinutes(toDateKey(), f.minutes)
  const { focus } = await getSettings()
  const kind = f.kind === 'focus' ? 'break' : 'focus'
  await saveFocus({
    status: 'idle',
    kind,
    minutes: kind === 'focus' ? focus.focusMinutes : focus.breakMinutes,
    label: f.label,
  })
  return f
}
