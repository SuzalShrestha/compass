import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: 'Compass',
  version: pkg.version,
  description: pkg.description,
  // The new tab page — Compass replaces it.
  chrome_url_overrides: {
    newtab: 'index.html',
  },
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  // Toolbar button opens the "save to read later" popup.
  action: {
    default_popup: 'popup.html',
    default_title: 'Save this page to Compass',
    default_icon: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
    },
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  permissions: [
    'storage', // settings, goals, reading list, reminders
    'contextMenus', // right-click "save to read later"
    'tabs', // read tab url/title for the popup save + time tracking
    'idle', // pause time tracking when the machine is idle/locked
    'alarms', // periodic flush of the in-progress time segment
    'scripting', // inject the escalating limit overlay into a page
    'history', // all-time browsing insights in the dashboard
    'notifications', // "focus session complete"
    'unlimitedStorage', // years of days/tasks without hitting the 10 MB cap
    'favicon', // site icons for links and saved articles, from Chrome's local cache
  ],
  // <all_urls> covers time tracking, overlay injection on limited sites, the
  // vault sync request to the Local REST API on http://127.0.0.1:27123, and
  // the calendar (.ics) feeds you add in Settings.
  host_permissions: ['<all_urls>'],
})
