import { addReadingItem, getSettings } from '../lib/storage.ts'
import { syncReadingItem } from '../lib/vault.ts'

const MENU_ID = 'compass-save-page'

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'Save to Compass (read later)',
    contexts: ['page', 'link', 'selection'],
  })
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return

  // Prefer a clicked link; otherwise save the page itself.
  const url = info.linkUrl ?? info.pageUrl ?? tab?.url
  if (!url) return

  const item = await addReadingItem({
    title: tab?.title ?? url,
    url,
    kind: 'article',
    status: 'queue',
  })

  const settings = await getSettings()
  if (settings.vault.enabled) {
    await syncReadingItem(settings.vault, item)
  }

  // Brief confirmation badge.
  await chrome.action.setBadgeText({ text: '✓' })
  await chrome.action.setBadgeBackgroundColor({ color: '#5ed29a' })
  setTimeout(() => void chrome.action.setBadgeText({ text: '' }), 1500)
})
