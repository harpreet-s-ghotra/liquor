import { autoUpdater } from 'electron-updater'
import { BrowserWindow } from 'electron'

function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows()
  return windows.length > 0 ? windows[0] : null
}

function send(channel: string, payload: unknown): void {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload)
  }
}

export function initAutoUpdater(): void {
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'harpreet-s-ghotra',
    repo: 'checkoutmain-releases'
  })

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    send('updater:update-available', { version: info.version, releaseDate: info.releaseDate })
  })

  autoUpdater.on('update-not-available', () => {
    send('updater:update-not-available', {})
  })

  autoUpdater.on('update-downloaded', (info) => {
    send('updater:update-downloaded', { version: info.version })
  })

  autoUpdater.on('error', (err) => {
    console.error('[auto-updater] Error:', err.message)
    send('updater:error', { message: err.message })
  })
}

export function checkForUpdates(): void {
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('[auto-updater] Check failed:', err.message)
  })
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall(false, true)
}
