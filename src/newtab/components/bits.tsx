import { forwardRef, useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Round (or square) check that pops and draws its tick when turned on. */
export function Check({
  on,
  onToggle,
  label,
  square,
}: {
  on: boolean
  onToggle: (e: React.MouseEvent) => void
  label: string
  square?: boolean
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      className={cn('check', on && 'on', square && 'square')}
      onClick={onToggle}
    >
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 6.2 5 8.6l4.6-5" />
      </svg>
    </button>
  )
}

/** SVG progress ring. `value` is 0–1. */
export function Ring({
  value,
  size = 64,
  stroke = 6,
  children,
}: {
  value: number
  size?: number
  stroke?: number
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="pring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden>
        <circle className="track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className="fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ opacity: v === 0 ? 0 : 1 }}
        />
      </svg>
      {children && <div className="pring-center">{children}</div>}
    </div>
  )
}

/** The "+ Add something…" field at the foot of each card. Enter submits. */
export const AddField = forwardRef<
  HTMLInputElement,
  { placeholder: string; onAdd: (text: string) => void; hint?: string; icon?: ReactNode }
>(function AddField({ placeholder, onAdd, hint = '↵ to add', icon }, ref) {
  const [text, setText] = useState('')
  return (
    <label className="add-field">
      {icon ?? <Plus />}
      <input
        ref={ref}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && text.trim()) {
            onAdd(text.trim())
            setText('')
          }
          if (e.key === 'Escape') {
            setText('')
            e.currentTarget.blur()
          }
        }}
      />
      <span className="hint">{hint}</span>
    </label>
  )
})

export function CardHead({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children?: ReactNode
}) {
  return (
    <div className="card-head">
      <span className="card-icon">{icon}</span>
      <h2 className="card-title">{title}</h2>
      {children && <div className="card-meta">{children}</div>}
    </div>
  )
}

/** Stable, pleasant colour per string — used for generated book covers. */
const SPINES = ['#8C3B2E', '#2F5D7C', '#4F6F52', '#6B4C7A', '#8A6A2A', '#3D5A5A', '#7A3E55', '#44506B']
export function colorFor(text: string): string {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0
  return SPINES[Math.abs(h) % SPINES.length]
}
