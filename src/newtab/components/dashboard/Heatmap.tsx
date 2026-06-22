import type { HeatmapData } from '../../../lib/analytics.ts'
import { shortDate } from '../../../lib/dates.ts'
import { formatDuration } from '../../../lib/tracker.ts'

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Calendar heatmap (GitHub-style), Swiss: sharp 10px cells, hairline gaps,
 * near-monochrome intensity (ink with rising opacity).
 */
export function Heatmap({ data, metric }: { data: HeatmapData; metric: 'focus' | 'goals' }) {
  if (data.weeks.length === 0) {
    return <div className="empty">No data in this range yet.</div>
  }

  const fmt = (v: number) => (metric === 'focus' ? formatDuration(v) : `${Math.round(v * 100)}%`)

  return (
    <div className="heatmap">
      <div className="heatmap-day-col">
        {DAY_LABELS.map((d, i) => (
          <span key={i} className="heatmap-day-label">
            {i % 2 === 1 ? d : ''}
          </span>
        ))}
      </div>
      <div className="heatmap-grid">
        {data.weeks.map((week, wi) => {
          const firstReal = week.find((c) => c.date)
          const month = firstReal ? new Date(`${firstReal.date}T00:00:00`).getMonth() : -1
          const prevFirst = wi > 0 ? data.weeks[wi - 1].find((c) => c.date) : null
          const prevMonth = prevFirst ? new Date(`${prevFirst.date}T00:00:00`).getMonth() : -1
          const showMonth = firstReal && month !== prevMonth
          return (
            <div className="heatmap-week" key={wi}>
              <div className="heatmap-week-label">{showMonth ? MONTH_LABELS[month] : ''}</div>
              {week.map((cell, di) => (
                <div
                  key={di}
                  className={`heatmap-cell lvl-${cell.level}`}
                  title={cell.date ? `${shortDate(cell.date)} · ${fmt(cell.value)}` : ''}
                />
              ))}
            </div>
          )
        })}
      </div>
      <div className="heatmap-legend">
        <span className="micro">Less</span>
        <div className="heatmap-cell lvl-0" />
        <div className="heatmap-cell lvl-1" />
        <div className="heatmap-cell lvl-2" />
        <div className="heatmap-cell lvl-3" />
        <div className="heatmap-cell lvl-4" />
        <span className="micro">More</span>
      </div>
    </div>
  )
}
