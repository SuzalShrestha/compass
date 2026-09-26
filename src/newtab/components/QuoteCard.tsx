import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import type { Reminder } from '../../lib/types.ts'
import { quoteForDay } from '../../lib/quotes.ts'

/** The day's quote, with your own reminders rotating quietly underneath. */
export function QuoteCard({ reminders }: { reminders: Reminder[] }) {
  const quote = quoteForDay()
  const lines = reminders.filter((r) => r.enabled)
  const [i, setI] = useState(0)

  useEffect(() => {
    if (lines.length <= 1) return
    const id = setInterval(() => setI((n) => n + 1), 12_000)
    return () => clearInterval(id)
  }, [lines.length])

  const current = lines.length > 0 ? lines[i % lines.length] : null

  return (
    <section className="card quote-card" style={{ '--i': 6 } as React.CSSProperties}>
      <div className="quote-mark" aria-hidden>
        “
      </div>
      <blockquote className="quote-text m-0">{quote.text}</blockquote>
      <cite className="quote-cite">— {quote.source}</cite>
      {current && (
        <div className="reminder">
          <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p key={`${current.id}-${i}`}>{current.text}</p>
        </div>
      )}
    </section>
  )
}
