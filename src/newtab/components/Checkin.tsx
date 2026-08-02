import { useEffect, useState } from 'react'
import { setCheckin } from '../../lib/storage.ts'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

const SCALE = ['1', '2', '3', '4', '5']

/**
 * Mood + energy check-in. Ten inline toggles were the densest thing on the
 * page, so the scales live in a popover and the band only carries the result
 * once the day is logged.
 */
export function Checkin({
  date,
  value,
}: {
  date: string
  value?: { mood: number; energy: number }
}) {
  const [mood, setMood] = useState<number | null>(value?.mood ?? null)
  const [energy, setEnergy] = useState<number | null>(value?.energy ?? null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setMood(value?.mood ?? null)
    setEnergy(value?.energy ?? null)
  }, [value?.mood, value?.energy, date])

  const logged = value != null

  function pick(field: 'mood' | 'energy', raw: string) {
    const v = Number(raw)
    const nextMood = field === 'mood' ? v : mood
    const nextEnergy = field === 'energy' ? v : energy
    if (field === 'mood') setMood(v)
    else setEnergy(v)
    if (nextMood != null && nextEnergy != null) {
      void setCheckin(date, { mood: nextMood, energy: nextEnergy })
      // Close on the first completion only. Re-editing a logged day usually
      // means changing both scales, so keep the popover up and let Done close it.
      if (!logged) setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="checkin-trigger" aria-label="Daily check-in">
          <span className="micro">Check-in</span>
          {logged ? (
            <span className="checkin-readout">
              <span>
                M<b>{mood}</b>
              </span>
              <span>
                E<b>{energy}</b>
              </span>
            </span>
          ) : (
            <span className="checkin-readout empty">Log</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-4">
        <div className="checkin-scale">
          <span className="micro">Mood</span>
          <ToggleGroup
            type="single"
            size="sm"
            value={mood != null ? String(mood) : undefined}
            onValueChange={(v) => {
              if (v) pick('mood', v)
            }}
          >
            {SCALE.map((v) => (
              <ToggleGroupItem key={`m-${v}`} value={v} aria-label={`Mood ${v}`}>
                {v}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="checkin-scale">
          <span className="micro">Energy</span>
          <ToggleGroup
            type="single"
            size="sm"
            value={energy != null ? String(energy) : undefined}
            onValueChange={(v) => {
              if (v) pick('energy', v)
            }}
          >
            {SCALE.map((v) => (
              <ToggleGroupItem key={`e-${v}`} value={v} aria-label={`Energy ${v}`}>
                {v}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        {logged && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="mt-1 w-full"
            onClick={() => setOpen(false)}
          >
            Done
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
