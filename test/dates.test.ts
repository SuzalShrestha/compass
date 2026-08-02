import { describe, expect, it } from 'vitest'
import { isoWeek } from '../src/lib/dates.ts'

describe('isoWeek', () => {
  it('counts from the week containing the first Thursday', () => {
    // 2026-01-01 is a Thursday, so it is week 1.
    expect(isoWeek(new Date(2026, 0, 1))).toBe(1)
    expect(isoWeek(new Date(2026, 7, 2))).toBe(31)
  })

  it('rolls a late-December date into week 1 of the next year', () => {
    // 2024-12-30 is a Monday whose Thursday falls in 2025.
    expect(isoWeek(new Date(2024, 11, 30))).toBe(1)
  })

  it('gives week 53 to years that have one', () => {
    // 2020 was a 53-week ISO year.
    expect(isoWeek(new Date(2020, 11, 31))).toBe(53)
  })
})
