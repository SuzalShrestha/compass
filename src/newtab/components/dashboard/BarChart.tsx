export interface Bar {
  key: string
  value: number
  label?: string
  title?: string
  highlight?: boolean
  /** 0–1 fraction of the bar to fill in the accent "done" color, for stacked goal bars. */
  donePortion?: number
}

export function BarChart({
  bars,
  height = 140,
  emptyText = 'No data yet.',
}: {
  bars: Bar[]
  height?: number
  emptyText?: string
}) {
  const max = Math.max(1, ...bars.map((b) => b.value))
  const hasData = bars.some((b) => b.value > 0)

  if (!hasData) return <div className="empty">{emptyText}</div>

  return (
    <div className="chart" style={{ height }}>
      {bars.map((b) => {
        const pct = (b.value / max) * 100
        const donePct = b.donePortion != null ? Math.round(b.donePortion * 100) : null
        return (
          <div className="chart-col" key={b.key} title={b.title ?? `${b.label ?? b.key}: ${b.value}`}>
            <div className="chart-track">
              <div
                className={`chart-fill${donePct != null ? ' stacked' : ''}${b.highlight ? ' hl' : ''}`}
                style={{ height: `${pct}%` }}
              >
                {donePct != null && (
                  <div className="chart-fill-done" style={{ height: `${donePct}%` }} />
                )}
              </div>
            </div>
            {b.label && <div className="chart-label">{b.label}</div>}
          </div>
        )
      })}
    </div>
  )
}
