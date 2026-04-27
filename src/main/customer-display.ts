import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { scoped } from './services/logger'

const log = scoped('customer-display')

let customerWindow: BrowserWindow | null = null
let lastSnapshot: unknown = null

export function createCustomerDisplay(preloadPath: string): void {
  if (customerWindow && !customerWindow.isDestroyed()) return

  // Pick a non-primary display if one is connected; otherwise fall back to primary.
  const displays = screen.getAllDisplays()
  const primary = screen.getPrimaryDisplay()
  const secondary = displays.find((d) => d.id !== primary.id) ?? primary
  const { x, y, width, height } = secondary.bounds

  customerWindow = new BrowserWindow({
    x,
    y,
    width: secondary === primary ? Math.min(900, width) : width,
    height: secondary === primary ? Math.min(700, height) : height,
    fullscreen: secondary !== primary,
    title: 'High Spirits POS — Customer Display',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      sandbox: false
    }
  })

  customerWindow.on('closed', () => {
    customerWindow = null
  })

  const url =
    is.dev && process.env['ELECTRON_RENDERER_URL']
      ? `${process.env['ELECTRON_RENDERER_URL']}?display=customer`
      : null

  if (url) {
    void customerWindow.loadURL(url)
  } else {
    void customerWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { display: 'customer' }
    })
  }

  // Replay the last snapshot once the window finishes loading so re-launches stay in sync.
  customerWindow.webContents.once('did-finish-load', () => {
    if (lastSnapshot !== null) {
      pushCustomerSnapshot(lastSnapshot)
    }
  })

  log.info('customer display window opened')
}

export function pushCustomerSnapshot(snapshot: unknown): void {
  lastSnapshot = snapshot
  if (!customerWindow || customerWindow.isDestroyed()) return
  customerWindow.webContents.send('customer-display:snapshot', snapshot)
}

export function closeCustomerDisplay(): void {
  if (customerWindow && !customerWindow.isDestroyed()) {
    customerWindow.close()
  }
  customerWindow = null
  lastSnapshot = null
}
