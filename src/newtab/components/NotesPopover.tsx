import { useState } from 'react'
import { NotebookPen, X } from 'lucide-react'
import type { Note } from '../../lib/types.ts'
import { addNote, removeNote } from '../../lib/storage.ts'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { useFeedback } from './feedback.tsx'

export function NotesButton({ notes }: { notes: Note[] }) {
  const { undoable } = useFeedback()
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
        <Button type="button" variant="ghost" size="icon" aria-label="Notes" title="Notes">
          <NotebookPen />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="pop-head">Notes</div>
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
                <li key={n.id} className="note-row">
                  <p>{n.text}</p>
                  <button
                    type="button"
                    className="icon-btn danger reveal"
                    title="Delete note"
                    onClick={() => void undoable('notes', 'Note deleted', () => removeNote(n.id))}
                  >
                    <X />
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
        <Separator />
        <p className="m-0 px-4 py-2 text-xs text-muted-foreground">⌘/Ctrl + Enter to save</p>
      </PopoverContent>
    </Popover>
  )
}
