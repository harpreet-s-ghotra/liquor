import * as net from 'net'
import { execFile } from 'child_process'
import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import type { ReceiptConfig } from '../../shared/types'

export type CashDrawerConfig =
  | { type: 'usb'; printerName: string }
  | { type: 'tcp'; ip: string; port: number }

// ESC/POS open-drawer command: ESC p <pin2> <on-time> <off-time>
// pin 2 = drawer 1, on-time 25×2ms = 50ms, off-time 250×2ms = 500ms
const OPEN_CMD = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa])

const DEFAULT_PORT = 9100
const CONNECT_TIMEOUT_MS = 3000

function configPath(): string {
  return join(app.getPath('userData'), 'peripheral-config.json')
}

function readConfigFile(): Record<string, unknown> {
  const p = configPath()
  if (!existsSync(p)) return {}
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

export function getCashDrawerConfig(): CashDrawerConfig | null {
  const data = readConfigFile()
  const cfg = data.cashDrawer as CashDrawerConfig | undefined
  if (!cfg) return null
  if (cfg.type === 'usb') return cfg.printerName ? cfg : null
  if (cfg.type === 'tcp') return cfg.ip ? cfg : null
  return null
}

export function saveCashDrawerConfig(config: CashDrawerConfig): void {
  const existing = readConfigFile()
  writeFileSync(configPath(), JSON.stringify({ ...existing, cashDrawer: config }, null, 2))
}

const RECEIPT_CONFIG_DEFAULTS: ReceiptConfig = {
  fontSize: 10,
  paddingY: 4,
  paddingX: 4,
  storeName: '',
  footerMessage: ''
}

export function getReceiptConfig(): ReceiptConfig {
  const data = readConfigFile()
  const cfg = data.receiptConfig as Partial<ReceiptConfig> | undefined
  return {
    fontSize: clamp(cfg?.fontSize ?? RECEIPT_CONFIG_DEFAULTS.fontSize, 8, 16),
    paddingY: clamp(cfg?.paddingY ?? RECEIPT_CONFIG_DEFAULTS.paddingY, 4, 40),
    paddingX: clamp(cfg?.paddingX ?? RECEIPT_CONFIG_DEFAULTS.paddingX, 4, 30),
    storeName: cfg?.storeName ?? '',
    footerMessage: cfg?.footerMessage ?? ''
  }
}

export function saveReceiptConfig(config: ReceiptConfig): void {
  const existing = readConfigFile()
  const sanitized: ReceiptConfig = {
    fontSize: clamp(config.fontSize, 8, 16),
    paddingY: clamp(config.paddingY, 4, 40),
    paddingX: clamp(config.paddingX, 4, 30),
    storeName: config.storeName ?? '',
    footerMessage: config.footerMessage ?? ''
  }
  writeFileSync(configPath(), JSON.stringify({ ...existing, receiptConfig: sanitized }, null, 2))
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** Check whether the named CUPS printer is currently reachable (idle/processing). */
export function checkPrinterConnected(printerName: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile('lpstat', ['-p', printerName], (_err, stdout) => {
      const out = stdout.toLowerCase()
      resolve(out.includes('idle') || out.includes('processing'))
    })
  })
}

function openViaUsb(printerName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Use the Star CUPS driver's CashDrawerSetting option — no raw bytes needed.
    // Sending a minimal print job with CashDrawerSetting=1OpenDrawer1 fires the drawer.
    const lp = execFile(
      'lp',
      [
        '-d',
        printerName,
        '-o',
        'CashDrawerSetting=1OpenDrawer1',
        '-o',
        'DocCutType=0NoCutDoc',
        '-o',
        'PageCutType=0NoCutPage',
        '-'
      ],
      (err) => {
        if (err) reject(new Error(`Cash drawer (USB): ${err.message}`))
        else resolve()
      }
    )
    lp.stdin?.write(' ')
    lp.stdin?.end()
  })
}

function openViaTcp(ip: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket()

    socket.setTimeout(CONNECT_TIMEOUT_MS)

    socket.connect(port, ip, () => {
      socket.write(OPEN_CMD, (err) => {
        socket.destroy()
        if (err) reject(err)
        else resolve()
      })
    })

    socket.on('timeout', () => {
      socket.destroy()
      reject(new Error(`Cash drawer timed out connecting to ${ip}:${port}`))
    })

    socket.on('error', (err) => {
      socket.destroy()
      reject(err)
    })
  })
}

export function openCashDrawer(config: CashDrawerConfig): Promise<void> {
  if (config.type === 'usb') return openViaUsb(config.printerName)
  return openViaTcp(config.ip, config.port ?? DEFAULT_PORT)
}
