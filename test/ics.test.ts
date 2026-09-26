import { describe, expect, it } from 'vitest'
import { expandEvents } from '../src/lib/ics.ts'

const cal = (...events: string[]) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events, 'END:VCALENDAR'].join('\r\n')

const vevent = (...lines: string[]) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n')

const FROM = Date.UTC(2026, 8, 1)
const TO = Date.UTC(2026, 11, 31)
const iso = (ms: number) => new Date(ms).toISOString()

describe('expandEvents', () => {
  it('reads a UTC event, unfolding lines and unescaping text', () => {
    const out = expandEvents(
      cal(
        vevent(
          'UID:a',
          'SUMMARY:Standup\\, daily',
          'DTSTART:20260928T130000Z',
          'DTEND:20260928T131500Z',
          'LOCATION:Room',
          ' 4',
        ),
      ),
      'f',
      FROM,
      TO,
    )
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ title: 'Standup, daily', location: 'Room4', allDay: false })
    expect(iso(out[0].start)).toBe('2026-09-28T13:00:00.000Z')
    expect(out[0].end - out[0].start).toBe(15 * 60_000)
  })

  it('converts TZID times to the right instant', () => {
    const out = expandEvents(
      cal(vevent('UID:b', 'DTSTART;TZID=America/New_York:20260928T090000', 'DURATION:PT1H')),
      'f',
      FROM,
      TO,
    )
    expect(iso(out[0].start)).toBe('2026-09-28T13:00:00.000Z')
    expect(out[0].end - out[0].start).toBe(3_600_000)
  })

  it('treats DATE values as local all-day events', () => {
    const out = expandEvents(
      cal(vevent('UID:c', 'DTSTART;VALUE=DATE:20261003', 'DTEND;VALUE=DATE:20261005')),
      'f',
      FROM,
      TO,
    )
    expect(out[0].allDay).toBe(true)
    expect(out[0].start).toBe(new Date(2026, 9, 3).getTime())
    expect(out[0].end).toBe(new Date(2026, 9, 5).getTime())
  })

  it('expands weekly BYDAY with COUNT, keeping wall time across DST', () => {
    const out = expandEvents(
      cal(
        vevent(
          'UID:d',
          'DTSTART;TZID=America/New_York:20261026T090000',
          'DTEND;TZID=America/New_York:20261026T100000',
          'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4',
        ),
      ),
      'f',
      FROM,
      TO,
    )
    // DST ends Nov 1 in New York: 09:00 is 13:00Z before, 14:00Z after.
    expect(out.map((e) => iso(e.start))).toEqual([
      '2026-10-26T13:00:00.000Z',
      '2026-10-28T13:00:00.000Z',
      '2026-11-02T14:00:00.000Z',
      '2026-11-04T14:00:00.000Z',
    ])
  })

  it('honours EXDATE, moved occurrences, and cancelled ones', () => {
    const out = expandEvents(
      cal(
        vevent(
          'UID:e',
          'SUMMARY:Gym',
          'DTSTART:20260901T170000Z',
          'DTEND:20260901T180000Z',
          'RRULE:FREQ=DAILY;UNTIL=20260905T235959Z',
          'EXDATE:20260902T170000Z',
        ),
        vevent(
          'UID:e',
          'SUMMARY:Gym (late)',
          'RECURRENCE-ID:20260903T170000Z',
          'DTSTART:20260903T200000Z',
          'DTEND:20260903T210000Z',
        ),
        vevent(
          'UID:e',
          'RECURRENCE-ID:20260904T170000Z',
          'DTSTART:20260904T170000Z',
          'STATUS:CANCELLED',
        ),
      ),
      'f',
      FROM,
      TO,
    )
    expect(out.map((e) => `${e.title}@${iso(e.start).slice(5, 13)}`)).toEqual([
      'Gym@09-01T17',
      'Gym (late)@09-03T20',
      'Gym@09-05T17',
    ])
  })

  it('expands monthly ordinal weekdays (2nd Tuesday, last Friday)', () => {
    const out = expandEvents(
      cal(
        vevent('UID:f', 'DTSTART:20260908T100000Z', 'RRULE:FREQ=MONTHLY;BYDAY=2TU;COUNT=3'),
        vevent('UID:g', 'DTSTART:20260925T100000Z', 'RRULE:FREQ=MONTHLY;BYDAY=-1FR;COUNT=2'),
      ),
      'f',
      FROM,
      TO,
    )
    expect(out.map((e) => iso(e.start).slice(0, 10))).toEqual([
      '2026-09-08',
      '2026-09-25',
      '2026-10-13',
      '2026-10-30',
      '2026-11-10',
    ])
  })

  it('only returns occurrences overlapping the window, even for old series', () => {
    const out = expandEvents(
      cal(vevent('UID:h', 'DTSTART:20150101T080000Z', 'RRULE:FREQ=YEARLY')),
      'f',
      FROM,
      TO,
    )
    expect(out).toHaveLength(0)
    const bday = expandEvents(
      cal(vevent('UID:i', 'DTSTART;VALUE=DATE:19900915', 'RRULE:FREQ=YEARLY')),
      'f',
      FROM,
      TO,
    )
    expect(bday).toHaveLength(1)
    expect(bday[0].start).toBe(new Date(2026, 8, 15).getTime())
  })
})
