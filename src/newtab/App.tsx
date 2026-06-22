import { useState } from 'react'
import { toDateKey } from '../lib/dates.ts'
import { useDay, useReading, useReminders, useSettings, useTimeToday } from '../lib/hooks.ts'
import { Header } from './components/Header.tsx'
import { QuickLinks } from './components/QuickLinks.tsx'
import { Quote } from './components/Quote.tsx'
import { Intention } from './components/Intention.tsx'
import { GoalsChecklist } from './components/GoalsChecklist.tsx'
import { ReadingHub } from './components/ReadingHub.tsx'
import { Reminders } from './components/Reminders.tsx'
import { TimeToday } from './components/TimeToday.tsx'
import { SettingsPanel } from './components/SettingsPanel.tsx'

export function App() {
  const date = toDateKey()
  const { value: day } = useDay(date)
  const { value: reading } = useReading()
  const { value: reminders } = useReminders()
  const { value: settings } = useSettings()
  const { value: timeToday } = useTimeToday()
  const [showSettings, setShowSettings] = useState(false)

  // Wait for settings (and its defaults) before painting, to avoid flashes.
  if (!settings) return null

  return (
    <div className="app">
      <Header name={settings.name} onOpenSettings={() => setShowSettings(true)} />
      <QuickLinks links={settings.quickLinks} />

      <Quote />
      <Intention date={date} value={day.intention} />

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
