import { useEffect, useState } from 'react'
import { Minus, Pause, Play, Plus, Square, Timer } from 'lucide-react'
import type { FocusState, Settings } from '../../lib/types.ts'
import type { TimeToday as TimeTodayData } from '../../lib/hooks.ts'
import { useNow } from '../../lib/hooks.ts'
import { completeFocus, pauseFocus, resumeFocus, startFocus, stopFocus } from '../../lib/focus.ts'
import { saveFocus } from '../../lib/storage.ts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CardHead, Ring } from './bits.tsx'
import { TimeToday } from './TimeToday.tsx'
import { DistractionLog } from './DistractionLog.tsx'

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function FocusCard({
  focus,
  settings,
  focusMinutesToday,
  taskLabels,
  timeToday,
  onOpenDashboard,
}: {
  focus: FocusState
  settings: Settings
  focusMinutesToday: number
  taskLabels: string[]
  timeToday: TimeTodayData
  onOpenDashboard: () => void
}) {
  const running = focus.status === 'running'
  const now = useNow(running ? 1000 : 60_000).getTime()
  const [label, setLabel] = useState(focus.label ?? '')

  useEffect(() => setLabel(focus.label ?? ''), [focus.label])

  const total = focus.minutes * 60_000
  const left = running ? (focus.endsAt ?? now) - now : focus.status === 'paused' ? (focus.remaining ?? total) : total
  const due = running && left <= 0

  // Outside the extension there's no alarm to finish the session for us.
  useEffect(() => {
    if (due && (typeof chrome === 'undefined' || !chrome.alarms)) void completeFocus()
  }, [due])

  const isFocus = focus.kind === 'focus'
  const setKind = (kind: FocusState['kind']) =>
    void saveFocus({
      ...focus,
      kind,
      minutes: kind === 'focus' ? settings.focus.focusMinutes : settings.focus.breakMinutes,
    })
  const nudge = (d: number) =>
    void saveFocus({ ...focus, minutes: Math.min(180, Math.max(5, focus.minutes + d)) })

  return (
    <section className={cn('card', running && 'running')} style={{ '--i': 2 } as React.CSSProperties}>
      <CardHead icon={<Timer />} title="Focus">
        {focus.status === 'idle' && (
          <div className="seg">
            <button type="button" className={cn(isFocus && 'on')} onClick={() => setKind('focus')}>
              Focus
            </button>
            <button type="button" className={cn(!isFocus && 'on')} onClick={() => setKind('break')}>
              Break
            </button>
          </div>
        )}
      </CardHead>

      <div className="focus-body">
        <Ring value={focus.status === 'idle' ? 0 : 1 - left / total} size={92} stroke={7}>
          <div>
            <div className="focus-time">{mmss(left)}</div>
            <div className="focus-kind">{due ? 'wrapping up' : isFocus ? 'focus' : 'break'}</div>
          </div>
        </Ring>

        <div className="focus-side">
          {focus.status === 'idle' ? (
            <>
              <input
                className="focus-label"
                list="compass-task-labels"
                placeholder={isFocus ? 'What will you focus on?' : 'Rest your eyes, stretch…'}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void startFocus(focus.kind, focus.minutes, label)}
              />
              <datalist id="compass-task-labels">
                {taskLabels.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <div className="focus-controls">
                <Button type="button" size="sm" onClick={() => void startFocus(focus.kind, focus.minutes, label)}>
                  <Play className="!size-3.5" /> Start {focus.minutes} min
                </Button>
                <button type="button" className="icon-btn" aria-label="5 minutes less" onClick={() => nudge(-5)}>
                  <Minus />
                </button>
                <button type="button" className="icon-btn" aria-label="5 minutes more" onClick={() => nudge(5)}>
                  <Plus />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="truncate text-sm font-medium" title={focus.label}>
                {focus.label || (isFocus ? 'Deep work' : 'Break')}
              </div>
              <div className="focus-controls">
                {running ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => void pauseFocus()}>
                    <Pause className="!size-3.5" /> Pause
                  </Button>
                ) : (
                  <Button type="button" size="sm" onClick={() => void resumeFocus()}>
                    <Play className="!size-3.5" /> Resume
                  </Button>
                )}
                <Button type="button" size="sm" variant="ghost" onClick={() => void stopFocus()}>
                  <Square className="!size-3.5" /> Stop
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="focus-foot">
        <span>
          Focused today <b>{focusMinutesToday >= 60 ? `${Math.floor(focusMinutesToday / 60)}h ${focusMinutesToday % 60}m` : `${focusMinutesToday}m`}</b>
        </span>
        <TimeToday
          data={timeToday}
          limits={settings.limits}
          trackingEnabled={settings.tracking.enabled}
          onOpenDashboard={onOpenDashboard}
        />
        <DistractionLog />
      </div>
    </section>
  )
}
