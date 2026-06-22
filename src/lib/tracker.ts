// Pure, side-effect-free helpers shared by the background tracker, the
// dashboard, and the limit overlay. Kept separate so the logic is easy to
// reason about (and unit-test later) without touching chrome APIs.

/** Bare hostname of a trackable page, or null for chrome://, extension, file pages, etc. */
export function domainOf(url: string | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * Escalation stage for a limited site.
 *   0 — under 80% of the budget (calm)
 *   1 — 80–100% (a heads-up notification)
 *   2 — 100–150% (a dismissible banner on the page)
 *   3 — 150%+ (a full-screen block)
 */
export type Stage = 0 | 1 | 2 | 3

export function computeStage(usedSeconds: number, limitMinutes: number): Stage {
  if (limitMinutes <= 0) return 0
  const ratio = usedSeconds / (limitMinutes * 60)
  if (ratio < 0.8) return 0
  if (ratio < 1) return 1
  if (ratio < 1.5) return 2
  return 3
}

/** "1h 12m", "43m", "2m". */
export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60)
  if (mins < 1) return '<1m'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export const SNOOZE_MINUTES = 5
