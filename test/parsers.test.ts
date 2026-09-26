import { describe, expect, it } from 'vitest'
import { parseBook } from '../src/newtab/components/ReadingCard.tsx'
import { parseHabit } from '../src/newtab/components/HabitsCard.tsx'

describe('quick-add parsers', () => {
  it('splits "Title by Author"', () => {
    expect(parseBook('Deep Work by Cal Newport')).toEqual({ title: 'Deep Work', author: 'Cal Newport' })
    expect(parseBook('Stand By Me')).toEqual({ title: 'Stand By Me' })
    expect(parseBook('  Dune  ')).toEqual({ title: 'Dune' })
  })

  it('pulls a leading emoji off a habit, including ZWJ sequences', () => {
    expect(parseHabit('📖 Read 20 pages')).toEqual({ emoji: '📖', name: 'Read 20 pages' })
    expect(parseHabit('🏃‍♂️ Run')).toEqual({ emoji: '🏃‍♂️', name: 'Run' })
    expect(parseHabit('Meditate')).toEqual({ name: 'Meditate' })
  })
})

describe('parseBook edge cases', () => {
  it('uses the last lowercase "by"', () => {
    expect(parseBook('Killed by Death by J. Doe')).toEqual({ title: 'Killed by Death', author: 'J. Doe' })
  })
})
