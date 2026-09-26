import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { snapshotKey } from '../../lib/storage.ts'

// ---------------------------------------------------------------------------
// Toasts (with Undo) and a small confetti burst for wins.
// ---------------------------------------------------------------------------

interface Toast {
  id: number
  text: string
  action?: { label: string; run: () => void }
}

interface Feedback {
  toast: (text: string, action?: Toast['action']) => void
  /** Run a destructive change on `key`, offering Undo for a few seconds. */
  undoable: (key: string, text: string, change: () => Promise<void>) => Promise<void>
  celebrate: (from?: { x: number; y: number }) => void
}

const Ctx = createContext<Feedback | null>(null)

export function useFeedback(): Feedback {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useFeedback outside FeedbackProvider')
  return ctx
}

const CONFETTI = ['#B4532A', '#D99A1E', '#4F7A5C', '#2F6F9F', '#7A4E8C', '#E07A5F']

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([])
  const next = useRef(0)

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const toast = useCallback<Feedback['toast']>(
    (text, action) => {
      const id = ++next.current
      setToasts((t) => [...t.slice(-2), { id, text, action }])
      setTimeout(() => dismiss(id), action ? 6000 : 3200)
    },
    [dismiss],
  )

  const undoable = useCallback<Feedback['undoable']>(
    async (key, text, change) => {
      const restore = await snapshotKey(key)
      await change()
      toast(text, { label: 'Undo', run: () => void restore() })
    },
    [toast],
  )

  const celebrate = useCallback<Feedback['celebrate']>((from) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = ++next.current
    const x = from?.x ?? window.innerWidth / 2
    const y = from?.y ?? window.innerHeight / 3
    setBursts((b) => [...b, { id, x, y }])
    setTimeout(() => setBursts((b) => b.filter((p) => p.id !== id)), 1300)
  }, [])

  return (
    <Ctx.Provider value={{ toast, undoable, celebrate }}>
      {children}
      <div className="toaster" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.text}
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.run()
                  dismiss(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
      {bursts.map((b) => (
        <div key={b.id} className="confetti" style={{ left: b.x, top: b.y }} aria-hidden>
          {Array.from({ length: 22 }, (_, i) => {
            const angle = (i / 22) * Math.PI * 2 + Math.random() * 0.4
            const dist = 70 + Math.random() * 90
            return (
              <i
                key={i}
                style={
                  {
                    '--c': CONFETTI[i % CONFETTI.length],
                    '--dx': `${Math.cos(angle) * dist}px`,
                    '--dy': `${Math.sin(angle) * dist + 60}px`,
                    '--rot': `${Math.random() * 540 - 270}deg`,
                    animationDelay: `${Math.random() * 80}ms`,
                  } as React.CSSProperties
                }
              />
            )
          })}
        </div>
      ))}
    </Ctx.Provider>
  )
}
