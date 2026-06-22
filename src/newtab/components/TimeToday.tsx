import type { SiteLimit } from '../../lib/types.ts'
import type { TimeToday as TimeTodayData } from '../../lib/hooks.ts'
import { formatDuration } from '../../lib/tracker.ts'

export function TimeToday({
  data,
  limits,
  trackingEnabled,
}: {
  data: TimeTodayData
  limits: SiteLimit[]
  trackingEnabled: boolean
}) {
  const max = data.items[0]?.seconds ?? 0

  return (
    <section className="card">
      <div className="time-head">
        <h2>Today's time</h2>
        {trackingEnabled && data.total > 0 && (
          <span className="time-total">{formatDuration(data.total)}</span>
        )}
      </div>

      {!trackingEnabled ? (
        <div className="empty">Time tracking is off. Turn it on in settings ⚙ to see where your day goes.</div>
      ) : data.items.length === 0 ? (
        <div className="empty">No activity tracked yet today.</div>
      ) : (
        data.items.map((item) => {
          const limit = limits.find((l) => l.enabled && l.domain === item.domain)
          const over = limit ? item.seconds > limit.minutes * 60 : false
          return (
            <div className="time-row" key={item.domain}>
              <span className="time-domain" title={item.domain}>
                {item.domain}
              </span>
              <div className="time-bar">
                <span
                  style={{
                    width: max > 0 ? `${Math.max(4, (item.seconds / max) * 100)}%` : '0%',
                    background: over ? 'var(--danger)' : 'var(--accent)',
                  }}
                />
              </div>
              <span className={`time-val${over ? ' over' : ''}`}>
                {formatDuration(item.seconds)}
                {limit && <span className="time-limit"> / {limit.minutes}m</span>}
              </span>
            </div>
          )
        })
      )}
    </section>
  )
}
