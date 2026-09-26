import { useState } from 'react'
import { X } from 'lucide-react'
import { addDistraction } from '../../lib/storage.ts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/** Compact one-tap distraction log for the focus strip. */
export function DistractionLog({ currentDomain }: { currentDomain?: string }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [justLogged, setJustLogged] = useState(false)

  function log() {
    void addDistraction({ domain: currentDomain, note: note.trim() || undefined })
    setNote('')
    setOpen(false)
    setJustLogged(true)
    setTimeout(() => setJustLogged(false), 1800)
  }

  if (open) {
    return (
      <div className="flex w-full items-center gap-1.5">
        <Input
          type="text"
          placeholder="What pulled you away? (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') log()
            if (e.key === 'Escape') setOpen(false)
          }}
          autoFocus
          className="h-8 text-xs"
        />
        <Button type="button" size="sm" onClick={log}>
          Log
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="shrink-0 gap-1.5"
      onClick={() => setOpen(true)}
      title="Log a moment you drifted — no judgement, just data"
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--user-accent)]" />
      {justLogged ? 'Noted. Back to it.' : 'I drifted'}
    </Button>
  )
}
