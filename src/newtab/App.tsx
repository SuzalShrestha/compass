import { useCallback, useEffect, useRef, useState } from 'react'
import { toDateKey } from '../lib/dates.ts'
import {
  useAllDays,
  useCalendarCache,
  useFocus,
  useHabits,
  useLongGoals,
  useNotes,
  useNow,
  useReading,
  useReminders,
  useSettings,
  useTimeToday,
} from '../lib/hooks.ts'
import { saveSettings } from '../lib/storage.ts'
import { startFocus } from '../lib/focus.ts'
import type { Settings } from '../lib/types.ts'
import { Header } from './components/Header.tsx'
import { Hero } from './components/Hero.tsx'
import { TasksCard } from './components/TasksCard.tsx'
import { AgendaCard } from './components/AgendaCard.tsx'
import { FocusCard } from './components/FocusCard.tsx'
import { HabitsCard } from './components/HabitsCard.tsx'
import { GoalsCard } from './components/GoalsCard.tsx'
import { ReadingCard } from './components/ReadingCard.tsx'
import { QuoteCard } from './components/QuoteCard.tsx'
import { CommandPalette } from './components/CommandPalette.tsx'
import { FeedbackProvider, useFeedback } from './components/feedback.tsx'
import { SettingsPanel, type SettingsTab } from './components/SettingsPanel.tsx'
import { Dashboard } from './components/dashboard/Dashboard.tsx'

const prefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches

/** Reflect theme + user accent onto the document root so CSS vars cascade. */
function useThemeEffect(theme: Settings['theme'], accent: string) {
  useEffect(() => {
    const el = document.documentElement
    const apply = () => {
      el.classList.remove('dark', 'light')
      if (theme === 'auto') el.removeAttribute('data-theme')
      else el.setAttribute('data-theme', theme)
      el.classList.add(theme === 'dark' || (theme === 'auto' && prefersDark()) ? 'dark' : 'light')
    }
    apply()
    // Follow the OS live when on auto.
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  useEffect(() => {
    document.documentElement.style.setProperty('--user-accent', accent)
  }, [accent])
}

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))

export function App() {
  return (
    <FeedbackProvider>
      <Home />
    </FeedbackProvider>
  )
}

function Home() {
  const now = useNow(30_000)
  const today = toDateKey(now)
  const [selectedDate, setSelectedDate] = useState(today)
  const { value: allDays } = useAllDays()
  const { value: longGoals } = useLongGoals()
  const { value: reading } = useReading()
  const { value: reminders } = useReminders()
  const { value: notes } = useNotes()
  const { value: habits } = useHabits()
  const { value: focus } = useFocus()
  const { value: calendar } = useCalendarCache()
  const { value: settings } = useSettings()
  const { value: timeToday } = useTimeToday()
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [view, setView] = useState<'home' | 'dashboard'>('home')
  const taskInput = useRef<HTMLInputElement>(null)
  const { toast } = useFeedback()

  useThemeEffect(settings?.theme ?? 'auto', settings?.accent ?? '#B4532A')

  // Roll the selection over at midnight if you were looking at "today".
  const lastToday = useRef(today)
  useEffect(() => {
    if (lastToday.current !== today) {
      setSelectedDate((d) => (d === lastToday.current ? today : d))
      lastToday.current = today
    }
  }, [today])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      } else if (!isTyping(e.target) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === '/') {
          e.preventDefault()
          setPaletteOpen(true)
        } else if (e.key === 'n' && view === 'home') {
          e.preventDefault()
          taskInput.current?.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view])

  const focusOn = useCallback(
    (label?: string) => {
      if (!settings) return
      void startFocus('focus', settings.focus.focusMinutes, label)
      toast(label ? `Focusing on “${label}”` : `${settings.focus.focusMinutes}-minute focus started`)
    },
    [settings, toast],
  )

  const toggleTheme = useCallback(() => {
    if (!settings) return
    const dark = document.documentElement.classList.contains('dark')
    void saveSettings({ ...settings, theme: dark ? 'light' : 'dark' })
  }, [settings])

  // Wait for settings (and its defaults) before painting, to avoid flashes.
  if (!settings) return null

  const settingsPanel = (
    <SettingsPanel
      open={settingsTab != null}
      tab={settingsTab ?? 'general'}
      settings={settings}
      reminders={reminders}
      calendarErrors={calendar.errors}
      onClose={() => setSettingsTab(null)}
    />
  )

  if (view === 'dashboard') {
    return (
      <div className="app">
        <Dashboard
          limits={settings.limits}
          categoryRules={settings.categoryRules}
          onBack={() => setView('home')}
        />
        {settingsPanel}
      </div>
    )
  }

  const todayDay = allDays[today] ?? { date: today, intention: '', goals: [] }
  const selectedDay = allDays[selectedDate] ?? { date: selectedDate, intention: '', goals: [] }
  const todayTasks = todayDay.goals.filter((g) => !g.movedTo)
  const enabledFeeds = new Set(settings.calendars.filter((f) => f.enabled).map((f) => f.id))
  const endOfToday = new Date(`${today}T00:00:00`)
  endOfToday.setDate(endOfToday.getDate() + 1)
  const nextEvent = calendar.events.find(
    (e) => enabledFeeds.has(e.feedId) && !e.allDay && e.start > now.getTime() && e.start < endOfToday.getTime(),
  )

  return (
    <main className="home">
      <Header
        now={now}
        name={settings.name}
        links={settings.quickLinks}
        notes={notes}
        done={todayTasks.filter((g) => g.done).length}
        total={todayTasks.length}
        nextEvent={nextEvent}
        onOpenSettings={() => setSettingsTab('general')}
        onOpenDashboard={() => setView('dashboard')}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      <Hero date={today} day={todayDay} hour={now.getHours()} />

      <div className="board">
        <div className="stack">
          <TasksCard
            date={selectedDate}
            today={today}
            day={selectedDay}
            allDays={allDays}
            longGoals={longGoals}
            onFocus={focusOn}
            inputRef={taskInput}
          />
          <GoalsCard goals={longGoals} allDays={allDays} today={today} />
        </div>

        <div className="stack">
          <AgendaCard
            now={now}
            selected={selectedDate}
            onSelect={setSelectedDate}
            days={allDays}
            events={calendar.events}
            feeds={settings.calendars}
            fetchedAt={calendar.fetchedAt}
            onConnect={() => setSettingsTab('calendar')}
          />
          <ReadingCard items={reading} readingGoal={settings.readingGoal} />
        </div>

        <div className="stack stack-c">
          <FocusCard
            focus={focus}
            settings={settings}
            focusMinutesToday={todayDay.focusMinutes ?? 0}
            taskLabels={todayTasks.filter((g) => !g.done).map((g) => g.text)}
            timeToday={timeToday}
            onOpenDashboard={() => setView('dashboard')}
          />
          <HabitsCard habits={habits} today={today} />
          <QuoteCard reminders={reminders} />
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        today={today}
        days={allDays}
        reading={reading}
        links={settings.quickLinks}
        onToast={toast}
        onSelectDate={setSelectedDate}
        onOpenDashboard={() => setView('dashboard')}
        onOpenSettings={() => setSettingsTab('general')}
        onStartFocus={() => focusOn()}
        onToggleTheme={toggleTheme}
      />
      {settingsPanel}
    </main>
  )
}
