import { useEffect, useState } from 'react'
import { toDateKey } from '../lib/dates.ts'
import { useDay, useReading, useReminders, useSettings, useTimeToday } from '../lib/hooks.ts'
import { Header } from './components/Header.tsx'
import { QuickLinks } from './components/QuickLinks.tsx'
import { Quote } from './components/Quote.tsx'
import { Intention } from './components/Intention.tsx'
import { Checkin } from './components/Checkin.tsx'
import { GoalsChecklist } from './components/GoalsChecklist.tsx'
import { ReadingHub } from './components/ReadingHub.tsx'
import { Reminders } from './components/Reminders.tsx'
import { DistractionLog } from './components/DistractionLog.tsx'
import { TimeToday } from './components/TimeToday.tsx'
import { SettingsPanel } from './components/SettingsPanel.tsx'
import { Dashboard } from './components/dashboard/Dashboard.tsx'

/** Reflect theme + accent onto the document root so CSS vars cascade. */
function useThemeEffect(theme: 'auto' | 'light' | 'dark', accent: string) {
  useEffect(() => {
    const el = document.documentElement
    if (theme === 'light' || theme === 'dark') el.setAttribute('data-theme', theme)
    else el.removeAttribute('data-theme')
  }, [theme])
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent)
  }, [accent])
}

export function App() {
  const date = toDateKey()
  const { value: day } = useDay(date)
  const { value: reading } = useReading()
  const { value: reminders } = useReminders()
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
        <Dashboard limits={settings.limits} categoryRules={settings.categoryRules} onBack={() => setView('home')} />
        {showSettings && (
          <SettingsPanel
            settings={settings}
            reminders={reminders}
            onClose={() => setShowSettings(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="app">
      <Header
        name={settings.name}
        onOpenSettings={() => setShowSettings(true)}
        onOpenDashboard={() => setView('dashboard')}
      />
      <QuickLinks links={settings.quickLinks} />

      <Quote />
      <Intention date={date} value={day.intention} />
      <Checkin date={date} value={day.checkin} />

      <div className="grid">
        <GoalsChecklist date={date} goals={day.goals} />
        <ReadingHub items={reading} />
      </div>

      <div style={{ marginBottom: 22 }}>
        <TimeToday
          data={timeToday}
          limits={settings.limits}
          trackingEnabled={settings.tracking.enabled}
        />
      </div>

      <Reminders reminders={reminders} />

      <div style={{ marginTop: 12 }}>
        <DistractionLog />
      </div>

      {showSettings && (
        <SettingsPanel
          settings={settings}
          reminders={reminders}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
