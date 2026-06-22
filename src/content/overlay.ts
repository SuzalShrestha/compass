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

  if (stage === 2) {
    const bar = document.createElement('div')
    bar.id = BANNER_ID
    bar.setAttribute(
      'style',
      [
        'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:2147483647',
        'background:#1c2230', 'color:#e8eaed', 'font:14px/1.4 -apple-system,Segoe UI,Roboto,sans-serif',
        'padding:10px 16px', 'display:flex', 'align-items:center', 'gap:12px',
        'box-shadow:0 2px 12px rgba(0,0,0,.3)', 'border-bottom:2px solid #7c9cff',
      ].join(';'),
    )
    const msg = document.createElement('span')
    msg.style.flex = '1'
    msg.textContent = `Compass · You're past your ${limitMinutes}m limit on ${domain} today (${usedMinutes}m). Wrap it up?`
    const btn = document.createElement('button')
    btn.textContent = 'Snooze 5m'
    btn.setAttribute(
      'style',
      'background:#7c9cff;color:#0e1116;border:0;border-radius:7px;padding:6px 12px;font-weight:600;cursor:pointer',
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
      'background:rgba(10,12,18,.97)', 'backdrop-filter:blur(6px)',
      'color:#e8eaed', 'font-family:-apple-system,Segoe UI,Roboto,sans-serif',
      'display:flex', 'flex-direction:column', 'align-items:center', 'justify-content:center',
      'text-align:center', 'padding:40px',
    ].join(';'),
  )

  const heading = document.createElement('div')
  heading.textContent = `Enough of ${domain} for today.`
  heading.setAttribute('style', 'font-size:30px;font-weight:600;letter-spacing:-0.02em;margin-bottom:14px')

  const sub = document.createElement('div')
  sub.textContent = `${usedMinutes} minutes used · ${limitMinutes} minute limit`
  sub.setAttribute('style', 'font-size:15px;color:#9aa3af;margin-bottom:28px')

  const q = document.createElement('div')
  q.textContent = `“${quote}”`
  q.setAttribute(
    'style',
    'max-width:520px;font-size:18px;line-height:1.5;color:#cfd4dc;border-left:3px solid #7c9cff;padding-left:18px;text-align:left;margin-bottom:32px',
  )

  const row = document.createElement('div')
  row.setAttribute('style', 'display:flex;gap:12px')

  const close = document.createElement('button')
  close.textContent = 'Close this tab'
  close.setAttribute(
    'style',
    'background:#7c9cff;color:#0e1116;border:0;border-radius:9px;padding:11px 18px;font-size:14px;font-weight:600;cursor:pointer',
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
    'background:transparent;color:#9aa3af;border:1px solid rgba(255,255,255,.15);border-radius:9px;padding:11px 18px;font-size:14px;cursor:pointer',
  )
  snoozeBtn.onclick = () => {
    snooze()
    block.remove()
  }

  row.append(close, snoozeBtn)
  block.append(heading, sub, q, row)
  document.documentElement.appendChild(block)
}
