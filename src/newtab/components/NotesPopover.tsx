import { useState } from 'react'
import { NotebookPen, X } from 'lucide-react'
import type { Note } from '../../lib/types.ts'
import { addNote, removeNote } from '../../lib/storage.ts'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'

export function NotesButton({ notes }: { notes: Note[] }) {
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)

  function submit() {
    const text = draft.trim()
    if (!text) return
    void addNote(text)
    setDraft('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label="Notes" title="Notes">
          <NotebookPen />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="px-4 py-3">
          <h3 className="m-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Notes
          </h3>
        </div>
        <Separator />
        <div className="flex flex-col gap-2 p-4">
          <Textarea
            value={draft}
            placeholder="Quick note…"
            rows={2}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
            }}
          />
          <Button
            type="button"
            size="sm"
            className="self-end"
            onClick={submit}
            disabled={!draft.trim()}
          >
            Add
          </Button>
        </div>
        <Separator />
        {notes.length === 0 ? (
          <p className="empty px-4 py-3">No notes yet.</p>
        ) : (
          <ScrollArea className="max-h-[240px]">
            <ul className="m-0 list-none p-0">
              {notes.map((n) => (
                <li
                  key={n.id}
                  className="flex items-start gap-2 border-b border-border px-4 py-2.5 last:border-0"
                >
                  <p className="m-0 min-w-0 flex-1 whitespace-pre-wrap text-sm leading-snug">
                    {n.text}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    title="Delete"
                    onClick={() => void removeNote(n.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
        <Separator />
        <p className="m-0 px-4 py-2 text-[11px] text-muted-foreground">⌘/Ctrl + Enter to save</p>
      </PopoverContent>
    </Popover>
  )
}
