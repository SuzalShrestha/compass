import { useEffect, useState } from 'react'
import { toDateKey } from '../lib/dates.ts'
import {
  useAllDays,
  useDay,
  useLongGoals,
  useNotes,
  useReading,
  useReminders,
  useSettings,
  useTimeToday,
} from '../lib/hooks.ts'
import { Header } from './components/Header.tsx'
import { Intention } from './components/Intention.tsx'
import { Checkin } from './components/Checkin.tsx'
import { GoalsChecklist } from './components/GoalsChecklist.tsx'
import { LongGoals } from './components/LongGoals.tsx'
import { ReadingHub } from './components/ReadingHub.tsx'
import { Ticker } from './components/Ticker.tsx'
import { DistractionLog } from './components/DistractionLog.tsx'
import { TimeToday } from './components/TimeToday.tsx'
import { SettingsPanel } from './components/SettingsPanel.tsx'
import { Dashboard } from './components/dashboard/Dashboard.tsx'
import { Calendar } from './components/Calendar.tsx'

/** Reflect theme + user accent onto the document root so CSS vars cascade. */
function useThemeEffect(theme: 'auto' | 'light' | 'dark', accent: string) {
  useEffect(() => {
    const el = document.documentElement
    el.classList.remove('dark', 'light')
    if (theme === 'light') {
      el.setAttribute('data-theme', 'light')
      el.classList.add('light')
    } else if (theme === 'dark') {
      el.setAttribute('data-theme', 'dark')
      el.classList.add('dark')
    } else {
      el.removeAttribute('data-theme')
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        el.classList.add('dark')
      }
    }
  }, [theme])

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--user-accent', accent)
    root.style.setProperty(
      '--user-accent-soft',
      `color-mix(in srgb, ${accent} 14%, transparent)`,
    )
    // Keep legacy --accent for any leftover refs; primary chrome stays monochrome.
    root.style.setProperty('--accent', accent)
  }, [accent])
}

export function App() {
  const today = toDateKey()
  const [selectedDate, setSelectedDate] = useState(today)
  const { value: day } = useDay(selectedDate)
  const { value: todayDay } = useDay(today)
  const { value: allDays } = useAllDays()
  const { value: longGoals } = useLongGoals()
  const { value: reading } = useReading()
  const { value: reminders } = useReminders()
  const { value: notes } = useNotes()
  const { value: settings } = useSettings()
  const { value: timeToday } = useTimeToday()
  const [showSettings, setShowSettings] = useState(false)
  const [view, setView] = useState<'home' | 'dashboard'>('home')

  useThemeEffect(settings?.theme ?? 'auto', settings?.accent ?? '#6B7686')

  // Wait for settings (and its defaults) before painting, to avoid flashes.
  if (!settings) return null

  if (view === 'dashboard') {
    return (
      <div className="app">
        <Dashboard
          limits={settings.limits}
          categoryRules={settings.categoryRules}
          onBack={() => setView('home')}
        />
        <SettingsPanel
          open={showSettings}
          settings={settings}
          reminders={reminders}
          onClose={() => setShowSettings(false)}
        />
      </div>
    )
  }

  const doneToday = todayDay.goals.filter((g) => g.done).length

  return (
    <div className="app home">
      <Header
        name={settings.name}
        links={settings.quickLinks}
        notes={notes}
        onOpenSettings={() => setShowSettings(true)}
        onOpenDashboard={() => setView('dashboard')}
      />

      {/* Intention band — the one dominant element on the page. */}
      <section className="intent-band">
        <Intention
          date={today}
          value={todayDay.intention}
          done={doneToday}
          total={todayDay.goals.length}
        />
        <Checkin date={today} value={todayDay.checkin} />
      </section>

      {/* Work row — 6/3/3 Swiss columns, hairline rules, no boxes. */}
      <div className="work">
        <div className="col col-today">
          <GoalsChecklist
            date={selectedDate}
            goals={day.goals}
            intention={day.intention}
          />
        </div>

        <div className="col col-goals">
          <LongGoals goals={longGoals} />
        </div>

        <div className="col col-context">
          <Calendar
            selected={selectedDate}
            days={allDays}
            onSelect={setSelectedDate}
          />
          <ReadingHub items={reading} compact />
        </div>
      </div>

      <footer className="ticker-bar">
        <Ticker reminders={reminders} />
        <div className="ticker-meta">
          <TimeToday
            data={timeToday}
            limits={settings.limits}
            trackingEnabled={settings.tracking.enabled}
            onOpenDashboard={() => setView('dashboard')}
          />
          <DistractionLog />
        </div>
      </footer>

      <SettingsPanel
        open={showSettings}
        settings={settings}
        reminders={reminders}
        onClose={() => setShowSettings(false)}
      />
    </div>
  )
}
