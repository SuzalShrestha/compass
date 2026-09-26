import type { CalEvent, CalendarCache } from './types.ts'
import { expandEvents } from './ics.ts'
import { getCalendarCache, getSettings, saveCalendarCache } from './storage.ts'

// ---------------------------------------------------------------------------
// Calendar feeds.
//
// Each feed is an iCal URL the user pasted (Google: Settings → your calendar →
// "Secret address in iCal format"). The background refreshes every 15 minutes
// and the home page reads the cached, pre-expanded occurrences — so opening a
// new tab never waits on the network. These fetches go only to URLs the user
// entered.
// ---------------------------------------------------------------------------

const DAY = 86_400_000
const PAST_DAYS = 7
const FUTURE_DAYS = 90

export const FEED_COLORS = ['#B4532A', '#2F6F9F', '#4F7A5C', '#7A4E8C', '#A07A1F', '#5B6470']

export function normalizeFeedUrl(url: string): string {
  return url.trim().replace(/^webcal:\/\//i, 'https://')
}

export async function fetchFeed(url: string, feedId: string, from: number, to: number): Promise<CalEvent[]> {
  let res: Response
  try {
    res = await fetch(normalizeFeedUrl(url), {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })
  } catch (e) {
    throw new Error(
      e instanceof DOMException && e.name === 'TimeoutError'
        ? 'The calendar took too long to answer. Try again in a bit.'
        : "Couldn't reach that address. Check the link and your connection.",
    )
  }
  if (res.status === 401 || res.status === 403 || res.status === 404) {
    throw new Error('The calendar refused the link — it may have been reset. Copy a fresh iCal address.')
  }
  if (!res.ok) throw new Error(`The calendar server answered ${res.status}.`)
  const text = await res.text()
  if (!text.includes('BEGIN:VCALENDAR')) {
    throw new Error("That link didn't return a calendar. Use the iCal (.ics) address.")
  }
  return expandEvents(text, feedId, from, to)
}

/**
 * Re-fetch every enabled feed. A feed that fails keeps its last good events,
 * so a flaky connection never blanks the agenda — the error is recorded
 * alongside for Settings to show.
 */
export async function refreshCalendars(): Promise<CalendarCache> {
  const { calendars } = await getSettings()
  const feeds = calendars.filter((f) => f.enabled && f.url.trim())
  const prev = await getCalendarCache()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const from = today.getTime() - PAST_DAYS * DAY
  const to = today.getTime() + FUTURE_DAYS * DAY

  const errors: Record<string, string> = {}
  const lists = await Promise.all(
    feeds.map(async (f) => {
      try {
        return await fetchFeed(f.url, f.id, from, to)
      } catch (e) {
        errors[f.id] = e instanceof Error ? e.message : String(e)
        return prev.events.filter((ev) => ev.feedId === f.id)
      }
    }),
  )
  const cache: CalendarCache = {
    fetchedAt: Date.now(),
    events: lists.flat().sort((a, b) => a.start - b.start),
    errors,
  }
  await saveCalendarCache(cache)
  return cache
}

/** Events that overlap the local day `dateKey`, all-day ones first. */
export function eventsOn(events: CalEvent[], dateKey: string): CalEvent[] {
  const start = new Date(`${dateKey}T00:00:00`).getTime()
  const next = new Date(`${dateKey}T00:00:00`)
  next.setDate(next.getDate() + 1)
  const end = next.getTime()
  return events
    .filter((e) => e.start < end && (e.end > start || (e.end === e.start && e.start >= start)))
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start - b.start)
}
