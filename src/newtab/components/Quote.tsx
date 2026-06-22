import { quoteForDay } from '../../lib/quotes.ts'

export function Quote() {
  const q = quoteForDay()
  return (
    <blockquote className="quote">
      <p>“{q.text}”</p>
      <cite>— {q.source}</cite>
    </blockquote>
  )
}
