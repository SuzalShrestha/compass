import { useState } from 'react'
import type { CategoryRule, SiteLimit } from '../../../lib/types.ts'
import { useHistory, useDashboardData } from '../../../lib/hooks.ts'
import { formatDuration } from '../../../lib/tracker.ts'
import { shortDate, toDateKey, weekdayShort } from '../../../lib/dates.ts'
import { generateRollupMarkdown } from '../../../lib/rollup.ts'
import { BarChart, type Bar } from './BarChart.tsx'
import { Heatmap } from './Heatmap.tsx'
import { StatCard } from './StatCard.tsx'

const RANGES = [7, 14, 30]
type Tab = 'overview' | 'focus' | 'goals' | 'reading' | 'wellbeing' | 'history' | 'export'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'focus', label: 'Focus' },
  { id: 'goals', label: 'Goals' },
  { id: 'reading', label: 'Reading' },
  { id: 'wellbeing', label: 'Wellbeing' },
  { id: 'history', label: 'History' },
  { id: 'export', label: 'Export' },
]

const pct = (n: number) => `${Math.round(n * 100)}%`
const deltaStr = (d: number | null) => (d == null ? '—' : `${d >= 0 ? '+' : ''}${Math.round(d * 100)}%`)

export function Dashboard({
  limits,
  categoryRules,
  onBack,
}: {
  limits: SiteLimit[]
  categoryRules: CategoryRule[]
  onBack: () => void
}) {
  const [range, setRange] = useState(14)
  const [tab, setTab] = useState<Tab>('overview')
  const { value: data } = useDashboardData(range, categoryRules)
  const today = toDateKey()

  // Thin out x-axis labels so 30-day charts don't crowd.
  const labelStep = range <= 14 ? 1 : 5
  const dayLabel = (date: string, i: number) =>
    i % labelStep === 0 ? (range <= 14 ? weekdayShort(date) : shortDate(date)) : ''

  const usageBars: Bar[] =
    data?.usage.perDay.map((d, i) => ({
      key: d.date,
      value: d.seconds,
      label: dayLabel(d.date, i),
      title: `${shortDate(d.date)}: ${formatDuration(d.seconds)}`,
      highlight: d.date === today,
    })) ?? []

  const goalBars: Bar[] =
    data?.goals.perDay.map((d, i) => ({
      key: d.date,
      value: d.total,
      donePortion: d.total > 0 ? d.done / d.total : 0,
      label: dayLabel(d.date, i),
      title: `${shortDate(d.date)}: ${d.done}/${d.total} goals`,
      highlight: d.date === today,
    })) ?? []

  const maxDomain = data?.usage.topDomains[0]?.seconds ?? 0
  const wc = data?.weekCompare

  return (
    <div className="dashboard">
      <div className="dash-head">
        <button className="icon-btn" title="Back" onClick={onBack}>
          ←
        </button>
        <h1>Dashboard</h1>
        <div className="seg dash-range">
          {RANGES.map((r) => (
            <button key={r} className={r === range ? 'active' : ''} onClick={() => setRange(r)}>
              {r}d
            </button>
          ))}
        </div>
      </div>

      <div className="dash-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`dash-tab${t.id === tab ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!data ? (
        <div className="empty">Loading…</div>
      ) : (
        <>
          {tab === 'overview' && (
            <>
              <div className="stats">
                <StatCard label="Focus time" value={formatDuration(data.usage.totalSeconds)} sub={`${data.usage.activeDays} active days`} accent />
                <StatCard label="Avg / active day" value={formatDuration(data.usage.avgSeconds)} />
                <StatCard
                  label="Goals completed"
                  value={`${data.goals.totalDone}/${data.goals.totalGoals}`}
                  sub={data.goals.totalGoals > 0 ? pct(data.goals.completionRate) : '—'}
                />
                <StatCard label="Goal streak" value={`${data.goals.streak}`} sub={data.goals.streak === 1 ? 'day' : 'days'} accent />
                <StatCard
                  label="Finished reading"
                  value={`${data.reading.completedInRange}`}
                  sub={`${data.reading.queue} in queue`}
                />
              </div>

              <section className="card dash-section">
                <h2>Focus heatmap · last 90 days</h2>
                <Heatmap data={data.heatmap} metric="focus" />
              </section>

              {wc && (
                <section className="card dash-section">
                  <h2>This week vs last week</h2>
                  <div className="wc-row">
                    <span className="wc-label">Focus time</span>
                    <span className="wc-cur">{formatDuration(wc.focusSeconds.cur)}</span>
                    <span className={`wc-delta${(wc.focusSeconds.deltaPct ?? 0) > 0 ? ' up' : ''}`}>
                      {deltaStr(wc.focusSeconds.deltaPct)}
                    </span>
                  </div>
                  <div className="wc-row">
                    <span className="wc-label">Goal completion rate</span>
                    <span className="wc-cur">{pct(wc.goalRate.cur)}</span>
                    <span className={`wc-delta${(wc.goalRate.deltaPct ?? 0) > 0 ? ' up' : ''}`}>
                      {deltaStr(wc.goalRate.deltaPct)}
                    </span>
                  </div>
                  <div className="wc-row">
                    <span className="wc-label">
                      Most distracting site{wc.topDistraction.domain ? ` · ${wc.topDistraction.domain}` : ''}
                    </span>
                    <span className="wc-cur">{formatDuration(wc.topDistraction.curSeconds)}</span>
                    <span className="wc-delta">
                      {wc.topDistraction.prevSeconds > 0
                        ? `prev ${formatDuration(wc.topDistraction.prevSeconds)}`
                        : '—'}
                    </span>
                  </div>
                </section>
              )}
            </>
          )}

          {tab === 'focus' && (
            <>
              <section className="card dash-section">
                <h2>Focus time · last {range} days</h2>
                <BarChart bars={usageBars} emptyText="No tracked time yet. Browse with tracking on." />

                {data.usage.topDomains.length > 0 && (
                  <div className="dash-domains">
                    <h3>Top sites</h3>
                    {data.usage.topDomains.map((d) => {
                      const limit = limits.find((l) => l.enabled && l.domain === d.domain)
                      const over = limit ? d.seconds > limit.minutes * 60 * range : false
                      return (
                        <div className="time-row" key={d.domain}>
                          <span className="time-domain" title={d.domain}>
                            {d.domain}
                          </span>
                          <div className="time-bar">
                            <span
                              style={{
                                width: maxDomain > 0 ? `${Math.max(4, (d.seconds / maxDomain) * 100)}%` : '0%',
                                background: over ? 'var(--ink)' : 'var(--ink-3)',
                              }}
                            />
                          </div>
                          <span className="time-val">{formatDuration(d.seconds)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {data.categories.perCategory.length > 0 && (
                <section className="card dash-section">
                  <h2>Time by category</h2>
                  {data.categories.perCategory.map((c) => (
                    <div className="cat-row" key={c.category}>
                      <span className="cat-label">{c.label}</span>
                      <div className="cat-bar">
                        <span style={{ width: `${Math.round(c.share * 100)}%` }} />
                      </div>
                      <span className="cat-val">{formatDuration(c.seconds)}</span>
                    </div>
                  ))}
                  <p className="muted" style={{ marginTop: 12 }}>
                    Edit category rules in settings to tune these.
                  </p>
                </section>
              )}
            </>
          )}

          {tab === 'goals' && (
            <section className="card dash-section">
              <h2>Goals · last {range} days</h2>
              <p className="muted">
                {data.goals.daysWithAllDone} days with everything done · {pct(data.goals.completionRate)} overall completion
              </p>
              <BarChart bars={goalBars} height={120} emptyText="No goals set in this range." />
            </section>
          )}

          {tab === 'reading' && (
            <section className="card dash-section">
              <h2>Reading</h2>
              <div className="read-stats">
                <span><strong>{data.reading.reading}</strong> reading</span>
                <span><strong>{data.reading.queue}</strong> queued</span>
                <span><strong>{data.reading.done}</strong> done</span>
                <span className="muted">+{data.reading.addedInRange} added · {data.reading.completedInRange} finished this range</span>
              </div>
              {data.reading.recentlyDone.length > 0 && (
                <div className="dash-domains">
                  <h3>Recently finished</h3>
                  {data.reading.recentlyDone.map((item) => (
                    <div className="read-item" key={item.id}>
                      {item.url ? (
                        <a className="title" href={item.url} title={item.title}>
                          {item.title}
                        </a>
                      ) : (
                        <span className="title">{item.title}</span>
                      )}
                      <span className="meta">{shortDate(toDateKey(new Date(item.updatedAt)))}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === 'wellbeing' && <WellbeingTab data={data} />}

          {tab === 'history' && <HistoryTab />}

          {tab === 'export' && (
            <ExportTab range={range} dates={data.dates} data={data} />
          )}
        </>
      )}
    </div>
  )
}

function HistoryTab() {
  const history = useHistory()

  if (!history) {
    return <div className="empty">Loading history…</div>
  }

  if (history.totalVisits === 0) {
    return (
      <section className="card dash-section">
        <h2>History</h2>
        <div className="empty">
          No history imported yet. It scans automatically on install and refreshes daily.
          Reopen this tab in a moment, or reload the extension.
        </div>
      </section>
    )
  }

  const maxMonth = Math.max(1, ...history.monthly.map((m) => m.visits))
  const imported = history.importedAt ? shortDate(toDateKey(new Date(history.importedAt))) : null

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const maxWeekday = Math.max(1, ...history.weekday)
  const trend = history.trend30 == null ? '—' : `${history.trend30 >= 0 ? '+' : ''}${Math.round(history.trend30 * 100)}%`

  return (
    <>
      <div className="stats">
        <StatCard label="Lifetime visits" value={history.totalVisits.toLocaleString()} sub={`across ${history.monthsCovered} months`} accent />
        <StatCard label="Months tracked" value={`${history.monthsCovered}`} />
        <StatCard
          label="Top site"
          value={history.topDomains[0]?.domain ?? '—'}
          sub={history.topDomains[0] ? `${history.topDomains[0].totalVisits.toLocaleString()} visits` : undefined}
        />
        <StatCard label="Avg visits / day" value={history.avgPerDay.toFixed(1)} sub={`${history.daysActive} active days`} />
        <StatCard label="Peak month" value={history.peakMonth ? history.peakMonth.month : '—'} sub={history.peakMonth ? `${history.peakMonth.visits.toLocaleString()} visits` : undefined} />
        <StatCard label="Busiest weekday" value={WEEKDAYS[history.weekdayPeak]} />
        <StatCard label="30-day trend" value={trend} sub={`${history.last30} vs ${history.prev30} prev`} />
      </div>

      <section className="card dash-section">
        <h2>Visits per month · last 24 months</h2>
        <div className="chart" style={{ height: 120 }}>
          {history.monthly.map((m) => {
            const [y, mo] = m.month.split('-')
            const label = new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString(undefined, {
              month: 'short',
            })
            return (
              <div className="chart-col" key={m.month} title={`${m.month}: ${m.visits.toLocaleString()}`}>
                <div className="chart-track">
                  <div className="chart-fill" style={{ height: `${(m.visits / maxMonth) * 100}%` }} />
                </div>
                <div className="chart-label">{label}</div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="card dash-section">
        <h2>By day of week</h2>
        <div className="hour-chart">
          {history.weekday.map((count, d) => (
            <div className="hour-col" key={d} title={`${WEEKDAYS[d]} — ${count.toLocaleString()}`}>
              <div className="hour-fill" style={{ height: `${(count / maxWeekday) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="hour-chart-labels">
          {WEEKDAYS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          Based on visits to your top sites — where most browsing happens.
        </p>
      </section>

      <section className="card dash-section">
        <h2>Most visited · all time</h2>
        {history.topDomains.map((d) => {
          const max = history.topDomains[0]?.totalVisits ?? 1
          return (
            <div className="time-row" key={d.domain}>
              <span className="time-domain">{d.domain}</span>
              <div className="time-bar">
                <span style={{ width: `${(d.totalVisits / max) * 100}%`, background: 'var(--ink-3)' }} />
              </div>
              <span className="time-val">{d.totalVisits.toLocaleString()}</span>
            </div>
          )
        })}
        {imported && <p className="muted" style={{ marginTop: 12 }}>Imported {imported}.</p>}
      </section>
    </>
  )
}

function WellbeingTab({
  data,
}: {
  data: NonNullable<ReturnType<typeof useDashboardData>['value']>
}) {
  const { checkins, distractions } = data
  const maxHour = Math.max(1, ...distractions.byHour)
  const peakHour = distractions.byHour.indexOf(maxHour)

  return (
    <>
      <section className="card dash-section">
        <h2>Mood &amp; energy · last {data.dates.length} days</h2>
        {checkins.count === 0 ? (
          <div className="empty">No check-ins yet. Log one on the home page each morning.</div>
        ) : (
          <>
            <div className="read-stats">
              <span><strong>{checkins.avgMood.toFixed(1)}</strong> avg mood</span>
              <span><strong>{checkins.avgEnergy.toFixed(1)}</strong> avg energy</span>
              <span className="muted">{checkins.count} check-in{checkins.count === 1 ? '' : 's'}</span>
            </div>
            <div className="checkin-trend">
              {checkins.perDay.map((d) => (
                <div className="checkin-trend-col" key={d.date} title={`${shortDate(d.date)} · mood ${d.mood} · energy ${d.energy}`}>
                  <div className="checkin-trend-bar" style={{ height: `${(d.mood / 5) * 100}%` }} />
                </div>
              ))}
            </div>
            <p className="muted" style={{ marginTop: 8 }}>Bars show mood (1–5). Energy tracks alongside in settings.</p>
          </>
        )}
      </section>

      <section className="card dash-section">
        <h2>Distractions · {distractions.total} caught</h2>
        {distractions.total === 0 ? (
          <div className="empty">No slips logged. Use "I caught myself" on the home page or when a limit fires.</div>
        ) : (
          <>
            <div className="read-stats">
              <span><strong>{distractions.trend.cur}</strong> this week</span>
              <span><strong>{distractions.trend.prev}</strong> last week</span>
              {peakHour >= 0 && (
                <span className="muted">Peak hour: {peakHour}:00</span>
              )}
            </div>

            <div className="dash-domains">
              <h3>By time of day</h3>
              <div className="hour-chart">
                {distractions.byHour.map((count, h) => (
                  <div className="hour-col" key={h} title={`${h}:00 — ${count}`}>
                    <div className="hour-fill" style={{ height: `${(count / maxHour) * 100}%` }} />
                  </div>
                ))}
              </div>
            </div>

            {distractions.byDomain.length > 0 && (
              <div className="dash-domains">
                <h3>By site</h3>
                {distractions.byDomain.map((d) => (
                  <div className="time-row" key={d.domain}>
                    <span className="time-domain">{d.domain}</span>
                    <span className="time-val">{d.count}×</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </>
  )
}

function ExportTab({
  range,
  dates,
  data,
}: {
  range: number
  dates: string[]
  data: NonNullable<ReturnType<typeof useDashboardData>['value']>
}) {  const label = range <= 7 ? 'Weekly' : range <= 30 ? 'Monthly' : 'Quarterly'
  const md = generateRollupMarkdown(label, dates, data)
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(md)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked — the visible <pre> lets the user copy manually.
    }
  }

  function download() {
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `compass-${label.toLowerCase()}-${dates[dates.length - 1]}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="card dash-section">
      <h2>{label} rollup · {shortDate(dates[0])} – {shortDate(dates[dates.length - 1])}</h2>
      <p className="muted">
        A markdown summary of this range. Copy to your weekly review, download, or push to your vault
        (once sync is wired).
      </p>
      <div className="export-row" style={{ marginTop: 16 }}>
        <button className="btn" onClick={copy}>{copied ? 'Copied ✓' : 'Copy markdown'}</button>
        <button className="btn ghost" onClick={download}>Download .md</button>
      </div>
      <pre className="export-pre">{md}</pre>
    </section>
  )
}
