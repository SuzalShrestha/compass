// Injected into a limited page via chrome.scripting.executeScript.
//
// IMPORTANT: this function is serialized and run in the page's isolated world,
// so it must be fully self-contained — no imports, no closure over module
// scope. It may only touch DOM globals and chrome.runtime (available in the
// isolated content world). All data arrives through its arguments.

export function renderLimitOverlay(
  stage: 2 | 3,
  domain: string,
  usedMinutes: number,
  limitMinutes: number,
  quote: string,
  accent: string,
): void {
  const BANNER_ID = 'compass-limit-banner'
  const BLOCK_ID = 'compass-limit-block'

  // Clear any previous Compass UI so re-injection doesn't stack.
  document.getElementById(BANNER_ID)?.remove()
  document.getElementById(BLOCK_ID)?.remove()

  const snooze = () => {
    try {
      chrome.runtime.sendMessage({ type: 'compass-snooze', domain })
    } catch {
      /* extension context gone — ignore */
    }
  }

  const caught = () => {
    try {
      chrome.runtime.sendMessage({ type: 'compass-distraction', domain })
    } catch {
      /* ignore */
    }
  }

  // Swiss: sharp corners, flat, near-monochrome. The accent shows only as a
  // 3px left rule so it reads on any page background without clashing.
  if (stage === 2) {
    const bar = document.createElement('div')
    bar.id = BANNER_ID
    bar.setAttribute(
      'style',
      [
        'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:2147483647',
        'background:#0a0a0a', 'color:#f4f4f5',
        'font:13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif',
        'padding:11px 18px', 'display:flex', 'align-items:center', 'gap:14px',
        'border-left:3px solid ' + accent,
        'text-transform:uppercase', 'letter-spacing:0.06em', 'font-weight:600',
      ].join(';'),
    )
    const msg = document.createElement('span')
    msg.style.flex = '1'
    msg.style.textTransform = 'none'
    msg.style.letterSpacing = 'normal'
    msg.style.fontWeight = '400'
    msg.textContent = `Compass — past your ${limitMinutes}m limit on ${domain} (${usedMinutes}m). Wrap it up?`
    const btn = document.createElement('button')
    btn.textContent = 'Snooze 5m'
    btn.setAttribute(
      'style',
      'background:transparent;color:#f4f4f5;border:1px solid #f4f4f5;border-radius:0;padding:6px 12px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;cursor:pointer',
    )
    btn.onclick = () => {
      snooze()
      bar.remove()
    }
    bar.append(msg, btn)
    document.documentElement.appendChild(bar)
    return
  }

  // Stage 3 — full-screen block.
  const block = document.createElement('div')
  block.id = BLOCK_ID
  block.setAttribute(
    'style',
    [
      'position:fixed', 'inset:0', 'z-index:2147483647',
      'background:#0a0a0a',
      'color:#f4f4f5', 'font-family:-apple-system,Segoe UI,Roboto,sans-serif',
      'display:flex', 'flex-direction:column', 'align-items:center', 'justify-content:center',
      'text-align:center', 'padding:48px',
      'border-top:4px solid ' + accent,
    ].join(';'),
  )

  const eyebrow = document.createElement('div')
  eyebrow.textContent = 'COMPASS · LIMIT REACHED'
  eyebrow.setAttribute(
    'style',
    'font-size:11px;color:#a1a1aa;letter-spacing:0.16em;font-weight:600;margin-bottom:18px',
  )

  const heading = document.createElement('div')
  heading.textContent = `Enough ${domain} for today.`
  heading.setAttribute('style', 'font-size:32px;font-weight:600;letter-spacing:-0.02em;margin-bottom:14px')

  const sub = document.createElement('div')
  sub.textContent = `${usedMinutes} minutes used · ${limitMinutes} minute limit`
  sub.setAttribute('style', 'font-size:14px;color:#a1a1aa;margin-bottom:32px;font-variant-numeric:tabular-nums')

  const q = document.createElement('div')
  q.textContent = `“${quote}”`
  q.setAttribute(
    'style',
    'max-width:540px;font-size:17px;line-height:1.5;color:#d4d4d8;border-left:2px solid ' + accent + ';padding-left:18px;text-align:left;margin-bottom:36px',
  )

  const row = document.createElement('div')
  row.setAttribute('style', 'display:flex;gap:12px')

  const close = document.createElement('button')
  close.textContent = 'Close this tab'
  close.setAttribute(
    'style',
    'background:#f4f4f5;color:#0a0a0a;border:1px solid #f4f4f5;border-radius:0;padding:12px 20px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;cursor:pointer',
  )
  close.onclick = () => {
    try {
      chrome.runtime.sendMessage({ type: 'compass-close' })
    } catch {
      window.close()
    }
  }

  const snoozeBtn = document.createElement('button')
  snoozeBtn.textContent = '5 more minutes'
  snoozeBtn.setAttribute(
    'style',
    'background:transparent;color:#a1a1aa;border:1px solid #a1a1aa;border-radius:0;padding:12px 20px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;cursor:pointer',
  )
  snoozeBtn.onclick = () => {
    snooze()
    block.remove()
  }

  row.append(close, snoozeBtn)

  const caughtRow = document.createElement('div')
  caughtRow.setAttribute('style', 'margin-top:18px')
  const caughtBtn = document.createElement('button')
  caughtBtn.textContent = 'I caught myself — log it'
  caughtBtn.setAttribute(
    'style',
    'background:transparent;color:#a1a1aa;border:0;padding:6px 10px;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;cursor:pointer;text-decoration:underline;text-underline-offset:3px',
  )
  caughtBtn.onclick = () => {
    caught()
    block.remove()
  }
  caughtRow.append(caughtBtn)

  block.append(eyebrow, heading, sub, q, row, caughtRow)
  document.documentElement.appendChild(block)
}
