import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { execFileMock, getPathMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
  getPathMock: vi.fn()
}))

vi.mock('child_process', () => ({
  execFile: execFileMock
}))

vi.mock('electron', () => ({
  app: {
    getPath: getPathMock
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

  it('lists installed printers from lpstat output', async () => {
    execFileMock.mockImplementation(
      (
        _command: string,
        _args: string[],
        callback: (err: Error | null, stdout: string) => void
      ) => {
        callback(
          null,
          [
            'device for Star-TSP654: usb://Star/TSP654%20(STR-T001)?location=2120000',
            'device for Office-Printer: ipp://192.168.1.25/printers/Office-Printer'
          ].join('\n')
        )
        return {} as never
      }
    )
    await expect(listReceiptPrinters()).resolves.toEqual(['Office-Printer', 'Star-TSP654'])
  })

  it('rejects when lpstat fails', async () => {
    execFileMock.mockImplementation(
      (
        _command: string,
        _args: string[],
        callback: (err: Error | null, stdout: string) => void
      ) => {
        callback(new Error('lpstat not found'), '')
        return {} as never
      }
    )
    await expect(listReceiptPrinters()).rejects.toThrow('Failed to list printers: lpstat not found')
  })

  it('resolves true when printer is idle', async () => {
    execFileMock.mockImplementation(
      (
        _command: string,
        _args: string[],
        callback: (err: Error | null, stdout: string) => void
      ) => {
        callback(null, 'printer Star-TSP654 is idle')
        return {} as never
      }
    )
    await expect(checkPrinterConnected('Star-TSP654')).resolves.toBe(true)
  })

  it('resolves false when printer is offline', async () => {
    execFileMock.mockImplementation(
      (
        _command: string,
        _args: string[],
        callback: (err: Error | null, stdout: string) => void
      ) => {
        callback(null, 'printer Star-TSP654 is disabled')
        return {} as never
      }
    )
    await expect(checkPrinterConnected('Star-TSP654')).resolves.toBe(false)
  })

  // ── openCashDrawer (USB) ──

  it('opens drawer via USB using lp', async () => {
    const stdinMock = { write: vi.fn(), end: vi.fn() }
    execFileMock.mockImplementation(
      (_command: string, _args: string[], callback: (err: Error | null) => void) => {
        callback(null)
        return { stdin: stdinMock } as never
      }
    )
    await expect(
      openCashDrawer({ type: 'usb', printerName: 'Star-TSP654' })
    ).resolves.toBeUndefined()
    expect(execFileMock).toHaveBeenCalledWith(
      'lp',
      expect.arrayContaining(['-d', 'Star-TSP654']),
      expect.any(Function)
    )
  })

  it('rejects when USB open fails', async () => {
    const stdinMock = { write: vi.fn(), end: vi.fn() }
    execFileMock.mockImplementation(
      (_command: string, _args: string[], callback: (err: Error | null) => void) => {
        callback(new Error('Printer offline'))
        return { stdin: stdinMock } as never
      }
    )
    await expect(openCashDrawer({ type: 'usb', printerName: 'Star-TSP654' })).rejects.toThrow(
      'Cash drawer (USB): Printer offline'
    )
  })
})
