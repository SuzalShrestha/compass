import { BarChart3, Search, Settings } from 'lucide-react'
import { greetingFor, isoWeek } from '../../lib/dates.ts'
import type { CalEvent, Note, QuickLink } from '../../lib/types.ts'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { LinksButton } from './LinksPopover.tsx'
import { NotesButton } from './NotesPopover.tsx'
import { relativeMinutes } from './AgendaCard.tsx'

const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)

export function Header({
  now,
  name,
  links,
  notes,
  done,
  total,
  nextEvent,
  onOpenSettings,
  onOpenDashboard,
  onOpenPalette,
}: {
  now: Date
  name: string
  links: QuickLink[]
  notes: Note[]
  done: number
  total: number
  nextEvent?: CalEvent
  onOpenSettings: () => void
  onOpenDashboard: () => void
  onOpenPalette: () => void
}) {
  const parts = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).formatToParts(now)
  const time = parts
    .filter((p) => p.type !== 'dayPeriod')
    .map((p) => p.value)
    .join('')
    .trim()
  const period = parts.find((p) => p.type === 'dayPeriod')?.value

  const date = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  const left = total - done

  return (
    <header className="topbar">
      <div className="greeting min-w-0">
        <h1>
          {greetingFor(now)}
          {name ? (
            <>
              , <span className="name">{name}</span>
            </>
          ) : null}
          .
        </h1>
        <div className="subline">
          <span>{date}</span>
          <i className="dot" />
          <span>Week {isoWeek(now)}</span>
          {total > 0 && (
            <>
              <i className="dot" />
              <span>
                {left === 0 ? (
                  <b>All {total} tasks done</b>
                ) : (
                  <>
                    <b>{left}</b> {left === 1 ? 'task' : 'tasks'} to go
                  </>
                )}
              </span>
            </>
          )}
          {nextEvent && (
            <>
              <i className="dot" />
              <span>
                Next: <b>{nextEvent.title}</b> {relativeMinutes(nextEvent.start, now.getTime())}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="topbar-right">
        <div className="clock" aria-label="Current time">
          {time}
          {period && <span className="ampm">{period}</span>}
        </div>
        <TooltipProvider delayDuration={250}>
          <div className="toolbar">
            <button type="button" className="cmdk-hint" onClick={onOpenPalette} aria-label="Search or add">
              <Search className="h-3.5 w-3.5" />
              <span className="cmdk-label">Search or add</span>
              <span className="kbd">{isMac ? '⌘' : 'Ctrl'} K</span>
            </button>
            <LinksButton links={links} />
            <NotesButton notes={notes} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" variant="ghost" size="icon" aria-label="Dashboard" onClick={onOpenDashboard}>
                  <BarChart3 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Dashboard</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" variant="ghost" size="icon" aria-label="Settings" onClick={onOpenSettings}>
                  <Settings />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Settings</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    </header>
  )
}
