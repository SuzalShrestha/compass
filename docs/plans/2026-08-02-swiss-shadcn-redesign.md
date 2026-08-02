# Swiss + shadcn Redesign Implementation Plan

> **For Claude:** Implement task-by-task; verify with typecheck + build.

**Goal:** Rebuild Compass new-tab UI as Swiss minimal design on a full shadcn/ui shell.

**Architecture:** Tailwind v4 + shadcn tokens (radius 0, monochrome + one accent). Layout stays header / focus strip / 4 quadrants. All interactive controls use shadcn primitives.

**Tech Stack:** React 19, Vite, Tailwind v4, shadcn/ui, Lucide, CRXJS

---

### Task 1: Scaffold Tailwind + aliases + deps

- Install `tailwindcss`, `@tailwindcss/vite`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, Radix packages, `@types/node`
- Update `vite.config.ts` with tailwind plugin + `@` alias
- Update `tsconfig` paths for `@/*`
- Create `src/lib/utils.ts` with `cn()`
- Create `components.json`

### Task 2: Swiss global CSS

- Replace `src/newtab/styles.css` with Tailwind import + Swiss-mapped shadcn CSS variables
- Keep layout utilities (`.app.home`, `.quadrants`, etc.) as thin CSS or Tailwind classes
- Wire theme via `data-theme` / `.dark` class

### Task 3: Add shadcn UI primitives

- button, input, checkbox, label, separator, badge, switch, tabs, popover, dialog, sheet, scroll-area, tooltip, progress, toggle-group, select, textarea

### Task 4: Rebuild home components

- Header, Intention, Checkin, Reminders, DistractionLog
- GoalsChecklist, LongGoals, Calendar
- TimeToday, ReadingHub, Quote
- LinksPopover, NotesPopover (shadcn Popover)
- App.tsx layout classes

### Task 5: Rebuild Settings + Dashboard

- SettingsPanel → Sheet + Tabs + form controls
- Dashboard, StatCard, charts keep visual language

### Task 6: Verify

- `pnpm typecheck` && `pnpm build` && `pnpm test`
- Manual smoke: new tab loads, check goal, open settings

---
