import { beforeEach, describe, expect, it, vi } from 'vitest'

// In-memory stand-in for chrome.storage.local so the storage adapter takes its
// `hasChrome` branch. Must be stubbed before storage.ts is imported, since the
// module reads `typeof chrome` at load time.
const store = new Map<string, unknown>()

vi.stubGlobal('chrome', {
  storage: {
    local: {
      async get(keys: string[]) {
        const out: Record<string, unknown> = {}
        for (const k of keys) if (store.has(k)) out[k] = store.get(k)
        return out
      },
      async set(values: Record<string, unknown>) {
        for (const [k, v] of Object.entries(values)) store.set(k, v)
      },
    },
    onChanged: { addListener() {}, removeListener() {} },
  },
})

const {
  getLongGoals,
  addLongGoal,
  toggleLongGoal,
  removeLongGoal,
  clearCompletedLongGoals,
} = await import('../src/lib/storage.ts')

beforeEach(() => store.clear())

describe('long goals storage', () => {
  it('adds a trimmed goal and defaults done=false', async () => {
    await addLongGoal('  ship it  ')
    const goals = await getLongGoals()
    expect(goals).toHaveLength(1)
    expect(goals[0]).toMatchObject({ text: 'ship it', done: false })
    expect(typeof goals[0].id).toBe('string')
    expect(typeof goals[0].createdAt).toBe('number')
  })

  it('ignores blank input', async () => {
    await addLongGoal('   ')
    expect(await getLongGoals()).toHaveLength(0)
  })

  it('prepends newest first', async () => {
    await addLongGoal('first')
    await addLongGoal('second')
    const goals = await getLongGoals()
    expect(goals.map((g) => g.text)).toEqual(['second', 'first'])
  })

  it('toggles done on and off, tracking completedAt', async () => {
    await addLongGoal('a goal')
    const { id } = (await getLongGoals())[0]

    await toggleLongGoal(id)
    let g = (await getLongGoals())[0]
    expect(g.done).toBe(true)
    expect(typeof g.completedAt).toBe('number')

    await toggleLongGoal(id)
    g = (await getLongGoals())[0]
    expect(g.done).toBe(false)
    expect(g.completedAt).toBeUndefined()
  })

  it('removes a goal by id', async () => {
    await addLongGoal('keep')
    await addLongGoal('drop')
    const drop = (await getLongGoals()).find((g) => g.text === 'drop')!
    await removeLongGoal(drop.id)
    const goals = await getLongGoals()
    expect(goals.map((g) => g.text)).toEqual(['keep'])
  })

  it('clears only completed goals', async () => {
    await addLongGoal('done one')
    await addLongGoal('still open')
    const done = (await getLongGoals()).find((g) => g.text === 'done one')!
    await toggleLongGoal(done.id)

    await clearCompletedLongGoals()
    const goals = await getLongGoals()
    expect(goals.map((g) => g.text)).toEqual(['still open'])
  })
})
