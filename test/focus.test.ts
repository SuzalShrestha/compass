import { describe, expect, it, vi } from 'vitest'

// No chrome global: storage falls back to localStorage, focus skips alarms.
const mem = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
})
vi.stubGlobal('window', { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} })
vi.stubGlobal('CustomEvent', class {})

const { completeFocus, startFocus } = await import('../src/lib/focus.ts')
const { getDay, getFocus } = await import('../src/lib/storage.ts')
const { toDateKey } = await import('../src/lib/dates.ts')

describe('focus timer', () => {
  it('banks minutes exactly once when completion races', async () => {
    await startFocus('focus', 25, 'Write')
    const f = await getFocus()
    mem.set('compass:focus', JSON.stringify({ ...f, endsAt: Date.now() - 1000 }))
    const results = await Promise.all([completeFocus(), completeFocus(), completeFocus()])
    expect(results.filter(Boolean)).toHaveLength(1)
    expect((await getDay(toDateKey())).focusMinutes).toBe(25)
    expect(await getFocus()).toMatchObject({ status: 'idle', kind: 'break', minutes: 5 })
  })

  it('does nothing before the session is due', async () => {
    await startFocus('focus', 25)
    expect(await completeFocus()).toBeNull()
    expect((await getFocus()).status).toBe('running')
  })
})
