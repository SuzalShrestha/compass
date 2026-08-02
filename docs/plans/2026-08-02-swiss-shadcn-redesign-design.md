# Swiss + shadcn redesign — design

**Date:** 2026-08-02  
**Status:** Approved  
**Product:** Compass (Chrome new-tab extension)

## Goals

- Clean, professional, minimal **Swiss design**
- **Fun via crisp micro-interactions** (not playful decoration)
- **shadcn/ui for all interactive UI**

## Non-goals

- New features / data model changes
- Content-script overlay redesign
- Confetti / emoji icons / decorative motion

## Visual system

| Token | Light | Dark |
|-------|--------|------|
| Background | `#ffffff` | `#0a0a0a` |
| Foreground | `#0a0a0a` | `#f4f4f5` |
| Muted | `#71717a` | `#a1a1aa` |
| Border | `#e4e4e7` | `white/10` |
| Primary | ink (near black/white) | inverted |
| User accent | Settings.accent | slight lift in dark |
| Radius | `0` | `0` |

- Type: Inter system stack; micro labels 11px uppercase tracked
- Structure: 1px hairline rules only (no shadows/gradients)
- Icons: Lucide only

## Layout (IA unchanged)

Four full-bleed bands, separated by hairline rules — never boxes. Only the
work row scrolls, per column.

1. **Masthead** — greeting, date + ISO week, clock, ghost icon rail
   (links / notes / dashboard / settings)
2. **Intention band** — the day's headline at 21px, borderless until focused,
   with today's todo progress as the hairline beneath it. Check-in sits right,
   collapsed to `M4 E3`; the 1–5 scales live in a Popover.
3. **Work row** — asymmetric 6 / 3 / 3 of 12: Today · Goals · (Calendar +
   Reading)
4. **Ticker** — one quiet line cycling reminders and the day's quote; right
   side carries today's total screen time (→ Dashboard) and "Caught myself"

Dashboard is a separate view; Settings is a Sheet.

**Demoted deliberately:** the per-domain time list moved to the Dashboard —
home shows the total plus the worst limit breach only. The quote lost its own
block and shares the ticker.

Breakpoints: 3 columns → 2 (≤1180, context rail scrolls) → stacked (≤820,
page scrolls).

## Component map

Button, Input, Textarea, Checkbox, Switch, Label, Separator, Badge, Progress, ScrollArea, Tabs, ToggleGroup, Popover, Dialog/Sheet, Tooltip, Select.

## Fun (micro-interactions)

All 120–320ms, all under the existing `prefers-reduced-motion` guard.

- **Strike-through as a drawn stroke** — checking a todo animates a
  `background-size` gradient rule across the text (220ms) instead of snapping
  on `text-decoration`
- **Hover ink bar** — a 1px rule wipes down the left edge of a row (`scaleY`,
  160ms); no background shift
- **Progress hairline** — the intention underline eases to its new width
  (320ms) as todos get checked
- **Calendar inversion** — cells flip to ink on hover (120ms)
- **Reveal on intent** — row remove buttons are invisible until hover or
  `:focus-visible`
- **Add is dead until it isn't** — Add buttons stay disabled while the input
  is empty
- Focus rings as ink outline  
- Empty states: one sharp sentence  

## Tech

- Tailwind CSS v4 + `@tailwindcss/vite`  
- shadcn/ui (Radix, CVA, lucide-react)  
- Path alias `@/` → `src/`  
- Swiss CSS variables mapped to shadcn theme tokens  
