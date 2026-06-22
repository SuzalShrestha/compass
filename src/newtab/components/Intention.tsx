import { useEffect, useRef, useState } from 'react'
import { setIntention } from '../../lib/storage.ts'

export function Intention({ date, value }: { date: string; value: string }) {
  const [text, setText] = useState(value)
  const dirty = useRef(false)

  // Keep in sync if storage changes elsewhere and the user isn't editing.
  useEffect(() => {
    if (!dirty.current) setText(value)
  }, [value])

  function commit() {
    dirty.current = false
    if (text !== value) void setIntention(date, text)
  }

  return (
    <div className="intention card">
      <h2>Today's intention</h2>
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
    </div>
  )
}
