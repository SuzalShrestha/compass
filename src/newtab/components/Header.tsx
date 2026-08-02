import { useEffect, useState } from 'react'
import { BarChart3, Settings } from 'lucide-react'
import { greetingFor, isoWeek, longDate } from '../../lib/dates.ts'
import type { Note, QuickLink } from '../../lib/types.ts'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { LinksButton } from './LinksPopover.tsx'
import { NotesButton } from './NotesPopover.tsx'

export function Header({
  name,
  links,
  notes,
  onOpenSettings,
  onOpenDashboard,
}: {
  name: string
  links: QuickLink[]
  notes: Note[]
  onOpenSettings: () => void
  onOpenDashboard: () => void
}) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 30)
    return () => clearInterval(id)
  }, [])

  const time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

  return (
    <header className="masthead">
      <div className="min-w-0">
        <h1>
          {greetingFor(now)}
          {name ? `, ${name}` : ''}.
        </h1>
        <div className="micro masthead-date">
          {longDate(now)} · Week {isoWeek(now)}
        </div>
      </div>
      <div className="masthead-right">
        <div className="clock">{time}</div>
        <TooltipProvider delayDuration={200}>
          <div className="icon-rail">
            <LinksButton links={links} />
            <NotesButton notes={notes} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Dashboard"
                  onClick={onOpenDashboard}
                >
                  <BarChart3 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Dashboard</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Settings"
                  onClick={onOpenSettings}
                >
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
