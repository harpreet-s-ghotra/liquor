import * as net from 'net'
import { execFile } from 'child_process'
import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import type { ReceiptConfig, ReceiptPrinterConfig } from '../../shared/types'

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

function getReceiptPrinterConfigFromData(
  data: Record<string, unknown>
): ReceiptPrinterConfig | null {
  const cfg = data.receiptPrinter as Partial<ReceiptPrinterConfig> | undefined
  if (cfg?.printerName) {
    return { printerName: cfg.printerName }
  }

  const legacyDrawer = data.cashDrawer as CashDrawerConfig | undefined
  if (legacyDrawer?.type === 'usb' && legacyDrawer.printerName) {
    return { printerName: legacyDrawer.printerName }
  }

  return null
}

export function getReceiptPrinterConfig(): ReceiptPrinterConfig | null {
  return getReceiptPrinterConfigFromData(readConfigFile())
}

export function saveReceiptPrinterConfig(config: ReceiptPrinterConfig): void {
  const existing = readConfigFile()
  writeFileSync(configPath(), JSON.stringify({ ...existing, receiptPrinter: config }, null, 2))
}

export function getCashDrawerConfig(): CashDrawerConfig | null {
  const data = readConfigFile()
  const cfg = data.cashDrawer as CashDrawerConfig | undefined
  if (!cfg) return null
  if (cfg.type === 'usb') return cfg.printerName ? cfg : null
  if (cfg.type === 'tcp') return cfg.ip ? cfg : null
  return null
}

export function getEffectiveCashDrawerConfig(): CashDrawerConfig | null {
  const explicitConfig = getCashDrawerConfig()
  if (explicitConfig) return explicitConfig

  const receiptPrinter = getReceiptPrinterConfig()
  if (!receiptPrinter) return null

  return { type: 'usb', printerName: receiptPrinter.printerName }
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
  footerMessage: '',
  alwaysPrint: false
}

export function getReceiptConfig(): ReceiptConfig {
  const data = readConfigFile()
  const cfg = data.receiptConfig as Partial<ReceiptConfig> | undefined
  return {
    fontSize: clamp(cfg?.fontSize ?? RECEIPT_CONFIG_DEFAULTS.fontSize, 8, 16),
    paddingY: clamp(cfg?.paddingY ?? RECEIPT_CONFIG_DEFAULTS.paddingY, 4, 40),
    paddingX: clamp(cfg?.paddingX ?? RECEIPT_CONFIG_DEFAULTS.paddingX, 4, 30),
    storeName: cfg?.storeName ?? '',
    footerMessage: cfg?.footerMessage ?? '',
    alwaysPrint: cfg?.alwaysPrint ?? false
  }
}

export function saveReceiptConfig(config: ReceiptConfig): void {
  const existing = readConfigFile()
  const sanitized: ReceiptConfig = {
    fontSize: clamp(config.fontSize, 8, 16),
    paddingY: clamp(config.paddingY, 4, 40),
    paddingX: clamp(config.paddingX, 4, 30),
    storeName: config.storeName ?? '',
    footerMessage: config.footerMessage ?? '',
    alwaysPrint: config.alwaysPrint ?? false
  }
  writeFileSync(configPath(), JSON.stringify({ ...existing, receiptConfig: sanitized }, null, 2))
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Pick a webContents for printer enumeration. We borrow the cashier window's
 * webContents because Electron's printer APIs hang off webContents (not the
 * `app` module). The customer-display window also has webContents but is
 * optional; either one works.
 */
function pickPrinterWebContents(): Electron.WebContents | null {
  const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
  return win?.webContents ?? null
}

/**
 * List installed printers using Electron's cross-platform driver bridge.
 * Works on Windows (winspool), macOS, and Linux (CUPS) without shelling out
 * to platform-specific binaries like `lpstat`. Stations running on Windows
 * never had CUPS installed, so the previous lpstat path returned an empty
 * list which surfaced as "no printers" in the manager modal.
 */
export async function listReceiptPrinters(): Promise<string[]> {
  const wc = pickPrinterWebContents()
  if (!wc) {
    throw new Error('Failed to list printers: no application window is open')
  }
  try {
    const printers = await wc.getPrintersAsync()
    const names = printers.map((p) => p.name).filter((n): n is string => !!n)
    return [...new Set(names)].sort((left, right) => left.localeCompare(right))
  } catch (err) {
    throw new Error(`Failed to list printers: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * A printer is "connected" when the OS still has it installed and reports
 * a non-stopped state. Electron's PrinterInfo doesn't expose a portable
 * status field, so we inspect the `options` bag the OS attaches: CUPS uses
 * `printer-state` (3=idle, 4=processing, 5=stopped); Windows exposes
 * `printer-state` strings like "idle"/"stopped". Anything that isn't an
 * explicit "stopped" / non-zero error counts as connected so transient
 * states (processing, paused) don't flicker the badge offline.
 */
export async function checkPrinterConnected(printerName: string): Promise<boolean> {
  const wc = pickPrinterWebContents()
  if (!wc) return false
  try {
    const printers = await wc.getPrintersAsync()
    const match = printers.find((p) => p.name === printerName)
    if (!match) return false
    const opts = (match.options ?? {}) as Record<string, string | undefined>
    const state = String(opts['printer-state'] ?? '').toLowerCase()
    if (!state) return true
    if (state === '5' || state === 'stopped' || state.includes('offline')) return false
    return true
  } catch {
    return false
  }
}

/**
 * Kick the drawer through the printer on Windows. The drawer is daisy-chained
 * off the receipt printer's RJ11 jack, so we just need to push the ESC/POS
 * bytes (`ESC p 0 25 250` — pin 2, 50ms on, 500ms off) to the printer queue.
 *
 * Implementation uses an inline C# wrapper around the WINSPOOL APIs
 * (OpenPrinter / StartDocPrinter / WritePrinter) executed through PowerShell,
 * which avoids shipping a native node module that has to be rebuilt for each
 * Electron version.
 */
function openViaUsbWindows(printerName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const escapedName = printerName.replace(/'/g, "''")
    const script = `
$ErrorActionPreference = 'Stop'
$code = @"
using System;
using System.Runtime.InteropServices;
public class HSPOSRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public class DOCINFO { public string DocName; public string OutputFile; public string DataType; }
  [DllImport("winspool.Drv", SetLastError=true, CharSet=CharSet.Unicode)] public static extern bool OpenPrinter(string p, out IntPtr h, IntPtr d);
  [DllImport("winspool.Drv", SetLastError=true)] public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.Drv", SetLastError=true, CharSet=CharSet.Unicode)] public static extern bool StartDocPrinter(IntPtr h, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFO di);
  [DllImport("winspool.Drv", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.Drv", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.Drv", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.Drv", SetLastError=true)] public static extern bool WritePrinter(IntPtr h, byte[] b, int cnt, out int written);
  public static int Send(string printer, byte[] bytes) {
    IntPtr h;
    if (!OpenPrinter(printer, out h, IntPtr.Zero)) return Marshal.GetLastWin32Error();
    var di = new DOCINFO{ DocName = "HSPOS Drawer Kick", DataType = "RAW" };
    int written = 0;
    bool ok = StartDocPrinter(h, 1, di) && StartPagePrinter(h) && WritePrinter(h, bytes, bytes.Length, out written);
    int err = ok ? 0 : Marshal.GetLastWin32Error();
    EndPagePrinter(h); EndDocPrinter(h); ClosePrinter(h);
    return err;
  }
}
"@
Add-Type -TypeDefinition $code
$bytes = [byte[]](0x1b,0x70,0x00,0x19,0xfa)
$rc = [HSPOSRawPrinter]::Send('${escapedName}', $bytes)
if ($rc -ne 0) { Write-Error "WritePrinter failed (Win32 error $rc)"; exit 1 }
`
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      (err, _stdout, stderr) => {
        if (err) {
          const detail = stderr?.trim() || err.message
          reject(new Error(`Cash drawer (USB): ${detail}`))
        } else {
          resolve()
        }
      }
    )
  })
}

function openViaUsbCups(printerName: string): Promise<void> {
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

function openViaUsb(printerName: string): Promise<void> {
  if (process.platform === 'win32') return openViaUsbWindows(printerName)
  return openViaUsbCups(printerName)
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
