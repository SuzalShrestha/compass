import type { DashboardData } from './hooks.ts'
import { formatDuration } from './tracker.ts'
import { shortDate } from './dates.ts'

/**
 * Generate a markdown rollup of a date range — feeds the Obsidian vault's
 * review cadence (weekly/monthly) and the /closeday flow. Pure string build,
 * no side effects, so it's easy to unit-test and to also copy to clipboard.
 */
export function generateRollupMarkdown(
  label: string,
  dates: string[],
  data: DashboardData,
): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`
  const start = shortDate(dates[0])
  const end = shortDate(dates[dates.length - 1])

  const lines: string[] = [
    `# Compass · ${label} · ${start} – ${end}`,
    '',
    '## Focus',
    `- Total focus time: **${formatDuration(data.usage.totalSeconds)}**`,
    `- Active days: **${data.usage.activeDays}**`,
    `- Avg per active day: **${formatDuration(data.usage.avgSeconds)}**`,
    '',
    '## Goals',
    `- Completed: **${data.goals.totalDone}/${data.goals.totalGoals}** (${pct(data.goals.completionRate)})`,
    `- Days with everything done: **${data.goals.daysWithAllDone}**`,
    `- Current streak: **${data.goals.streak} day${data.goals.streak === 1 ? '' : 's'}**`,
    '',
  ]

  if (data.usage.topDomains.length > 0) {
    lines.push('## Top sites')
    for (const d of data.usage.topDomains.slice(0, 5)) {
      lines.push(`- ${d.domain} — ${formatDuration(d.seconds)}`)
    }
    lines.push('')
  }

  const wc = data.weekCompare
  if (wc.topDistraction.domain) {
    lines.push('## Week over week')
    lines.push(`- Most distracting site: **${wc.topDistraction.domain}** (${formatDuration(wc.topDistraction.curSeconds)} this week vs ${formatDuration(wc.topDistraction.prevSeconds)} last)`)
    const fd = wc.focusSeconds
    lines.push(`- Focus time: ${formatDuration(fd.cur)} vs ${formatDuration(fd.prev)}${fd.deltaPct != null ? ` (${fd.deltaPct >= 0 ? '+' : ''}${Math.round(fd.deltaPct * 100)}%)` : ''}`)
    const gr = wc.goalRate
    lines.push(`- Goal rate: ${pct(gr.cur)} vs ${pct(gr.prev)}${gr.deltaPct != null ? ` (${gr.deltaPct >= 0 ? '+' : ''}${Math.round(gr.deltaPct * 100)}%)` : ''}`)
    lines.push('')
  }

  lines.push('## Reading')
  lines.push(`- Finished this range: **${data.reading.completedInRange}**`)
  lines.push(`- Added this range: **${data.reading.addedInRange}**`)
  lines.push(`- Currently reading: ${data.reading.reading} · Queued: ${data.reading.queue} · Done: ${data.reading.done}`)
  if (data.reading.recentlyDone.length > 0) {
    lines.push('')
    lines.push('### Recently finished')
    for (const item of data.reading.recentlyDone) {
      const link = item.url ? `[${item.title}](${item.url})` : item.title
      lines.push(`- ${link}`)
    }
  }

  return lines.join('\n')
}
