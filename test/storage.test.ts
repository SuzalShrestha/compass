import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DayRecord, Habit, ReadingItem } from '../src/lib/types.ts'

// Same in-memory chrome.storage stand-in as long-goals.test.ts, but `get`
// yields to the event loop so unsynchronised read-modify-writes would race.
const store = new Map<string, unknown>()
vi.stubGlobal('chrome', {
  storage: {
    local: {
      async get(keys: string[]) {
        const out: Record<string, unknown> = {}
        for (const k of keys) if (store.has(k)) out[k] = structuredClone(store.get(k))
        await new Promise((r) => setTimeout(r, 1))
        return out
      },
      async set(values: Record<string, unknown>) {
        for (const [k, v] of Object.entries(values)) store.set(k, structuredClone(v))
      },
    },
    onChanged: { addListener() {}, removeListener() {} },
  },
})

const s = await import('../src/lib/storage.ts')
const { importData } = await import('../src/lib/backup.ts')

beforeEach(() => store.clear())

describe('serialized writes', () => {
  it('keeps every task when many are added at once', async () => {
    await Promise.all(Array.from({ length: 20 }, (_, i) => s.addGoal('2026-09-26', `t${i}`)))
    const day = await s.getDay('2026-09-26')
    expect(day.goals).toHaveLength(20)
  })

  it('snapshotKey undoes a delete', async () => {
    await s.addLongGoal('Run a marathon')
    const [g] = await s.getLongGoals()
    const undo = await s.snapshotKey('longGoals')
    await s.removeLongGoal(g.id)
    expect(await s.getLongGoals()).toHaveLength(0)
    await undo()
    expect((await s.getLongGoals())[0].text).toBe('Run a marathon')
  })
})

describe('carry-over', () => {
  const goal = (id: string, done = false, movedTo?: string) => ({
    id,
    text: id,
    done,
    createdAt: 0,
    movedTo,
  })
  const days: Record<string, DayRecord> = {
    '2026-09-10': { date: '2026-09-10', intention: '', goals: [goal('too-old')] },
    '2026-09-24': { date: '2026-09-24', intention: '', goals: [goal('a'), goal('done', true)] },
    '2026-09-25': { date: '2026-09-25', intention: '', goals: [goal('b'), goal('moved', false, 'x')] },
    '2026-09-26': { date: '2026-09-26', intention: '', goals: [goal('today')] },
  }

  it('finds open, unmoved tasks from the past week, newest first', () => {
    expect(s.findCarryOver(days, '2026-09-26').map((c) => c.goal.id)).toEqual(['b', 'a'])
  })

  it('moves them onto today exactly once', async () => {
    store.set('days', days)
    const items = s.findCarryOver(days, '2026-09-26')
    await s.carryOver('2026-09-26', items)
    const after = await s.getAllDays()
    expect(after['2026-09-26'].goals.map((g) => g.text)).toEqual(['today', 'b', 'a'])
    expect(after['2026-09-25'].goals[0].movedTo).toBe('2026-09-26')
    expect(s.findCarryOver(after, '2026-09-26')).toHaveLength(0)
  })
})

describe('habits', () => {
  const habit = (dates: string[]): Habit => ({
    id: 'h',
    name: 'Read',
    createdAt: 0,
    log: Object.fromEntries(dates.map((d) => [d, true])),
  })

  it('counts a streak ending today', () => {
    expect(s.habitStreak(habit(['2026-09-24', '2026-09-25', '2026-09-26']), '2026-09-26')).toBe(3)
  })

  it('keeps yesterday’s streak alive until today is over', () => {
    expect(s.habitStreak(habit(['2026-09-24', '2026-09-25']), '2026-09-26')).toBe(2)
  })

  it('breaks on a missed day', () => {
    expect(s.habitStreak(habit(['2026-09-23', '2026-09-25']), '2026-09-27')).toBe(0)
  })

  it('crosses month boundaries', () => {
    expect(s.habitStreak(habit(['2026-08-31', '2026-09-01']), '2026-09-01')).toBe(2)
  })

  it('toggles today on and off', async () => {
    await s.addHabit('Walk')
    const [h] = await s.getHabits()
    await s.toggleHabit(h.id, '2026-09-26')
    expect((await s.getHabits())[0].log['2026-09-26']).toBe(true)
    await s.toggleHabit(h.id, '2026-09-26')
    expect((await s.getHabits())[0].log['2026-09-26']).toBeUndefined()
  })
})

describe('reading', () => {
  const book: ReadingItem = {
    id: 'b',
    kind: 'book',
    title: 'Meditations',
    status: 'reading',
    pageTotal: 200,
    addedAt: 0,
    updatedAt: 0,
  }

  it('derives progress from pages and clamps', () => {
    expect(s.applyReadingPatch(book, { pageCurrent: 50 }).progress).toBe(25)
    expect(s.applyReadingPatch(book, { pageCurrent: 999 })).toMatchObject({ pageCurrent: 200, progress: 100 })
  })

  it('stamps finishedAt when done and clears it when reopened', () => {
    const done = s.applyReadingPatch(book, { status: 'done' })
    expect(done.finishedAt).toBeTypeOf('number')
    expect(done).toMatchObject({ progress: 100, pageCurrent: 200 })
    expect(s.applyReadingPatch(done, { status: 'reading' }).finishedAt).toBeUndefined()
  })

  it('de-dupes saved pages by URL even when saved concurrently', async () => {
    await Promise.all([
      s.addReadingItem({ title: 'A', url: 'https://x.dev/a' }),
      s.addReadingItem({ title: 'A again', url: 'https://x.dev/a' }),
    ])
    expect(await s.getReading()).toHaveLength(1)
  })
})

describe('settings + goals', () => {
  it('migrates the old default accent only', async () => {
    store.set('settings', { accent: '#6B7686' })
    await s.migrate()
    expect((await s.getSettings()).accent).toBe(s.DEFAULT_SETTINGS.accent)
    store.set('settings', { accent: '#123456' })
    await s.migrate()
    expect((await s.getSettings()).accent).toBe('#123456')
  })

  it('fills defaults for fields older versions never stored', async () => {
    store.set('settings', { name: 'Sam' })
    const settings = await s.getSettings()
    expect(settings).toMatchObject({ name: 'Sam', calendars: [], readingGoal: 12 })
    expect(settings.focus.focusMinutes).toBe(25)
  })

  it('derives goal progress from milestones', async () => {
    await s.addLongGoal('Learn Spanish')
    const [g] = await s.getLongGoals()
    await s.addMilestone(g.id, 'A1')
    await s.addMilestone(g.id, 'A2')
    const withMs = (await s.getLongGoals())[0]
    await s.toggleMilestone(g.id, withMs.milestones![0].id)
    expect(s.goalProgress((await s.getLongGoals())[0])).toBe(0.5)
  })
})

describe('import validation', () => {
  it('rejects files that are not Compass exports', async () => {
    await expect(importData({ hello: 1 })).rejects.toThrow(/Compass export/)
    await expect(importData({ app: 'compass', data: { reading: 'nope' } })).rejects.toThrow(/no Compass data/)
  })
})
