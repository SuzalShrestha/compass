import type { SiteLimit } from '../../lib/types.ts'
import type { TimeToday as TimeTodayData } from '../../lib/hooks.ts'
import { formatDuration } from '../../lib/tracker.ts'

/**
 * Footer readout: today's total, plus the worst limit breach when there is one.
 * The full per-domain breakdown lives in the Dashboard — the home page only
 * needs the number and the warning.
 */
export function TimeToday({
  data,
  limits,
  trackingEnabled,
  onOpenDashboard,
}: {
  data: TimeTodayData
  limits: SiteLimit[]
  trackingEnabled: boolean
  onOpenDashboard: () => void
}) {
  if (!trackingEnabled || data.total === 0) return null

  // Worst breach = largest overshoot past its own budget, not the biggest site.
  const breach = data.items
    .map((item) => {
      const limit = limits.find((l) => l.enabled && l.domain === item.domain)
      if (!limit) return null
      const over = item.seconds - limit.minutes * 60
      return over > 0 ? { ...item, minutes: limit.minutes, over } : null
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => b.over - a.over)[0]

  return (
    <button type="button" className="time-readout" onClick={onOpenDashboard}>
      <span className="tabular-nums">{formatDuration(data.total)}</span>
      <span className="micro">today</span>
      {breach && (
        <span className="time-breach" title={`Over your ${breach.minutes}m limit`}>
          {/* Ceiling, so a 20-second overshoot never renders as "+0m over". */}
          {breach.domain} +{Math.ceil(breach.over / 60)}m over
        </span>
      )}
    </button>
  )
}
