import { useEffect, useRef, useState } from 'react'
import { setIntention } from '../../lib/storage.ts'

/**
 * The day's headline. Borderless until focused, with today's todo progress
 * drawn as a hairline directly beneath it — the page's only progress meter.
 */
export function Intention({
  date,
  value,
  done,
  total,
}: {
  date: string
  value: string
  done: number
  total: number
}) {
  const [text, setText] = useState(value)
  const dirty = useRef(false)

  useEffect(() => {
    if (!dirty.current) setText(value)
  }, [value, date])

  function commit() {
    dirty.current = false
    if (text !== value) void setIntention(date, text)
  }

  const pct = total > 0 ? (done / total) * 100 : 0

  return (
    <div className="intent-field">
      <span className="micro">Intention</span>
      <input
        type="text"
        value={text}
        placeholder="What does winning today look like?"
        onChange={(e) => {
          dirty.current = true
          setText(e.target.value)
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />
      <div className="intent-progress">
        <div className="intent-track">
          <i style={{ width: `${pct}%` }} />
        </div>
        <span className="intent-count">
          {total > 0 ? `${done}/${total} today` : 'No todos yet'}
        </span>
      </div>
    </div>
  )
}
