import { app } from 'electron'
import log from 'electron-log/main'
import { join } from 'path'
import { redact } from '../../shared/redact'

type Level = 'error' | 'warn' | 'info' | 'debug'

const VALID_LEVELS: Level[] = ['error', 'warn', 'info', 'debug']

function resolveLevel(envValue: string | undefined, fallback: Level): Level {
  if (!envValue) return fallback
  const lower = envValue.toLowerCase() as Level
  return VALID_LEVELS.includes(lower) ? lower : fallback
}

let initialized = false

export function initLogger(): void {
  if (initialized) return
  initialized = true

  const envLevel = resolveLevel(process.env.LOG_LEVEL, 'info')
  const isDev = !app.isPackaged

  log.initialize()

  log.transports.file.level = envLevel
  log.transports.file.maxSize = 5 * 1024 * 1024
  log.transports.file.format = '{y}-{m}-{d} {h}:{i}:{s}.{ms} [{level}] [{scope}] {text}'
  log.transports.file.resolvePathFn = () => join(app.getPath('userData'), 'logs', 'main.log')

  log.transports.console.level = resolveLevel(process.env.LOG_LEVEL, isDev ? 'debug' : 'info')
  log.transports.console.format = '{h}:{i}:{s}.{ms} [{level}] [{scope}] {text}'

  // Rebind console.* so third-party libs route through electron-log too.
  console.log = log.log.bind(log)
  console.info = log.info.bind(log)
  console.warn = log.warn.bind(log)
  console.error = log.error.bind(log)
  console.debug = log.debug.bind(log)
}

export type ScopedLogger = {
  error: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  debug: (...args: unknown[]) => void
}

export function scoped(name: string): ScopedLogger {
  const scopedLog = log.scope(name)
  return {
    error: (...args) => scopedLog.error(...args.map(sanitize)),
    warn: (...args) => scopedLog.warn(...args.map(sanitize)),
    info: (...args) => scopedLog.info(...args.map(sanitize)),
    debug: (...args) => scopedLog.debug(...args.map(sanitize))
  }
}

function sanitize(value: unknown): unknown {
  if (value instanceof Error) return value
  if (value == null || typeof value !== 'object') return value
  return redact(value)
}

export { redact }
