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

/**
 * Chrome's own favicon cache (MV3 `_favicon`), so no request leaves the
 * machine. Falls back to nothing outside the extension.
 */
export function faviconFor(url: string): string {
  if (typeof chrome === 'undefined' || !chrome.runtime?.id) return ''
  return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`
}

/** Trigger + panel wired together for the header. */
export function LinksButton({ links }: { links: QuickLink[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="Quick links" title="Quick links">
          <ExternalLink />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="pop-head">Quick links</div>
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
                    className="flex items-center gap-3 px-4 py-2.5 text-foreground no-underline transition-colors duration-150 hover:bg-muted"
                  >
                    <img src={faviconFor(l.url)} alt="" width={16} height={16} className="shrink-0 rounded-sm" />
                    <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium">{l.label}</span>
                    <span className="text-xs text-muted-foreground">{hostOf(l.url)}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
        <Separator />
        <p className="m-0 px-4 py-2 text-xs text-muted-foreground">Edit links in Settings</p>
      </PopoverContent>
    </Popover>
  )
}
