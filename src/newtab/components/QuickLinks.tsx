import type { QuickLink } from '../../lib/types.ts'

export function QuickLinks({ links }: { links: QuickLink[] }) {
  if (links.length === 0) return null
  return (
    <nav className="quicklinks">
      {links.map((l) => (
        <a key={l.id} href={l.url}>
          {l.label}
        </a>
      ))}
    </nav>
  )
}
