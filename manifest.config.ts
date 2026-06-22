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
  // Toolbar button opens the "save to read later" popup.
  action: {
    default_popup: 'popup.html',
    default_title: 'Save this page to Compass',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  permissions: [
    'storage', // settings, goals, reading list, reminders
    'contextMenus', // right-click "save to read later"
    'activeTab', // read current tab url/title when the popup is invoked
  ],
  // Vault sync talks to the Obsidian Local REST API over plain HTTP (port 27123).
  host_permissions: ['http://127.0.0.1:27123/*', 'http://localhost:27123/*'],
})
