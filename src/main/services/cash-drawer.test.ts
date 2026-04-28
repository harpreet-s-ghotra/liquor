import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { execFileMock, getPathMock, getPrintersAsyncMock, getAllWindowsMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
  getPathMock: vi.fn(),
  getPrintersAsyncMock: vi.fn(),
  getAllWindowsMock: vi.fn()
}))

vi.mock('child_process', () => ({
  execFile: execFileMock
}))

vi.mock('electron', () => ({
  app: {
    getPath: getPathMock
  },
  BrowserWindow: {
    getAllWindows: getAllWindowsMock
  }
}))

import {
  getCashDrawerConfig,
  getEffectiveCashDrawerConfig,
  getReceiptConfig,
  getReceiptPrinterConfig,
  listReceiptPrinters,
  openCashDrawer,
  saveCashDrawerConfig,
  saveReceiptConfig,
  saveReceiptPrinterConfig,
  checkPrinterConnected
} from './cash-drawer'

describe('cash-drawer config helpers', () => {
  let userDataPath = ''

  beforeEach(() => {
    vi.clearAllMocks()
    userDataPath = mkdtempSync(join(tmpdir(), 'liquor-pos-cash-drawer-'))
    getPathMock.mockReturnValue(userDataPath)
    getAllWindowsMock.mockReturnValue([
      {
        isDestroyed: () => false,
        webContents: { getPrintersAsync: getPrintersAsyncMock }
      }
    ])
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
  })

  // ── Receipt printer config ──

  it('saves and reads the explicit receipt printer config', () => {
    saveReceiptPrinterConfig({ printerName: 'Star-TSP654' })
    expect(getReceiptPrinterConfig()).toEqual({ printerName: 'Star-TSP654' })
  })

  it('falls back to the legacy usb drawer printer for receipt printing', () => {
    writeFileSync(
      join(userDataPath, 'peripheral-config.json'),
      JSON.stringify({ cashDrawer: { type: 'usb', printerName: 'Legacy-Star' } })
    )
    expect(getReceiptPrinterConfig()).toEqual({ printerName: 'Legacy-Star' })
  })

  it('returns null when no receipt printer and no usb drawer configured', () => {
    expect(getReceiptPrinterConfig()).toBeNull()
  })

  it('returns null when legacy drawer is TCP type', () => {
    writeFileSync(
      join(userDataPath, 'peripheral-config.json'),
      JSON.stringify({ cashDrawer: { type: 'tcp', ip: '192.168.1.100', port: 9100 } })
    )
    expect(getReceiptPrinterConfig()).toBeNull()
  })

  // ── Cash drawer config ──

  it('returns null when no config file exists', () => {
    expect(getCashDrawerConfig()).toBeNull()
  })

  it('reads USB cash drawer config', () => {
    saveCashDrawerConfig({ type: 'usb', printerName: 'Star-TSP654' })
    expect(getCashDrawerConfig()).toEqual({ type: 'usb', printerName: 'Star-TSP654' })
  })

  it('reads TCP cash drawer config', () => {
    saveCashDrawerConfig({ type: 'tcp', ip: '192.168.1.100', port: 9100 })
    expect(getCashDrawerConfig()).toEqual({ type: 'tcp', ip: '192.168.1.100', port: 9100 })
  })

  it('returns null for USB config with no printer name', () => {
    writeFileSync(
      join(userDataPath, 'peripheral-config.json'),
      JSON.stringify({ cashDrawer: { type: 'usb', printerName: '' } })
    )
    expect(getCashDrawerConfig()).toBeNull()
  })

  it('returns null for TCP config with no IP', () => {
    writeFileSync(
      join(userDataPath, 'peripheral-config.json'),
      JSON.stringify({ cashDrawer: { type: 'tcp', ip: '', port: 9100 } })
    )
    expect(getCashDrawerConfig()).toBeNull()
  })

  it('returns null when config file is invalid JSON', () => {
    writeFileSync(join(userDataPath, 'peripheral-config.json'), 'not-json')
    expect(getCashDrawerConfig()).toBeNull()
  })

  // ── Effective cash drawer config ──

  it('uses the receipt printer as the usb drawer fallback when no drawer override exists', () => {
    saveReceiptPrinterConfig({ printerName: 'Star-TSP654' })
    expect(getEffectiveCashDrawerConfig()).toEqual({ type: 'usb', printerName: 'Star-TSP654' })
  })

  it('returns explicit drawer config when both drawer and printer are configured', () => {
    saveCashDrawerConfig({ type: 'tcp', ip: '10.0.0.5', port: 9100 })
    saveReceiptPrinterConfig({ printerName: 'Star-TSP654' })
    expect(getEffectiveCashDrawerConfig()).toEqual({ type: 'tcp', ip: '10.0.0.5', port: 9100 })
  })

  it('returns null when no drawer or receipt printer is configured', () => {
    expect(getEffectiveCashDrawerConfig()).toBeNull()
  })

  // ── Receipt config ──

  it('returns default receipt config when no file exists', () => {
    const cfg = getReceiptConfig()
    expect(cfg).toEqual({
      fontSize: 10,
      paddingY: 4,
      paddingX: 4,
      storeName: '',
      footerMessage: '',
      alwaysPrint: false
    })
  })

  it('saves and reads receipt config', () => {
    saveReceiptConfig({
      fontSize: 12,
      paddingY: 6,
      paddingX: 6,
      storeName: 'My Store',
      footerMessage: 'Thank you!',
      alwaysPrint: true
    })
    expect(getReceiptConfig()).toEqual({
      fontSize: 12,
      paddingY: 6,
      paddingX: 6,
      storeName: 'My Store',
      footerMessage: 'Thank you!',
      alwaysPrint: true
    })
  })

  it('clamps receipt config values to valid range', () => {
    saveReceiptConfig({
      fontSize: 100,
      paddingY: 100,
      paddingX: 100,
      storeName: '',
      footerMessage: '',
      alwaysPrint: false
    })
    const cfg = getReceiptConfig()
    expect(cfg.fontSize).toBe(16)
    expect(cfg.paddingY).toBe(40)
    expect(cfg.paddingX).toBe(30)
  })

  // ── Printer utilities ──

  it('lists installed printers from the Electron printer bridge', async () => {
    getPrintersAsyncMock.mockResolvedValue([
      { name: 'Star-TSP654', options: {} },
      { name: 'Office-Printer', options: {} }
    ])
    await expect(listReceiptPrinters()).resolves.toEqual(['Office-Printer', 'Star-TSP654'])
  })

  it('deduplicates printers and ignores entries without a name', async () => {
    getPrintersAsyncMock.mockResolvedValue([
      { name: 'Star-TSP654', options: {} },
      { name: '', options: {} },
      { name: 'Star-TSP654', options: {} }
    ])
    await expect(listReceiptPrinters()).resolves.toEqual(['Star-TSP654'])
  })

  it('rejects when no application window is available to enumerate printers', async () => {
    getAllWindowsMock.mockReturnValue([])
    await expect(listReceiptPrinters()).rejects.toThrow(
      'Failed to list printers: no application window is open'
    )
  })

  it('rejects when the Electron printer bridge throws', async () => {
    getPrintersAsyncMock.mockRejectedValue(new Error('printer service unreachable'))
    await expect(listReceiptPrinters()).rejects.toThrow(
      'Failed to list printers: printer service unreachable'
    )
  })

  it('reports the configured printer as connected when CUPS state is idle (3)', async () => {
    getPrintersAsyncMock.mockResolvedValue([
      { name: 'Star-TSP654', options: { 'printer-state': '3' } }
    ])
    await expect(checkPrinterConnected('Star-TSP654')).resolves.toBe(true)
  })

  it('reports the configured printer as connected when no state is reported', async () => {
    getPrintersAsyncMock.mockResolvedValue([{ name: 'Star-TSP654', options: {} }])
    await expect(checkPrinterConnected('Star-TSP654')).resolves.toBe(true)
  })

  it('reports the printer as not connected when CUPS state is stopped (5)', async () => {
    getPrintersAsyncMock.mockResolvedValue([
      { name: 'Star-TSP654', options: { 'printer-state': '5' } }
    ])
    await expect(checkPrinterConnected('Star-TSP654')).resolves.toBe(false)
  })

  it('reports the printer as not connected when Windows reports stopped/offline', async () => {
    getPrintersAsyncMock.mockResolvedValue([
      { name: 'Star-TSP654', options: { 'printer-state': 'offline' } }
    ])
    await expect(checkPrinterConnected('Star-TSP654')).resolves.toBe(false)
  })

  it('reports the printer as not connected when missing from the OS list', async () => {
    getPrintersAsyncMock.mockResolvedValue([{ name: 'Some-Other', options: {} }])
    await expect(checkPrinterConnected('Star-TSP654')).resolves.toBe(false)
  })

  // ── openCashDrawer (USB) ──

  it('opens drawer via USB using lp on macOS/Linux', async () => {
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
    const stdinMock = { write: vi.fn(), end: vi.fn() }
    execFileMock.mockImplementation(
      (_command: string, _args: string[], callback: (err: Error | null) => void) => {
        callback(null)
        return { stdin: stdinMock } as never
      }
    )
    try {
      await expect(
        openCashDrawer({ type: 'usb', printerName: 'Star-TSP654' })
      ).resolves.toBeUndefined()
      expect(execFileMock).toHaveBeenCalledWith(
        'lp',
        expect.arrayContaining(['-d', 'Star-TSP654']),
        expect.any(Function)
      )
    } finally {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true
      })
    }
  })

  it('rejects when USB open fails on macOS/Linux', async () => {
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
    const stdinMock = { write: vi.fn(), end: vi.fn() }
    execFileMock.mockImplementation(
      (_command: string, _args: string[], callback: (err: Error | null) => void) => {
        callback(new Error('Printer offline'))
        return { stdin: stdinMock } as never
      }
    )
    try {
      await expect(openCashDrawer({ type: 'usb', printerName: 'Star-TSP654' })).rejects.toThrow(
        'Cash drawer (USB): Printer offline'
      )
    } finally {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true
      })
    }
  })

  it('opens drawer on Windows via PowerShell + WINSPOOL', async () => {
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
    execFileMock.mockImplementation(
      (
        _command: string,
        _args: string[],
        callback: (err: Error | null, stdout: string, stderr: string) => void
      ) => {
        callback(null, '', '')
        return {} as never
      }
    )
    try {
      await expect(
        openCashDrawer({ type: 'usb', printerName: 'Star-TSP654' })
      ).resolves.toBeUndefined()

      expect(execFileMock).toHaveBeenCalledTimes(1)
      const call = execFileMock.mock.calls[0]
      expect(call[0]).toBe('powershell.exe')
      const args = call[1] as string[]
      expect(args).toContain('-NoProfile')
      expect(args).toContain('-Command')
      const script = args[args.length - 1]
      expect(script).toContain('Star-TSP654')
      expect(script).toContain('WritePrinter')
      // The ESC/POS open-drawer payload must be embedded in the script
      expect(script).toContain('0x1b,0x70,0x00,0x19,0xfa')
    } finally {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true
      })
    }
  })

  it('escapes single quotes in printer names so the PowerShell call is safe', async () => {
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
    execFileMock.mockImplementation(
      (
        _command: string,
        _args: string[],
        callback: (err: Error | null, stdout: string, stderr: string) => void
      ) => {
        callback(null, '', '')
        return {} as never
      }
    )
    try {
      await openCashDrawer({ type: 'usb', printerName: "Mike's Star" })
      const args = execFileMock.mock.calls[0][1] as string[]
      const script = args[args.length - 1]
      // PowerShell single-quoted strings escape ' as ''.
      expect(script).toContain("'Mike''s Star'")
    } finally {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true
      })
    }
  })

  it('surfaces the PowerShell stderr message when the Windows drawer kick fails', async () => {
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
    execFileMock.mockImplementation(
      (
        _command: string,
        _args: string[],
        callback: (err: Error | null, stdout: string, stderr: string) => void
      ) => {
        callback(new Error('exit code 1'), '', 'WritePrinter failed (Win32 error 1801)')
        return {} as never
      }
    )
    try {
      await expect(openCashDrawer({ type: 'usb', printerName: 'Star-TSP654' })).rejects.toThrow(
        /WritePrinter failed \(Win32 error 1801\)/
      )
    } finally {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true
      })
    }
  })
})
