import { ExternalLink } from 'lucide-react'
import type { QuickLink } from '../../lib/types.ts'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Trigger + panel wired together for the header. */
export function LinksButton({ links }: { links: QuickLink[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label="Links" title="Links">
          <ExternalLink />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="m-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Links
          </h3>
        </div>
        <Separator />
        {links.length === 0 ? (
          <p className="empty px-4 py-3">No links yet. Add them in Settings.</p>
        ) : (
          <ScrollArea className="max-h-[320px]">
            <ul className="m-0 list-none p-0">
              {links.map((l) => (
                <li key={l.id} className="border-b border-border last:border-0">
                  <a
                    href={l.url}
                    className="flex flex-col gap-0.5 px-4 py-2.5 text-foreground no-underline transition-colors duration-150 hover:bg-muted"
                  >
                    <span className="text-sm font-medium">{l.label}</span>
                    <span className="text-[11px] text-muted-foreground">{hostOf(l.url)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
        <Separator />
        <p className="m-0 px-4 py-2 text-[11px] text-muted-foreground">Edit links in Settings</p>
      </PopoverContent>
    </Popover>
  )
}
