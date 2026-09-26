import type { CalEvent } from './types.ts'

// ---------------------------------------------------------------------------
// Minimal iCalendar (RFC 5545) reader.
//
// Enough to turn a Google / Outlook / Apple "secret iCal address" into concrete
// event occurrences for a date window: line unfolding, TZID-aware times,
// all-day events, RRULE (DAILY/WEEKLY/MONTHLY/YEARLY with INTERVAL, COUNT,
// UNTIL, BYDAY incl. ordinals, BYMONTHDAY, BYMONTH), EXDATE, and moved or
// cancelled single occurrences (RECURRENCE-ID).
// ponytail: no BYSETPOS / BYWEEKNO / BYYEARDAY / RDATE, and Windows zone names
// ("Eastern Standard Time") fall back to local time. Add when a feed needs it.
// ---------------------------------------------------------------------------

const DAY = 86_400_000

interface Prop {
  name: string
  params: Record<string, string>
  value: string
}

interface Wall {
  y: number
  m: number
  d: number
  h: number
  mi: number
  s: number
}

interface DT {
  wall: Wall
  /** 'UTC', an IANA zone, or null for floating/local time. */
  zone: string | null
  allDay: boolean
}

interface RawEvent {
  uid: string
  title: string
  location?: string
  start: DT
  end?: DT
  durationMs?: number
  rrule?: string
  exdates: Set<number>
  recurrenceId?: number
  cancelled: boolean
}

function unfold(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n')
}

function parseLine(line: string): Prop | null {
  // The value starts at the first colon that isn't inside a quoted param.
  let i = 0
  let quoted = false
  for (; i < line.length; i++) {
    const c = line[i]
    if (c === '"') quoted = !quoted
    else if (c === ':' && !quoted) break
  }
  if (i >= line.length) return null
  const [name, ...rest] = line.slice(0, i).split(';')
  const params: Record<string, string> = {}
  for (const p of rest) {
    const eq = p.indexOf('=')
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '')
  }
  return { name: name.toUpperCase(), params, value: line.slice(i + 1) }
}

function unescapeText(v: string): string {
  return v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim()
}

function parseDT(value: string, params: Record<string, string>): DT | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim())
  if (!m) return null
  const allDay = params.VALUE === 'DATE' || m[4] == null
  return {
    wall: { y: +m[1], m: +m[2], d: +m[3], h: +(m[4] ?? 0), mi: +(m[5] ?? 0), s: +(m[6] ?? 0) },
    zone: allDay ? null : m[7] ? 'UTC' : (params.TZID ?? null),
    allDay,
  }
}

/** ISO 8601 duration → ms. Handles the P#W / P#DT#H#M#S shapes feeds use. */
function parseDuration(v: string): number | undefined {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim())
  if (!m) return undefined
  const ms = ((+(m[2] ?? 0) * 7 + +(m[3] ?? 0)) * 24 * 3600 + +(m[4] ?? 0) * 3600 + +(m[5] ?? 0) * 60 + +(m[6] ?? 0)) * 1000
  return m[1] === '-' ? -ms : ms
}

// ---- Time zones -----------------------------------------------------------

const formatters = new Map<string, Intl.DateTimeFormat | null>()

function formatterFor(zone: string): Intl.DateTimeFormat | null {
  if (!formatters.has(zone)) {
    try {
      formatters.set(
        zone,
        new Intl.DateTimeFormat('en-US', {
          timeZone: zone,
          hourCycle: 'h23',
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          second: 'numeric',
        }),
      )
    } catch {
      formatters.set(zone, null)
    }
  }
  return formatters.get(zone) ?? null
}

/** How far `zone`'s wall clock is ahead of UTC at instant `utc`. */
function zoneOffset(utc: number, fmt: Intl.DateTimeFormat): number {
  const p: Record<string, number> = {}
  for (const part of fmt.formatToParts(new Date(utc))) p[part.type] = Number(part.value)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(utc / 1000) * 1000
}

/** Wall-clock time in a zone → epoch ms. */
export function wallToEpoch(w: Wall, zone: string | null): number {
  const utcGuess = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s)
  if (zone === 'UTC') return utcGuess
  const fmt = zone ? formatterFor(zone) : null
  if (!fmt) return new Date(w.y, w.m - 1, w.d, w.h, w.mi, w.s).getTime()
  // Two passes so times near a DST switch pick up the right offset.
  const first = utcGuess - zoneOffset(utcGuess, fmt)
  return utcGuess - zoneOffset(first, fmt)
}

function dtToEpoch(dt: DT): number {
  if (dt.allDay) return new Date(dt.wall.y, dt.wall.m - 1, dt.wall.d).getTime()
  return wallToEpoch(dt.wall, dt.zone)
}

// ---- Recurrence -----------------------------------------------------------

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

interface Rule {
  freq: string
  interval: number
  count?: number
  until?: number
  byday: { wd: number; n: number }[]
  bymonthday: number[]
  bymonth: number[]
}

function parseRule(v: string): Rule | null {
  const r: Record<string, string> = {}
  for (const part of v.split(';')) {
    const [k, val] = part.split('=')
    if (k && val) r[k.toUpperCase()] = val
  }
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(r.FREQ)) return null
  let until: number | undefined
  if (r.UNTIL) {
    const dt = parseDT(r.UNTIL, {})
    // A date-only UNTIL includes that whole day.
    if (dt) until = dt.allDay ? dtToEpoch(dt) + DAY - 1 : dtToEpoch(dt)
  }
  return {
    freq: r.FREQ,
    interval: Math.max(1, Number(r.INTERVAL) || 1),
    count: r.COUNT ? Number(r.COUNT) : undefined,
    until,
    byday: (r.BYDAY ?? '')
      .split(',')
      .filter(Boolean)
      .map((s) => {
        const m = /^([+-]?\d+)?([A-Z]{2})$/.exec(s.trim())
        return m ? { n: m[1] ? Number(m[1]) : 0, wd: WEEKDAYS.indexOf(m[2]) } : { n: 0, wd: -1 }
      })
      .filter((b) => b.wd >= 0),
    bymonthday: (r.BYMONTHDAY ?? '').split(',').filter(Boolean).map(Number),
    bymonth: (r.BYMONTH ?? '').split(',').filter(Boolean).map(Number),
  }
}

const weekday = (dayMs: number) => new Date(dayMs).getUTCDay()
const daysIn = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate()

/** Candidate days (UTC-midnight ms) within one month, for MONTHLY/YEARLY rules. */
function monthDays(y: number, m0: number, rule: Rule, fallbackDay: number): number[] {
  const len = daysIn(y, m0)
  const out: number[] = []
  if (rule.bymonthday.length) {
    for (const md of rule.bymonthday) {
      const d = md > 0 ? md : len + md + 1
      if (d >= 1 && d <= len) out.push(Date.UTC(y, m0, d))
    }
  } else if (rule.byday.length) {
    for (const { wd, n } of rule.byday) {
      const matches: number[] = []
      for (let d = 1; d <= len; d++) {
        const ms = Date.UTC(y, m0, d)
        if (weekday(ms) === wd) matches.push(ms)
      }
      if (n === 0) out.push(...matches)
      else {
        const pick = n > 0 ? matches[n - 1] : matches[matches.length + n]
        if (pick != null) out.push(pick)
      }
    }
  } else if (fallbackDay <= len) {
    out.push(Date.UTC(y, m0, fallbackDay))
  }
  return out.sort((a, b) => a - b)
}

/** Candidate days in chronological order, starting at or before the first. */
function* candidateDays(start: Wall, rule: Rule): Generator<number> {
  const first = Date.UTC(start.y, start.m - 1, start.d)
  const step = rule.interval
  if (rule.freq === 'DAILY') {
    for (let k = 0; ; k++) {
      const day = first + k * step * DAY
      if (!rule.byday.length || rule.byday.some((b) => b.wd === weekday(day))) yield day
    }
  }
  if (rule.freq === 'WEEKLY') {
    const wds = (rule.byday.length ? rule.byday.map((b) => b.wd) : [weekday(first)])
      .map((wd) => (wd + 6) % 7) // Monday-first offsets
      .sort((a, b) => a - b)
    const monday = first - ((weekday(first) + 6) % 7) * DAY
    for (let k = 0; ; k++) {
      for (const off of wds) yield monday + (k * step * 7 + off) * DAY
    }
  }
  if (rule.freq === 'MONTHLY') {
    for (let k = 0; ; k++) {
      const m = start.m - 1 + k * step
      yield* monthDays(start.y + Math.floor(m / 12), m % 12, rule, start.d)
    }
  }
  if (rule.freq === 'YEARLY') {
    for (let k = 0; ; k++) {
      const y = start.y + k * step
      for (const month of rule.bymonth.length ? [...rule.bymonth].sort((a, b) => a - b) : [start.m]) {
        yield* monthDays(y, month - 1, rule, start.d)
      }
    }
  }
}

/** Start instants of each occurrence of `ev` in [from - lead, to). */
function occurrences(ev: RawEvent, rule: Rule, from: number, to: number): number[] {
  const firstStart = dtToEpoch(ev.start)
  // Days far enough before the window can't overlap it; without COUNT there's
  // nothing to tally, so skip the zone maths for them.
  const skipBefore = rule.count == null ? from - 40 * DAY : -Infinity
  const out: number[] = []
  let seen = 0
  let guard = 0
  for (const day of candidateDays(ev.start.wall, rule)) {
    if (++guard > 100_000) break
    if (day < skipBefore) continue
    const d = new Date(day)
    const wall = { ...ev.start.wall, y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }
    const start = dtToEpoch({ ...ev.start, wall })
    if (start < firstStart) continue
    if (rule.until != null && start > rule.until) break
    if (rule.count != null && seen >= rule.count) break
    if (start >= to) break
    seen++
    out.push(start)
  }
  return out
}

// ---- Public API -----------------------------------------------------------

function parseEvents(text: string): RawEvent[] {
  const events: RawEvent[] = []
  let cur: Partial<RawEvent> | null = null
  let depth = 0 // skip nested blocks like VALARM
  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') {
      cur = { exdates: new Set(), cancelled: false, title: '' }
      depth = 0
      continue
    }
    if (!cur) continue
    if (line === 'END:VEVENT') {
      if (cur.start && cur.uid != null) events.push(cur as RawEvent)
      cur = null
      continue
    }
    if (line.startsWith('BEGIN:')) depth++
    if (line.startsWith('END:')) depth--
    if (depth > 0 || line.startsWith('END:')) continue
    const p = parseLine(line)
    if (!p) continue
    switch (p.name) {
      case 'UID':
        cur.uid = p.value
        break
      case 'SUMMARY':
        cur.title = unescapeText(p.value)
        break
      case 'LOCATION':
        cur.location = unescapeText(p.value) || undefined
        break
      case 'DTSTART':
        cur.start = parseDT(p.value, p.params) ?? undefined
        break
      case 'DTEND':
        cur.end = parseDT(p.value, p.params) ?? undefined
        break
      case 'DURATION':
        cur.durationMs = parseDuration(p.value)
        break
      case 'RRULE':
        cur.rrule = p.value
        break
      case 'EXDATE':
        for (const v of p.value.split(',')) {
          const dt = parseDT(v, p.params)
          if (dt) cur.exdates!.add(dtToEpoch(dt))
        }
        break
      case 'RECURRENCE-ID': {
        const dt = parseDT(p.value, p.params)
        if (dt) cur.recurrenceId = dtToEpoch(dt)
        break
      }
      case 'STATUS':
        cur.cancelled = p.value.trim().toUpperCase() === 'CANCELLED'
        break
    }
  }
  return events
}

function lengthOf(ev: RawEvent): number {
  if (ev.end) return Math.max(0, dtToEpoch(ev.end) - dtToEpoch(ev.start))
  if (ev.durationMs != null) return Math.max(0, ev.durationMs)
  return ev.start.allDay ? DAY : 0
}

/** Shift an all-day end by whole calendar days so DST never makes it 23h. */
function endFor(ev: RawEvent, start: number, len: number): number {
  if (!ev.start.allDay) return start + len
  const d = new Date(start)
  d.setDate(d.getDate() + Math.max(1, Math.round(len / DAY)))
  return d.getTime()
}

/**
 * Every occurrence of every event in `ics` that overlaps [from, to), sorted
 * by start. Recurring series are expanded; moved and cancelled occurrences
 * are honoured.
 */
export function expandEvents(ics: string, feedId: string, from: number, to: number): CalEvent[] {
  const raw = parseEvents(ics)
  const overrides = new Map<string, Map<number, RawEvent>>()
  for (const ev of raw) {
    if (ev.recurrenceId == null) continue
    if (!overrides.has(ev.uid)) overrides.set(ev.uid, new Map())
    overrides.get(ev.uid)!.set(ev.recurrenceId, ev)
  }

  const out: CalEvent[] = []
  const emit = (ev: RawEvent, start: number) => {
    const end = endFor(ev, start, lengthOf(ev))
    if (start >= to || (start < from && end <= from)) return
    out.push({
      id: `${feedId}:${ev.uid}:${start}`,
      feedId,
      title: ev.title || '(No title)',
      start,
      end,
      allDay: ev.start.allDay,
      location: ev.location,
    })
  }

  for (const ev of raw) {
    if (ev.cancelled) continue
    if (ev.recurrenceId != null) {
      emit(ev, dtToEpoch(ev.start))
      continue
    }
    const rule = ev.rrule ? parseRule(ev.rrule) : null
    if (!rule) {
      emit(ev, dtToEpoch(ev.start))
      continue
    }
    const moved = overrides.get(ev.uid)
    for (const start of occurrences(ev, rule, from, to)) {
      if (ev.exdates.has(start) || moved?.has(start)) continue
      emit(ev, start)
    }
  }
  return out.sort((a, b) => a.start - b.start || a.end - b.end)
}
